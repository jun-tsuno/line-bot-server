import * as line from '@line/bot-sdk';
import type { D1Database } from '@cloudflare/workers-types';
import { replyMessage } from './client';
import type { Bindings } from '@/types/bindings';
import { createDiaryAnalysisService, DiaryAnalysisError } from '@/services/analysis';

/**
 * テキストメッセージ受信時の処理
 */
export async function handleTextMessage(
  event: line.WebhookEvent,
  lineClient: line.messagingApi.MessagingApiClient,
  env: Bindings,
  db: D1Database
): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const { replyToken, message, source } = event;
  const { text } = message;

  // ユーザーIDを取得
  const userId = source?.userId;
  if (!userId) {
    console.error('User ID not found in event');
    return;
  }

  try {
    // 日記分析サービスを作成
    const analysisService = createDiaryAnalysisService(db, env);

    // 日記として分析処理を実行
    const result = await analysisService.processDiaryEntry(userId, text);

    // 分析結果をユーザーに返信
    const response: line.messagingApi.TextMessage = {
      type: 'text',
      text: result.userMessage,
    };

    await replyMessage(lineClient, replyToken, [response]);
  } catch (error) {
    console.error('Failed to process diary entry:', error);

    // エラー時のフォールバック応答
    let errorMessage = '申し訳ございません。分析処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。';
    
    if (error instanceof DiaryAnalysisError) {
      // 必要に応じてエラータイプに基づいた適切なメッセージに変更
      if (error.message.includes('API')) {
        errorMessage = 'AI分析サービスに一時的な問題が発生しています。しばらく時間をおいて再度お試しください。';
      }
    }

    const errorResponse: line.messagingApi.TextMessage = {
      type: 'text',
      text: errorMessage,
    };

    await replyMessage(lineClient, replyToken, [errorResponse]);
  }
}
