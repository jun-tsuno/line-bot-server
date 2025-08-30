import { EVENT_TYPES, LINE_ERRORS, USER_MESSAGES } from '@/constants/messages';
import { executeAsyncAnalysis } from '@/services/async-ai-analysis';
import { DiaryHandlerError, processDiaryEntry } from '@/services/diary-handler';
import type { Bindings } from '@/types/bindings';
import type { D1Database } from '@cloudflare/workers-types';
import type * as line from '@line/bot-sdk';
import type { ExecutionContext } from 'hono';
import { replyMessage } from './client';

/**
 * テキストメッセージ受信時の処理
 */
export async function handleTextMessage(
  event: line.WebhookEvent,
  lineClient: line.messagingApi.MessagingApiClient,
  env: Bindings,
  db: D1Database,
  ctx?: ExecutionContext
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
    // ローディングアニメーションを表示（最大5秒 - 軽量分析用）
    await lineClient.showLoadingAnimation({
      chatId: userId,
      loadingSeconds: 5,
    });

    // 日記を保存して即座に分析中メッセージを返信
    const diaryResult = await processDiaryEntry(db, env, userId, text);

    // 分析中メッセージを即座にユーザーに返信
    const response: line.messagingApi.TextMessage = {
      type: 'text',
      text: diaryResult.userMessage,
    };

    await replyMessage(lineClient, replyToken, [response]);

    // 非同期でAI分析を実行（結果を待たない）
    const asyncPromise = executeAsyncAnalysis(
      db,
      env,
      userId,
      text,
      diaryResult.entry.id,
      lineClient
    ).catch((error) => {
      // 非同期処理のエラーはログのみ（ユーザーには既に応答済み）
      console.error('非同期AI分析でエラーが発生', error);
    });

    // waitUntilでレスポンス完了後も処理を継続
    if (ctx?.waitUntil) {
      ctx.waitUntil(asyncPromise);
    }
  } catch (error) {
    console.error(LINE_ERRORS.PROCESS_DIARY_ENTRY_FAILED, error);

    // エラー時のフォールバック応答
    let errorMessage: string = USER_MESSAGES.ANALYSIS_ERROR;

    if (error instanceof DiaryHandlerError) {
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
