import { DatabaseService } from '@/services/database';
import { HistorySummaryService } from '@/services/summary';
import type { Bindings } from '@/types/bindings';
import {
  EnhancedError,
  ErrorCategory,
  withErrorHandling,
} from '@/utils/error-handler';
import type { D1Database } from '@cloudflare/workers-types';
import type { Context } from 'hono';

// バッチ処理設定
const BATCH_CONFIG = {
  BATCH_SIZE: 50, // 一度に処理するユーザー数
  PROCESS_INTERVAL: 100, // バッチ間の待機時間（ミリ秒）
  OLD_ENTRY_DAYS: 90, // エントリー保持期間（日）
  OLD_SUMMARY_DAYS: 30, // サマリー保持期間（日）
  ACTIVE_USER_DAYS: 7, // アクティブユーザー判定期間（日）
} as const;

// バッチ処理ログ用定数
const BATCH_MESSAGES = {
  START_CACHE_UPDATE: 'バッチ処理開始: 要約キャッシュ更新',
  START_DATA_CLEANUP: 'バッチ処理開始: 古いデータクリーンアップ',
  START_API_OPTIMIZATION: 'バッチ処理開始: API使用量最適化',
  START_MONITORING: 'バッチ処理開始: モニタリング統計取得',
  COMPLETE_CACHE_UPDATE: '要約キャッシュ更新完了',
  COMPLETE_DATA_CLEANUP: '古いデータクリーンアップ完了',
  COMPLETE_API_OPTIMIZATION: 'API使用量最適化完了',
  COMPLETE_MONITORING: 'モニタリング統計取得完了',
  BATCH_COMPLETE: 'バッチ処理完了',
  ERROR_CACHE_UPDATE: '要約キャッシュ更新中にエラー',
  ERROR_DATA_CLEANUP: '古いデータクリーンアップ中にエラー',
  ERROR_API_OPTIMIZATION: 'API使用量最適化中にエラー',
  ERROR_MONITORING: 'モニタリング統計取得中にエラー',
} as const;

interface BatchStats {
  cacheUpdated: number;
  entriesDeleted: number;
  summariesDeleted: number;
  analysesDeleted: number;
  duplicatesRemoved: number;
  usersProcessed: number;
  totalEntries: number;
  totalSummaries: number;
  totalAnalyses: number;
  totalUsers: number;
  processingTimeMs: number;
}

/**
 * Cloudflare Scheduled Workersハンドラー
 * 定期的なバッチ処理を実行
 */
export const scheduledHandler = async (
  c: Context<{ Bindings: Bindings }>,
  event: ScheduledEvent
): Promise<Response> => {
  const startTime = Date.now();

  return withErrorHandling(
    async () => {
      console.log('スケジュールバッチ処理開始', {
        scheduledTime: new Date(event.scheduledTime).toISOString(),
        cron: event.cron,
        timestamp: new Date().toISOString(),
      });

      const database = c.env.DB;
      const db = new DatabaseService(database);
      const summaryService = new HistorySummaryService(database, c.env);

      const stats: BatchStats = {
        cacheUpdated: 0,
        entriesDeleted: 0,
        summariesDeleted: 0,
        analysesDeleted: 0,
        duplicatesRemoved: 0,
        usersProcessed: 0,
        totalEntries: 0,
        totalSummaries: 0,
        totalAnalyses: 0,
        totalUsers: 0,
        processingTimeMs: 0,
      };

      // 1. 要約キャッシュの定期更新
      stats.cacheUpdated = await updateSummaryCache(
        database,
        db,
        summaryService
      );

      // 2. 古いデータのクリーンアップ
      const cleanupStats = await cleanupOldData(database);
      stats.entriesDeleted = cleanupStats.entriesDeleted;
      stats.summariesDeleted = cleanupStats.summariesDeleted;
      stats.analysesDeleted = cleanupStats.analysesDeleted;

      // 3. API使用量の最適化
      stats.duplicatesRemoved = await optimizeApiUsage(database);

      // 4. バッチ処理のモニタリング
      const monitoringStats = await getMonitoringStats(database);
      stats.totalEntries = monitoringStats.totalEntries;
      stats.totalSummaries = monitoringStats.totalSummaries;
      stats.totalAnalyses = monitoringStats.totalAnalyses;
      stats.totalUsers = monitoringStats.totalUsers;
      stats.usersProcessed = monitoringStats.usersProcessed;

      stats.processingTimeMs = Date.now() - startTime;

      console.log(BATCH_MESSAGES.BATCH_COMPLETE, {
        stats,
        timestamp: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: BATCH_MESSAGES.BATCH_COMPLETE,
        stats,
        processingTimeMs: stats.processingTimeMs,
      });
    },
    'scheduled.handler',
    {
      useCircuitBreaker: false, // スケジュール処理では回路ブレーカーを使用しない
      retryConfig: {
        maxRetries: 1, // スケジュール処理は再試行回数を制限
      },
    }
  );
};

/**
 * 要約キャッシュの定期更新
 * アクティブユーザーの要約を再生成
 */
async function updateSummaryCache(
  database: D1Database,
  db: DatabaseService,
  summaryService: HistorySummaryService
): Promise<number> {
  console.log(BATCH_MESSAGES.START_CACHE_UPDATE);

  try {
    // アクティブユーザーリストを取得（過去7日間に投稿があるユーザー）
    const activeUsers = await getActiveUsers(database);
    console.log(`アクティブユーザー数: ${activeUsers.length}`);

    let updatedCount = 0;

    // バッチ処理でアクティブユーザーの要約を更新
    for (let i = 0; i < activeUsers.length; i += BATCH_CONFIG.BATCH_SIZE) {
      const batch = activeUsers.slice(i, i + BATCH_CONFIG.BATCH_SIZE);

      await Promise.all(
        batch.map(async (userId) => {
          try {
            // 既存のキャッシュをクリアして新しい要約を生成
            const { startDate, endDate } = getDateRange();

            // 古いキャッシュを削除
            await db.summaries.delete(userId, startDate, endDate);

            // 新しい要約を生成（getOrCreateSummaryが内部でキャッシュ）
            await summaryService.getOrCreateSummary(userId);
            updatedCount++;
          } catch (error) {
            console.error(`ユーザー ${userId} の要約更新エラー:`, error);
          }
        })
      );

      // バッチ間の待機
      if (i + BATCH_CONFIG.BATCH_SIZE < activeUsers.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, BATCH_CONFIG.PROCESS_INTERVAL)
        );
      }
    }

    console.log(BATCH_MESSAGES.COMPLETE_CACHE_UPDATE, { updatedCount });
    return updatedCount;
  } catch (error) {
    console.error(BATCH_MESSAGES.ERROR_CACHE_UPDATE, error);
    throw new EnhancedError(BATCH_MESSAGES.ERROR_CACHE_UPDATE, {
      category: ErrorCategory.TEMPORARY,
      isRetryable: true,
      logData: { operation: 'updateSummaryCache' },
    });
  }
}

/**
 * 古いデータのクリーンアップ
 */
async function cleanupOldData(database: D1Database): Promise<{
  entriesDeleted: number;
  summariesDeleted: number;
  analysesDeleted: number;
}> {
  console.log(BATCH_MESSAGES.START_DATA_CLEANUP);

  try {
    const stats = {
      entriesDeleted: 0,
      summariesDeleted: 0,
      analysesDeleted: 0,
    };

    // 古いエントリーを削除（カスケード削除により関連分析も削除される）
    const oldEntryCutoff = new Date();
    oldEntryCutoff.setDate(
      oldEntryCutoff.getDate() - BATCH_CONFIG.OLD_ENTRY_DAYS
    );

    const deleteEntriesResult = await database
      .prepare(
        `
        DELETE FROM entries
        WHERE datetime(created_at) < datetime(?)
      `
      )
      .bind(oldEntryCutoff.toISOString())
      .run();

    stats.entriesDeleted = deleteEntriesResult.meta.changes || 0;

    // 古いサマリーを削除
    const oldSummaryCutoff = new Date();
    oldSummaryCutoff.setDate(
      oldSummaryCutoff.getDate() - BATCH_CONFIG.OLD_SUMMARY_DAYS
    );

    const deleteSummariesResult = await database
      .prepare(
        `
        DELETE FROM summaries
        WHERE datetime(created_at) < datetime(?)
      `
      )
      .bind(oldSummaryCutoff.toISOString())
      .run();

    stats.summariesDeleted = deleteSummariesResult.meta.changes || 0;

    console.log(BATCH_MESSAGES.COMPLETE_DATA_CLEANUP, stats);
    return stats;
  } catch (error) {
    console.error(BATCH_MESSAGES.ERROR_DATA_CLEANUP, error);
    throw new EnhancedError(BATCH_MESSAGES.ERROR_DATA_CLEANUP, {
      category: ErrorCategory.TEMPORARY,
      isRetryable: true,
      logData: { operation: 'cleanupOldData' },
    });
  }
}

/**
 * API使用量の最適化
 * 重複サマリーの削除、未使用キャッシュの削除など
 */
async function optimizeApiUsage(database: D1Database): Promise<number> {
  console.log(BATCH_MESSAGES.START_API_OPTIMIZATION);

  try {
    let optimizedCount = 0;

    // 重複サマリーを削除
    const duplicateResult = await database
      .prepare(
        `
        DELETE FROM summaries
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM summaries
          GROUP BY user_id, start_date, end_date, summary_content
        )
      `
      )
      .run();

    optimizedCount += duplicateResult.meta.changes || 0;

    // 古い未使用のキャッシュエントリーを削除
    // （エントリーが存在しないユーザーのサマリーを削除）
    const unusedCacheResult = await database
      .prepare(
        `
        DELETE FROM summaries
        WHERE user_id NOT IN (
          SELECT DISTINCT user_id FROM entries
          WHERE datetime(created_at) >= datetime('now', '-30 days')
        )
        AND datetime(created_at) < datetime('now', '-7 days')
      `
      )
      .run();

    optimizedCount += unusedCacheResult.meta.changes || 0;

    console.log(BATCH_MESSAGES.COMPLETE_API_OPTIMIZATION, { optimizedCount });
    return optimizedCount;
  } catch (error) {
    console.error(BATCH_MESSAGES.ERROR_API_OPTIMIZATION, error);
    throw new EnhancedError(BATCH_MESSAGES.ERROR_API_OPTIMIZATION, {
      category: ErrorCategory.TEMPORARY,
      isRetryable: true,
      logData: { operation: 'optimizeApiUsage' },
    });
  }
}

/**
 * バッチ処理のモニタリング統計取得
 */
async function getMonitoringStats(database: D1Database): Promise<{
  totalEntries: number;
  totalSummaries: number;
  totalAnalyses: number;
  totalUsers: number;
  usersProcessed: number;
}> {
  console.log(BATCH_MESSAGES.START_MONITORING);

  try {
    // 総エントリー数
    const entriesResult = await database
      .prepare('SELECT COUNT(*) as count FROM entries')
      .first<{ count: number }>();

    // 総サマリー数
    const summariesResult = await database
      .prepare('SELECT COUNT(*) as count FROM summaries')
      .first<{ count: number }>();

    // 総分析数
    const analysesResult = await database
      .prepare('SELECT COUNT(*) as count FROM analyses')
      .first<{ count: number }>();

    // 総ユーザー数
    const usersResult = await database
      .prepare('SELECT COUNT(DISTINCT user_id) as count FROM entries')
      .first<{ count: number }>();

    // アクティブユーザー数（過去7日間）
    const activeUsersResult = await database
      .prepare(
        `
        SELECT COUNT(DISTINCT user_id) as count
        FROM entries
        WHERE datetime(created_at) >= datetime('now', '-7 days')
      `
      )
      .first<{ count: number }>();

    const stats = {
      totalEntries: entriesResult?.count || 0,
      totalSummaries: summariesResult?.count || 0,
      totalAnalyses: analysesResult?.count || 0,
      totalUsers: usersResult?.count || 0,
      usersProcessed: activeUsersResult?.count || 0,
    };

    console.log(BATCH_MESSAGES.COMPLETE_MONITORING, stats);

    // 使用量アラートのチェック
    await checkUsageAlerts(stats);

    return stats;
  } catch (error) {
    console.error(BATCH_MESSAGES.ERROR_MONITORING, error);
    throw new EnhancedError(BATCH_MESSAGES.ERROR_MONITORING, {
      category: ErrorCategory.TEMPORARY,
      isRetryable: true,
      logData: { operation: 'getMonitoringStats' },
    });
  }
}

/**
 * 過去7日間の日付範囲を取得
 */
function getDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  return { startDate, endDate };
}

/**
 * アクティブユーザーリストを取得
 */
async function getActiveUsers(database: D1Database): Promise<string[]> {
  const result = await database
    .prepare(
      `
      SELECT DISTINCT user_id
      FROM entries
      WHERE datetime(created_at) >= datetime('now', '-' || ? || ' days')
      ORDER BY user_id
    `
    )
    .bind(BATCH_CONFIG.ACTIVE_USER_DAYS)
    .all<{ user_id: string }>();

  return result.results?.map((row) => row.user_id) || [];
}

/**
 * 使用量アラートのチェック
 */
async function checkUsageAlerts(stats: {
  totalEntries: number;
  totalSummaries: number;
  totalAnalyses: number;
  totalUsers: number;
  usersProcessed: number;
}): Promise<void> {
  // データベース使用量アラート（例：エントリー数が10万を超える場合）
  if (stats.totalEntries > 100000) {
    console.warn(
      'データベース使用量アラート: エントリー数が10万を超えています',
      {
        totalEntries: stats.totalEntries,
        timestamp: new Date().toISOString(),
      }
    );
  }

  // アクティブユーザー急増アラート（例：アクティブユーザーが1000人を超える場合）
  if (stats.usersProcessed > 1000) {
    console.warn(
      'アクティブユーザー急増アラート: アクティブユーザー数が1000人を超えています',
      {
        usersProcessed: stats.usersProcessed,
        timestamp: new Date().toISOString(),
      }
    );
  }
}
