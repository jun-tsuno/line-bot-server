import { Hono } from 'hono';
import type { Bindings } from '@/types/bindings';
import { healthHandler } from '@/handlers/health';
import { webhookHandler } from '@/handlers/webhook';

const app = new Hono<{ Bindings: Bindings }>();

// ルート定義
app.get('/', healthHandler);
app.post('/webhook', webhookHandler);

export default app;
