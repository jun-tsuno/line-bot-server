/**
 * 履歴要約サービス
 * 過去7日間の日記投稿をGPTで分析・要約し、キャッシュとして保存
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types/bindings';
import type { Entry, Summary } from '@/types/database';
import { EntryService } from '@/services/database/entries';
import { SummaryService } from '@/services/database/summaries';
import { createOpenAIClient, OpenAIError } from '@/services/openai';
import { 
  ANALYSIS_ERRORS, 
  OPENAI_ERRORS, 
  SERVER_ERRORS,
  ERROR_NAMES 
} from '@/constants/messages';

/**
 * 履歴要約エラー
 */
export class HistorySummaryError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = ERROR_NAMES.DIARY_ANALYSIS_ERROR;
  }
}

/**
 * GPTベースの履歴要約サービス
 */
export class HistorySummaryService {
  private entryService: EntryService;
  private summaryService: SummaryService;
  
  // キャッシュ有効期限（24時間）
  private readonly CACHE_DURATION_HOURS = 24;
  // 最小投稿数（要約生成に必要な最小件数）
  private readonly MIN_ENTRIES_FOR_SUMMARY = 2;

  constructor(private db: D1Database, private env: Bindings) {
    this.entryService = new EntryService(db);
    this.summaryService = new SummaryService(db);
  }

  /**
   * 過去7日間の要約を取得または生成
   */
  async getOrCreateSummary(userId: string): Promise<string | undefined> {
    try {
      const { startDate, endDate } = this.getDateRange();
      
      // キャッシュから有効な要約を取得
      const cachedSummary = await this.getValidCachedSummary(userId, startDate, endDate);
      if (cachedSummary) {
        return cachedSummary.summary_content;
      }

      // キャッシュがない場合は新しく要約を生成
      return await this.generateNewSummary(userId, startDate, endDate);
    } catch (error) {
      console.error(ANALYSIS_ERRORS.HISTORY_SUMMARY_FAILED, error);
      return undefined; // エラーが発生しても分析処理は続行
    }
  }

  /**
   * 過去7日間の日付範囲を取得
   */
  private getDateRange(): { startDate: string; endDate: string } {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    
    return { startDate, endDate };
  }

  /**
   * 有効なキャッシュされた要約を取得
   */
  private async getValidCachedSummary(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<Summary | null> {
    const cachedSummary = await this.summaryService.getByDateRange(
      userId, 
      startDate, 
      endDate
    );

    if (!cachedSummary) {
      return null;
    }

    // キャッシュの有効期限をチェック
    const cacheAge = Date.now() - new Date(cachedSummary.updated_at).getTime();
    const cacheAgeHours = cacheAge / (1000 * 60 * 60);

    if (cacheAgeHours > this.CACHE_DURATION_HOURS) {
      // 期限切れキャッシュを削除
      await this.cleanupExpiredCache(userId, startDate, endDate);
      return null;
    }

    return cachedSummary;
  }

  /**
   * 新しい要約を生成してキャッシュに保存
   */
  private async generateNewSummary(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<string | undefined> {
    // 過去7日間のエントリーを取得
    const recentEntries = await this.entryService.getRecentEntries(userId, 7);
    
    if (recentEntries.length < this.MIN_ENTRIES_FOR_SUMMARY) {
      return undefined; // 最小投稿数に満たない場合は要約しない
    }

    // GPTで要約生成
    const summaryContent = await this.generateGPTSummary(recentEntries);
    
    if (!summaryContent) {
      return undefined;
    }

    // 要約をキャッシュに保存
    await this.summaryService.create(userId, startDate, endDate, summaryContent);
    
    return summaryContent;
  }

  /**
   * GPTを使用して要約を生成
   */
  private async generateGPTSummary(entries: Entry[]): Promise<string | undefined> {
    try {
      const openaiClient = createOpenAIClient(this.env);
      
      const entriesText = entries
        .map((entry, index) => `${index + 1}. ${entry.content}`)
        .join('\n\n');

      const systemPrompt = `あなたは日記要約の専門家です。過去7日間の日記投稿を分析し、感情傾向・主要テーマ・思考パターン・成長ポイントを150文字程度で簡潔に要約してください。

要約には以下の要素を含めてください：
- 主な感情傾向（ポジティブ/ネガティブ/変化）
- 繰り返し言及されるテーマや関心事
- 行動パターンや思考の特徴
- 成長や変化の兆し

簡潔で具体的な要約を作成してください。`;

      const userPrompt = `以下の過去7日間の日記投稿を要約してください：

${entriesText}`;

      const response = await openaiClient.createChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: 'gpt-3.5-turbo',
        maxTokens: 200,
        temperature: 0.7
      });

      if (!response.choices || response.choices.length === 0) {
        throw new HistorySummaryError(OPENAI_ERRORS.NO_RESPONSE);
      }

      const summaryContent = response.choices[0].message.content;
      if (!summaryContent) {
        throw new HistorySummaryError(OPENAI_ERRORS.EMPTY_RESPONSE);
      }

      return summaryContent.trim();
    } catch (error) {
      console.error(ANALYSIS_ERRORS.HISTORY_SUMMARY_FAILED, error);
      
      if (error instanceof OpenAIError) {
        throw new HistorySummaryError(`OpenAI API error: ${error.message}`, error);
      }
      
      const errorMessage = error instanceof Error ? error.message : SERVER_ERRORS.UNKNOWN_ERROR;
      throw new HistorySummaryError(`GPT summary generation failed: ${errorMessage}`, error as Error);
    }
  }

  /**
   * 期限切れキャッシュを削除
   */
  private async cleanupExpiredCache(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<void> {
    try {
      // 既存の期限切れキャッシュを削除するため、新しいエントリーで上書き
      await this.summaryService.create(userId, startDate, endDate, '');
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
      // エラーが発生してもメイン処理は続行
    }
  }

  /**
   * 要約統計情報を取得
   */
  async getSummaryStats(userId: string): Promise<{
    totalSummaries: number;
    latestSummaryDate: string | null;
  }> {
    try {
      const latestSummary = await this.summaryService.getLatest(userId);
      
      return {
        totalSummaries: latestSummary ? 1 : 0, // 簡易実装
        latestSummaryDate: latestSummary ? latestSummary.end_date : null
      };
    } catch (error) {
      console.error('Failed to get summary stats:', error);
      return {
        totalSummaries: 0,
        latestSummaryDate: null
      };
    }
  }
}

/**
 * HistorySummaryServiceのファクトリー関数
 */
export function createHistorySummaryService(
  db: D1Database,
  env: Bindings
): HistorySummaryService {
  return new HistorySummaryService(db, env);
}