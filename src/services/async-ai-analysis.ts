/**
 * 非同期AI分析サービス
 * 日記保存後に非同期でAI分析を実行し、結果をpushMessageで送信
 */

import { ANALYSIS_FORMAT } from '@/constants/messages';
import { OPTIMIZED_AI_CONFIG } from '@/constants/config';
import {
  DIARY_ANALYSIS_SYSTEM_PROMPT,
  generateDiaryAnalysisPrompt,
  parseAnalysisResult,
  type AnalysisResult,
} from '@/prompts/diary-analysis';
import { AnalysisService } from '@/services/database/analyses';
import { createOpenAIClient, OpenAIError } from '@/services/openai';
import { HistorySummaryService } from '@/services/summary';
import type { Bindings } from '@/types/bindings';
import type { D1Database } from '@cloudflare/workers-types';
import type * as line from '@line/bot-sdk';

/**
 * 非同期でAI分析を実行
 */
export async function executeAsyncAnalysis(
  db: D1Database,
  env: Bindings,
  userId: string,
  diaryContent: string,
  entryId: number,
  lineClient: line.messagingApi.MessagingApiClient
): Promise<void> {
  console.log('非同期AI分析を開始');

  const analysisService = new AnalysisService(db);
  const historySummaryService = new HistorySummaryService(db, env);

  try {
    // 履歴要約を取得（タイムアウト付き）
    const historySummary = await Promise.race([
      historySummaryService.getOrCreateSummary(userId),
      new Promise<undefined>((resolve) => {
        setTimeout(() => {
          console.warn('履歴要約取得タイムアウト');
          resolve(undefined);
        }, 5000); // 5秒タイムアウト
      }),
    ]).catch((error) => {
      console.warn('履歴要約取得失敗', error);
      return undefined;
    });

    // AI分析を実行
    const aiResult = await executeAIAnalysis(env, diaryContent, historySummary);

    // AI分析結果をDBに保存
    await analysisService.create(entryId, userId, {
      emotion: aiResult.emotion,
      themes: aiResult.themes,
      patterns: aiResult.patterns,
      positive_points: aiResult.positive_points,
    });

    // AI分析結果をpushMessageで送信
    const message = formatAIAnalysisMessage(aiResult);

    await lineClient.pushMessage({
      to: userId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    });

    console.log('非同期AI分析が完了しました');
  } catch (error) {
    // エラーログを記録
    console.error('非同期AI分析でエラーが発生', error);

    // ユーザーにエラーメッセージを送信
    try {
      const errorMessage = [
        '⚠️ AI分析でエラーが発生しました',
        '',
        'AI分析の実行中に問題が発生しましたが、',
        '日記は正常に保存されています。',
        '',
        'しばらく時間をおいてから再度お試しください。',
      ].join('\n');

      await lineClient.pushMessage({
        to: userId,
        messages: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
      });
      console.log('エラーメッセージ送信完了');
    } catch (pushError) {
      console.error('エラーメッセージの送信に失敗', pushError);
    }
  }
}

/**
 * AI分析実行（タイムアウト付き）
 */
async function executeAIAnalysis(
  env: Bindings,
  diaryContent: string,
  historySummary?: string
): Promise<AnalysisResult> {
  const openaiClient = createOpenAIClient(env);

  const messages = [
    {
      role: 'system' as const,
      content: DIARY_ANALYSIS_SYSTEM_PROMPT,
    },
    {
      role: 'user' as const,
      content: generateDiaryAnalysisPrompt(diaryContent, historySummary),
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

  return parseAnalysisResult(analysisText);
}

/**
 * AI分析結果をフォーマット
 */
function formatAIAnalysisMessage(analysis: AnalysisResult): string {
  return [
    '🤖 AI詳細分析が完了しました',
    '',
    `${ANALYSIS_FORMAT.EMOTION_SECTION}`,
    analysis.emotion,
    '',
    `${ANALYSIS_FORMAT.THEMES_SECTION}`,
    analysis.themes,
    '',
    `${ANALYSIS_FORMAT.PATTERNS_SECTION}`,
    analysis.patterns,
    '',
    `${ANALYSIS_FORMAT.POSITIVE_SECTION}`,
    analysis.positive_points,
    '',
    '💡 この分析はAIによる詳細な解析結果です。',
    '先ほどの「分析中」メッセージと合わせて、自己理解にお役立てください。',
  ].join('\n');
}
