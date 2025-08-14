import { DatabaseService } from '@/services/database';
import type { Bindings } from '@/types/bindings';
import type { Context } from 'hono';

export const testDbHandler = async (c: Context<{ Bindings: Bindings }>) => {
  const db = new DatabaseService(c.env.DB);

  try {
    // テストデータの作成
    const entry = await db.entries.create(
      'test-user-123',
      'これはテスト投稿です。今日は良い天気でした。'
    );

    // 分析データの作成
    const analysis = await db.analyses.create(entry.id, entry.user_id, {
      emotion: 'ポジティブ',
      themes: '天気、日常',
      patterns: '前向きな思考パターン',
      positive_points: '良い天気を楽しむ姿勢が素晴らしいです',
    });

    // データの取得
    const recentEntries = await db.entries.getRecentEntries('test-user-123');

    return c.json({
      message: 'D1データベースのテストが成功しました',
      data: {
        entry,
        analysis,
        recentEntriesCount: recentEntries.length,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: 'データベースエラー',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
};
