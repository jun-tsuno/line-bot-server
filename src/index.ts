import { Hono } from 'hono';
import type { Bindings } from '@/types/bindings';
import { healthHandler } from '@/handlers/health';
import { webhookHandler } from '@/handlers/webhook';
import { testDbHandler } from '@/handlers/test/db';
import { testOpenAIHandler } from '@/handlers/test/openai';
import { scheduledHandler } from '@/handlers/scheduled';
import { EnhancedError, getUserMessageFromError, globalErrorHandler } from '@/utils/error-handler';
import { SERVER_ERRORS, USER_MESSAGES } from '@/constants/messages';

const app = new Hono<{ Bindings: Bindings }>();

// グローバルエラーハンドラーミドルウェア
app.onError((error, c) => {
  console.error('Global error handler:', {
    error: error.message,
    stack: error.stack,
    url: c.req.url,
    method: c.req.method,
    timestamp: new Date().toISOString()
  });

  // エラーの分類と詳細情報の取得
  const errorDetails = globalErrorHandler.classifyError(error, 'global-error-handler');
  
  // EnhancedErrorの場合はステータスコードを使用
  if (error instanceof EnhancedError && error.statusCode) {
    return c.json(
      { 
        success: false, 
        error: error.userMessage || USER_MESSAGES.ANALYSIS_ERROR,
        details: error.message 
      },
      error.statusCode
    );
  }

  // デフォルトのエラーレスポンス
  return c.json(
    { 
      success: false, 
      error: SERVER_ERRORS.INTERNAL_SERVER_ERROR,
      message: getUserMessageFromError(error, 'global-error-handler')
    },
    500
  );
});

// 本番用ルート
app.get('/', healthHandler);
app.post('/webhook', webhookHandler);

// テスト用ルート
app.get('/test-db', testDbHandler);
app.get('/test-openai', testOpenAIHandler);

// Cloudflare Workers エクスポート
export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
