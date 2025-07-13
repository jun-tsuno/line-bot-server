/**
 * 日記分析サービス
 * 日記投稿時の分析処理フローを管理
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types/bindings';
import type { Entry, Analysis } from '@/types/database';
import { EntryService } from '@/services/database/entries';
import { AnalysisService } from '@/services/database/analyses';
import { SummaryService } from '@/services/database/summaries';
import { createOpenAIClient, OpenAIError } from '@/services/openai';
import { 
  DIARY_ANALYSIS_SYSTEM_PROMPT,
  generateDiaryAnalysisPrompt,
  parseAnalysisResult,
  formatAnalysisForUser,
  type AnalysisResult
} from '@/prompts/diary-analysis';
import { 
  ERROR_NAMES, 
  ANALYSIS_ERRORS, 
  OPENAI_ERRORS, 
  SERVER_ERRORS 
} from '@/constants/messages';

/**
 * 日記分析処理結果
 */
export interface DiaryAnalysisResult {
  entry: Entry;
  analysis: Analysis;
  userMessage: string;
}

/**
 * 日記分析エラー
 */
export class DiaryAnalysisError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = ERROR_NAMES.DIARY_ANALYSIS_ERROR;
  }
}

/**
 * 日記分析サービスクラス
 */
export class DiaryAnalysisService {
  private entryService: EntryService;
  private analysisService: AnalysisService;
  private summaryService: SummaryService;

  constructor(private db: D1Database, private env: Bindings) {
    this.entryService = new EntryService(db);
    this.analysisService = new AnalysisService(db);
    this.summaryService = new SummaryService(db);
  }

  /**
   * 日記投稿の完全な分析フローを実行
   */
  async processDiaryEntry(
    userId: string,
    diaryContent: string
  ): Promise<DiaryAnalysisResult> {
    try {
      // 入力検証
      if (!userId || !diaryContent || diaryContent.trim().length === 0) {
        throw new DiaryAnalysisError('User ID and diary content are required');
      }

      // 日記をDBに保存
      const entry = await this.entryService.create(userId, diaryContent.trim());

      // 過去7日間の要約を取得
      const historySummary = await this.getHistorySummary(userId);

      // GPTで分析実行
      const analysisResult = await this.analyzeWithGPT(diaryContent, historySummary);

      // 分析結果をDBに保存
      const analysis = await this.analysisService.create(
        entry.id,
        userId,
        analysisResult
      );

      // ユーザー向けメッセージを生成
      const userMessage = formatAnalysisForUser(analysisResult);

      return {
        entry,
        analysis,
        userMessage
      };
    } catch (error) {
      console.error(ANALYSIS_ERRORS.DIARY_ANALYSIS_FAILED, error);
      
      if (error instanceof DiaryAnalysisError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : SERVER_ERRORS.UNKNOWN_ERROR;
      throw new DiaryAnalysisError(`Analysis processing failed: ${errorMessage}`, error as Error);
    }
  }

  /**
   * 過去7日間の要約を取得
   */
  private async getHistorySummary(userId: string): Promise<string | undefined> {
    try {
      // 過去7日間の要約をキャッシュから取得
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const cachedSummary = await this.summaryService.getSummary(
        userId,
        startDate,
        endDate
      );

      if (cachedSummary) {
        return cachedSummary.summary_content;
      }

      // キャッシュがない場合は過去7日間のエントリーから要約を生成
      const recentEntries = await this.entryService.getRecentEntries(userId, 7);
      
      if (recentEntries.length === 0) {
        return undefined;
      }

      // 簡易的な要約を生成（実装を簡素化）
      const summary = this.generateSimpleSummary(recentEntries);
      
      // 要約をキャッシュに保存
      if (summary) {
        await this.summaryService.create(userId, startDate, endDate, summary);
      }

      return summary;
    } catch (error) {
      console.error(ANALYSIS_ERRORS.HISTORY_SUMMARY_FAILED, error);
      return undefined; // エラーが発生しても分析は続行
    }
  }

  /**
   * 簡易要約を生成
   */
  private generateSimpleSummary(entries: Entry[]): string {
    if (entries.length === 0) return '';
    
    const entryCount = entries.length;
    const totalChars = entries.reduce((sum, entry) => sum + entry.content.length, 0);
    const avgChars = Math.round(totalChars / entryCount);
    
    return `過去7日間で${entryCount}件の日記を投稿。平均${avgChars}文字程度の内容。`;
  }

  /**
   * GPTを使用して日記を分析
   */
  private async analyzeWithGPT(
    diaryContent: string,
    historySummary?: string
  ): Promise<AnalysisResult> {
    try {
      const openaiClient = createOpenAIClient(this.env);
      
      const messages = [
        {
          role: 'system' as const,
          content: DIARY_ANALYSIS_SYSTEM_PROMPT
        },
        {
          role: 'user' as const,
          content: generateDiaryAnalysisPrompt(diaryContent, historySummary)
        }
      ];

      const response = await openaiClient.createChatCompletion(messages, {
        model: 'gpt-3.5-turbo',
        maxTokens: 800,
        temperature: 0.7
      });

      if (!response.choices || response.choices.length === 0) {
        throw new DiaryAnalysisError(OPENAI_ERRORS.NO_RESPONSE);
      }

      const analysisText = response.choices[0].message.content;
      if (!analysisText) {
        throw new DiaryAnalysisError(OPENAI_ERRORS.EMPTY_RESPONSE);
      }

      return parseAnalysisResult(analysisText);
    } catch (error) {
      console.error(ANALYSIS_ERRORS.GPT_ANALYSIS_FAILED, error);
      
      if (error instanceof OpenAIError) {
        throw new DiaryAnalysisError(`OpenAI API error: ${error.message}`, error);
      }
      
      const errorMessage = error instanceof Error ? error.message : SERVER_ERRORS.UNKNOWN_ERROR;
      throw new DiaryAnalysisError(`GPT analysis failed: ${errorMessage}`, error as Error);
    }
  }

  /**
   * ユーザーの最近の分析結果を取得
   */
  async getRecentAnalyses(userId: string, limit = 10): Promise<Analysis[]> {
    try {
      return await this.analysisService.getRecentAnalyses(userId, limit);
    } catch (error) {
      console.error(ANALYSIS_ERRORS.RECENT_ANALYSES_FAILED, error);
      return [];
    }
  }

  /**
   * 特定のエントリーの分析結果を取得
   */
  async getAnalysisByEntryId(entryId: number): Promise<Analysis | null> {
    try {
      return await this.analysisService.getByEntryId(entryId);
    } catch (error) {
      console.error(ANALYSIS_ERRORS.ANALYSIS_BY_ENTRY_ID_FAILED, error);
      return null;
    }
  }
}

/**
 * DiaryAnalysisServiceのファクトリー関数
 */
export function createDiaryAnalysisService(
  db: D1Database,
  env: Bindings
): DiaryAnalysisService {
  return new DiaryAnalysisService(db, env);
}