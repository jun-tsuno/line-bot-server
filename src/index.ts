import { Hono } from 'hono';
import type { Bindings } from '@/types/bindings';
import { healthHandler } from '@/handlers/health';
import { webhookHandler } from '@/handlers/webhook';
import { testDbHandler } from '@/handlers/test/db';
import { testOpenAIHandler } from '@/handlers/test/openai';

const app = new Hono<{ Bindings: Bindings }>();

// 本番用ルート
app.get('/', healthHandler);
app.post('/webhook', webhookHandler);

// テスト用ルート
app.get('/test-db', testDbHandler);
app.get('/test-openai', testOpenAIHandler);

export default app;
