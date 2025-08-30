/**
 * 非同期AI分析サービス
 * 日記保存後に非同期でAI分析を実行し、結果をpushMessageで送信
 */

import { ANALYSIS_FORMAT, OPTIMIZED_AI_CONFIG } from '@/constants/messages';
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
      })
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
        '',
        '📝 今日も日記を書いていただき、ありがとうございます！',
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
): Promise<{
  emotion: string;
  themes: string;
  patterns: string;
  positive_points: string;
}> {
  const openaiClient = createOpenAIClient(env);

  const messages = [
    {
      role: 'system' as const,
      content: `あなたは優秀な日記分析AIです。ユーザーの日記から感情や思考を理解し、
温かく建設的なフィードバックを提供します。

以下の形式で分析結果を提供してください：
1. 感情分析: 現在の感情状態を1-2文で説明
2. 主なテーマ: 日記の主要なトピックを箇条書きで
3. 行動パターン: 観察される思考や行動のパターン
4. ポジティブポイント: 励ましや成長点の指摘`,
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

  return parseAIResponse(analysisText);
}

/**
 * AI応答をパース
 */
function parseAIResponse(response: string): {
  emotion: string;
  themes: string;
  patterns: string;
  positive_points: string;
} {
  // 応答を行ごとに分割
  const lines = response.split('\n').filter((line) => line.trim());

  let emotion = '';
  let themes = '';
  let patterns = '';
  let positive_points = '';

  let currentSection = '';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('感情分析') || lowerLine.includes('感情')) {
      currentSection = 'emotion';
    } else if (lowerLine.includes('テーマ') || lowerLine.includes('トピック')) {
      currentSection = 'themes';
    } else if (lowerLine.includes('パターン') || lowerLine.includes('傾向')) {
      currentSection = 'patterns';
    } else if (
      lowerLine.includes('ポジティブ') ||
      lowerLine.includes('励まし')
    ) {
      currentSection = 'positive';
    } else {
      // セクションに応じて内容を追加
      const content = line
        .replace(/^\d+\.\s*/, '')
        .replace(/^[-*]\s*/, '')
        .trim();
      if (content) {
        switch (currentSection) {
          case 'emotion':
            emotion += (emotion ? ' ' : '') + content;
            break;
          case 'themes':
            themes += (themes ? ', ' : '') + content;
            break;
          case 'patterns':
            patterns += (patterns ? ' ' : '') + content;
            break;
          case 'positive':
            positive_points += (positive_points ? ' ' : '') + content;
            break;
        }
      }
    }
  }

  // フォールバック値を設定
  return {
    emotion: emotion || '感情状態を分析しました。',
    themes: themes || '日常の出来事',
    patterns: patterns || '継続的な振り返りの習慣',
    positive_points: positive_points || '日記を続けている素晴らしい習慣です。',
  };
}

/**
 * AI分析結果をフォーマット
 */
function formatAIAnalysisMessage(analysis: {
  emotion: string;
  themes: string;
  patterns: string;
  positive_points: string;
}): string {
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

