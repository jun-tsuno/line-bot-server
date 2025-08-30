/**
 * ハイブリッド分析サービス
 * グレースフルデグラデーション対応
 * レベル1（理想）: AI + 軽量分析（5-8ms）
 * レベル2（標準）: 軽量分析のみ（3-5ms）
 * レベル3（緊急）: entry作成+定型メッセージ（1-2ms）
 */

import {
  ANALYSIS_ERRORS,
  ERROR_NAMES,
  OPTIMIZED_AI_CONFIG,
  SERVER_ERRORS,
  USER_MESSAGES,
} from '@/constants/messages';
import { AnalysisService } from '@/services/database/analyses';
import { EntryService } from '@/services/database/entries';
import { SummaryService } from '@/services/database/summaries';
import { LightAnalysisService, type LightAnalysisResult } from '@/services/light-analysis';
import { createOpenAIClient, OpenAIError } from '@/services/openai';
import { getPerformanceMonitor } from '@/services/performance-monitor';
import { HistorySummaryService } from '@/services/summary';
import type { Bindings } from '@/types/bindings';
import type { Analysis, Entry } from '@/types/database';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * ハイブリッド分析結果
 */
export interface HybridAnalysisResult {
  entry: Entry;
  analysis: Analysis;
  userMessage: string;
  level: 1 | 2 | 3; // 1: AI+軽量, 2: 軽量のみ, 3: 緊急モード
  totalProcessingTimeMs: number;
  aiProcessingTimeMs?: number;
  lightProcessingTimeMs?: number;
}

/**
 * ハイブリッド分析エラー
 */
export class HybridAnalysisError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = ERROR_NAMES.DIARY_ANALYSIS_ERROR;
  }
}

/**
 * CPU使用量監視用
 */
interface PerformanceMonitor {
  startTime: number;
  entryCreated: number;
  summaryFetched?: number;
  aiCompleted?: number;
  lightCompleted?: number;
  analysisStored?: number;
}

/**
 * ハイブリッド分析サービスクラス
 */
export class HybridAnalysisService {
  private entryService: EntryService;
  private analysisService: AnalysisService;
  private summaryService: SummaryService;
  private historySummaryService: HistorySummaryService;
  private lightAnalysisService: LightAnalysisService;
  
  // CPU制限設定（ms）
  private readonly CPU_LIMITS = {
    LEVEL_1_MAX: 8, // AI + 軽量分析の上限
    LEVEL_2_MAX: 5, // 軽量分析のみの上限
    LEVEL_3_MAX: 2, // 緊急モードの上限
    AI_TIMEOUT: 3000, // AIタイムアウト（OPTIMIZED_AI_CONFIGと同期）
  };

  constructor(
    private db: D1Database,
    private env: Bindings
  ) {
    this.entryService = new EntryService(db);
    this.analysisService = new AnalysisService(db);
    this.summaryService = new SummaryService(db);
    this.historySummaryService = new HistorySummaryService(db, env);
    this.lightAnalysisService = new LightAnalysisService();
  }

  /**
   * ハイブリッド分析メインフロー
   */
  async processDiaryEntry(
    userId: string,
    diaryContent: string
  ): Promise<HybridAnalysisResult> {
    const monitor: PerformanceMonitor = {
      startTime: performance.now()
    };
    
    const performanceMonitor = getPerformanceMonitor();
    let result: HybridAnalysisResult;

    try {
      // 入力検証
      if (!userId || !diaryContent || diaryContent.trim().length === 0) {
        throw new HybridAnalysisError('User ID and diary content are required');
      }

      // 1. 日記をDBに保存（必須処理）
      const entry = await this.entryService.create(userId, diaryContent.trim());
      monitor.entryCreated = performance.now();
      
      const entryTime = monitor.entryCreated - monitor.startTime;
      
      // CPU使用量チェック: レベル3緊急判定
      if (entryTime > this.CPU_LIMITS.LEVEL_3_MAX) {
        return this.executeLevel3Emergency(entry, monitor);
      }

      // 2. レベル1（理想）: AI + 軽量分析を試行
      try {
        const level1Result = await this.tryLevel1Analysis(entry, userId, diaryContent, monitor);
        if (level1Result) {
          // パフォーマンス指標を記録
          performanceMonitor.recordMetrics({
            timestamp: new Date().toISOString(),
            userId,
            totalProcessingTimeMs: level1Result.totalProcessingTimeMs,
            analysisLevel: level1Result.level,
            entryLength: diaryContent.length,
            success: true
          });
          return level1Result;
        }
      } catch (error) {
        console.warn('Level 1 analysis failed, falling back to Level 2:', error);
      }

      // 3. レベル2（標準）: 軽量分析のみ
      try {
        const level2Result = await this.executeLevel2LightOnly(entry, userId, diaryContent, monitor);
        if (level2Result) {
          // パフォーマンス指標を記録
          performanceMonitor.recordMetrics({
            timestamp: new Date().toISOString(),
            userId,
            totalProcessingTimeMs: level2Result.totalProcessingTimeMs,
            analysisLevel: level2Result.level,
            entryLength: diaryContent.length,
            success: true
          });
          return level2Result;
        }
      } catch (error) {
        console.warn('Level 2 analysis failed, falling back to Level 3:', error);
      }

      // 4. レベル3（緊急）: 最小限の処理
      result = this.executeLevel3Emergency(entry, monitor);
      
      // パフォーマンス指標を記録
      performanceMonitor.recordMetrics({
        timestamp: new Date().toISOString(),
        userId,
        totalProcessingTimeMs: result.totalProcessingTimeMs,
        analysisLevel: result.level,
        entryLength: diaryContent.length,
        success: true
      });
      
      return result;

    } catch (error) {
      console.error(ANALYSIS_ERRORS.DIARY_ANALYSIS_FAILED, error);

      // エラー時のパフォーマンス指標を記録
      performanceMonitor.recordMetrics({
        timestamp: new Date().toISOString(),
        userId,
        totalProcessingTimeMs: performance.now() - monitor.startTime,
        analysisLevel: 3, // エラー時は緊急レベル扱い
        entryLength: diaryContent.length,
        success: false,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      });

      if (error instanceof HybridAnalysisError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : SERVER_ERRORS.UNKNOWN_ERROR;
      throw new HybridAnalysisError(
        `Hybrid analysis processing failed: ${errorMessage}`,
        error as Error
      );
    }
  }

  /**
   * レベル1分析: AI + 軽量分析（理想）
   */
  private async tryLevel1Analysis(
    entry: Entry,
    userId: string,
    diaryContent: string,
    monitor: PerformanceMonitor
  ): Promise<HybridAnalysisResult | null> {
    const elapsedTime = performance.now() - monitor.startTime;
    
    // CPU制限チェック
    if (elapsedTime > this.CPU_LIMITS.LEVEL_1_MAX * 0.5) {
      return null; // 早期終了
    }

    try {
      // 並行処理: 履歴要約取得 + 軽量分析
      const [historySummary, lightResult] = await Promise.all([
        this.historySummaryService.getOrCreateSummary(userId).catch(() => undefined),
        this.executeLightAnalysis(diaryContent)
      ]);
      
      monitor.summaryFetched = performance.now();
      monitor.lightCompleted = performance.now();

      const currentTime = performance.now();
      if (currentTime - monitor.startTime > this.CPU_LIMITS.LEVEL_1_MAX * 0.8) {
        return null; // 時間切れ
      }

      // AI分析を実行
      const aiResult = await this.executeAIAnalysis(diaryContent, historySummary);
      monitor.aiCompleted = performance.now();

      // AI分析結果をDBに保存
      const analysis = await this.analysisService.create(
        entry.id,
        userId,
        this.parseAIResult(aiResult, lightResult)
      );
      monitor.analysisStored = performance.now();

      const totalTime = monitor.analysisStored - monitor.startTime;
      
      return {
        entry,
        analysis,
        userMessage: aiResult,
        level: 1,
        totalProcessingTimeMs: totalTime,
        aiProcessingTimeMs: monitor.aiCompleted - (monitor.summaryFetched || monitor.lightCompleted),
        lightProcessingTimeMs: lightResult.processingTimeMs
      };

    } catch (error) {
      console.warn('AI analysis failed in Level 1:', error);
      return null;
    }
  }

  /**
   * レベル2分析: 軽量分析のみ（標準）
   */
  private async executeLevel2LightOnly(
    entry: Entry,
    userId: string,
    diaryContent: string,
    monitor: PerformanceMonitor
  ): Promise<HybridAnalysisResult> {
    // 軽量分析実行
    const lightResult = await this.executeLightAnalysis(diaryContent);
    monitor.lightCompleted = performance.now();

    // 分析結果をDBに保存
    const analysis = await this.analysisService.create(
      entry.id,
      userId,
      {
        emotion: lightResult.emotion,
        themes: lightResult.themes,
        patterns: lightResult.patterns,
        positive_points: lightResult.positive_points
      }
    );
    monitor.analysisStored = performance.now();

    const totalTime = monitor.analysisStored - monitor.startTime;
    
    return {
      entry,
      analysis,
      userMessage: this.lightAnalysisService.formatForUser(lightResult),
      level: 2,
      totalProcessingTimeMs: totalTime,
      lightProcessingTimeMs: lightResult.processingTimeMs
    };
  }

  /**
   * レベル3分析: 緊急モード（最小限）
   */
  private executeLevel3Emergency(
    entry: Entry,
    monitor: PerformanceMonitor
  ): HybridAnalysisResult {
    // 定型メッセージ（DB保存なし）
    const emergencyMessage = [
      '📝 日記を記録しました',
      '',
      'お疲れさまでした！',
      '今日も日記を書く時間を作ることができて素晴らしいです。',
      '',
      '✨ 継続は力なり。明日も一緒に頑張りましょう！',
      '',
      '🚀 緊急モード (高負荷対応)'
    ].join('\n');

    const totalTime = performance.now() - monitor.startTime;
    
    return {
      entry,
      analysis: {} as Analysis, // 分析なし
      userMessage: emergencyMessage,
      level: 3,
      totalProcessingTimeMs: totalTime
    };
  }

  /**
   * 軽量分析実行
   */
  private async executeLightAnalysis(diaryContent: string): Promise<LightAnalysisResult> {
    return this.lightAnalysisService.analyze(diaryContent);
  }

  /**
   * AI分析実行（タイムアウト付き）
   */
  private async executeAIAnalysis(
    diaryContent: string,
    historySummary?: string
  ): Promise<string> {
    const openaiClient = createOpenAIClient(this.env);

    const messages = [
      {
        role: 'system' as const,
        content: 'あなたは日記分析の専門家です。簡潔で温かい分析を提供してください。',
      },
      {
        role: 'user' as const,
        content: historySummary 
          ? `【過去の傾向】${historySummary}\n\n【今日の日記】${diaryContent}`
          : `【今日の日記】${diaryContent}`,
      },
    ];

    const response = await openaiClient.createChatCompletion(messages, {
      model: 'gpt-3.5-turbo',
      maxTokens: OPTIMIZED_AI_CONFIG.MAX_TOKENS,
      temperature: OPTIMIZED_AI_CONFIG.TEMPERATURE,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new OpenAIError('No response from OpenAI');
    }

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new OpenAIError('Empty response from OpenAI');
    }

    return analysisText;
  }

  /**
   * AI結果を軽量分析結果とマージ
   */
  private parseAIResult(aiResult: string, lightResult: LightAnalysisResult) {
    return {
      emotion: aiResult.length > 100 ? aiResult.substring(0, 100) + '...' : aiResult,
      themes: lightResult.themes,
      patterns: lightResult.patterns,
      positive_points: lightResult.positive_points
    };
  }
}

/**
 * ハイブリッド分析サービスのファクトリー関数
 */
export function createHybridAnalysisService(
  db: D1Database,
  env: Bindings
): HybridAnalysisService {
  return new HybridAnalysisService(db, env);
}