import { SERVER_ERRORS, USER_MESSAGES } from '@/constants/messages';
import { healthHandler } from '@/handlers/health';
import { scheduledHandler } from '@/handlers/scheduled';
import { webhookHandler } from '@/handlers/webhook';
import type { Bindings } from '@/types/bindings';
import {
  EnhancedError,
  getUserMessageFromError,
  globalErrorHandler,
} from '@/utils/error-handler';
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Bindings }>();

// グローバルエラーハンドラーミドルウェア
app.onError((error, c) => {
  console.error('Global error handler:', {
    error: error.message,
    stack: error.stack,
    url: c.req.url,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });

  // エラーの分類と詳細情報の取得
  globalErrorHandler.classifyError(error, 'global-error-handler');

  // EnhancedErrorの場合はステータスコードを使用
  if (error instanceof EnhancedError && error.statusCode) {
    return c.json(
      {
        success: false,
        error: error.userMessage || USER_MESSAGES.ANALYSIS_ERROR,
        details: error.message,
      },
      error.statusCode as 400 | 401 | 403 | 404 | 500
    );
  }

  // デフォルトのエラーレスポンス
  return c.json(
    {
      success: false,
      error: SERVER_ERRORS.INTERNAL_SERVER_ERROR,
      message: getUserMessageFromError(error, 'global-error-handler'),
    },
    500
  );
});

// 本番用ルート
app.get('/', healthHandler);
app.post('/webhook', webhookHandler);

// バッチ処理テスト用ルート（開発環境）
app.post('/dev/run-batch', async (c) => {
  try {
    // scheduledハンドラーをモックイベントで呼び出し
    const mockEvent = {
      scheduledTime: Date.now(),
      cron: '0 2 * * *',
    } as ScheduledEvent;
    
    const result = await scheduledHandler(c, mockEvent);
    return result;
  } catch (error) {
    console.error('バッチ処理テスト実行エラー:', error);
    return c.json(
      {
        success: false,
        error: 'バッチ処理の実行中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});


// Cloudflare Workers エクスポート
export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
