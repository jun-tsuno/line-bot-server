import type { Context } from 'hono';
import * as line from '@line/bot-sdk';
import type { Bindings } from '@/types/bindings';
import { validateSignature } from '@/services/line/signature';
import { createLineClient } from '@/services/line/client';
import { handleTextMessage } from '@/services/line/message';
import { ERROR_MESSAGES } from '@/constants/messages';

/**
 * LINE Webhook エンドポイント
 */
export const webhookHandler = async (c: Context<{ Bindings: Bindings }>) => {
  // 署名検証
  const signature = c.req.header('x-line-signature');
  if (!signature) {
    return c.json({ error: ERROR_MESSAGES.NO_SIGNATURE }, 400);
  }

  const rawBody = await c.req.text();
  const channelSecret = c.env.LINE_CHANNEL_SECRET;

  // 署名を検証
  if (!validateSignature(rawBody, channelSecret, signature)) {
    return c.json({ error: ERROR_MESSAGES.INVALID_SIGNATURE }, 400);
  }

  const lineClient = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
  const events: line.WebhookEvent[] = JSON.parse(rawBody).events;

  await Promise.all(
    events.map(async (event: line.WebhookEvent) => {
      try {
        await handleTextMessage(event, lineClient, c.env, c.env.DB);
      } catch (error) {
        if (error instanceof Error) {
          console.error('Error:', error);
        }
        return c.json(
          { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR },
          500
        );
      }
    })
  );

  return c.json({ success: true }, 200);
};
