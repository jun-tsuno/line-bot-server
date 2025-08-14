import { EVENT_TYPES, LINE_ERRORS, USER_MESSAGES } from '@/constants/messages';
import {
  DiaryAnalysisError,
  createDiaryAnalysisService,
} from '@/services/analysis';
import type { Bindings } from '@/types/bindings';
import type { D1Database } from '@cloudflare/workers-types';
import type * as line from '@line/bot-sdk';
import { replyMessage } from './client';

/**
 * テキストメッセージ受信時の処理
 */
export async function handleTextMessage(
  event: line.WebhookEvent,
  lineClient: line.messagingApi.MessagingApiClient,
  env: Bindings,
  db: D1Database
): Promise<void> {
  if (
    event.type !== EVENT_TYPES.MESSAGE ||
    event.message.type !== EVENT_TYPES.TEXT
  ) {
    return;
  }

  const { replyToken, message, source } = event;
  const { text } = message;

  // ユーザーIDを取得
  const userId = source?.userId;
  if (!userId) {
    console.error(LINE_ERRORS.USER_ID_NOT_FOUND);
    return;
  }

  try {
    // ローディングアニメーションを表示（最大20秒）
    try {
      await lineClient.showLoadingAnimation({
        chatId: userId,
        loadingSeconds: 20,
      });
    } catch (loadingError) {
      // ローディングアニメーションの表示に失敗してもメイン処理は継続
      console.warn(
        'ローディングアニメーションの表示に失敗しました:',
        loadingError
      );
    }

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
    console.error(LINE_ERRORS.PROCESS_DIARY_ENTRY_FAILED, error);

    // エラー時のフォールバック応答
    let errorMessage: string = USER_MESSAGES.ANALYSIS_ERROR;

    if (error instanceof DiaryAnalysisError) {
      // 必要に応じてエラータイプに基づいた適切なメッセージに変更
      if (error.message.includes('API')) {
        errorMessage = USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE;
      }
    }

    const errorResponse: line.messagingApi.TextMessage = {
      type: 'text',
      text: errorMessage,
    };

    await replyMessage(lineClient, replyToken, [errorResponse]);
  }
}
