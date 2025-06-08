import { Hono } from 'hono';
import * as line from '@line/bot-sdk';
import CryptoJS from 'crypto-js';

type Bindings = {
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * ヘルスチェック用
 */
app.get("/", (c) => {
  return c.text("OK");
});

/**
 * メッセージ受信時の処理
 */
app.post('/webhook', async (c) => {
	// 署名検証
	const signature = c.req.header('x-line-signature');
	if (!signature) {
		return c.json({ error: 'No signature' }, 400);
	}

	const rawBody = await c.req.text();
	const channelSecret = c.env.LINE_CHANNEL_SECRET;

	// 署名を生成して検証
	const hash = CryptoJS.HmacSHA256(rawBody, channelSecret).toString(CryptoJS.enc.Base64);

	if (hash !== signature) {
		return c.json({ error: 'Invalid signature' }, 400);
	}

	const config: line.ClientConfig = {
		channelAccessToken: c.env.LINE_CHANNEL_ACCESS_TOKEN
	}
	const client = new line.messagingApi.MessagingApiClient(config);

	const events: line.WebhookEvent[] = JSON.parse(rawBody).events;

	await Promise.all(
		events.map(async (event: line.WebhookEvent) => {
			try {
				if(event.type !== 'message' || event.message.type !== 'text') {
					return;
				}

				const {replyToken, message: { text } = {}} = event;

				const response: line.TextMessage = {
					type: 'text',
					text: `${text} を受信しました`
				}

				const replyMessageRequest: line.messagingApi.ReplyMessageRequest = {
					replyToken,
					messages: [response]
				}

				await client.replyMessage(replyMessageRequest);
			} catch (error) {
				if(error instanceof Error) {
					console.log(error);
				}

				return c.json({ success: false, error: 'Internal Server Error' }, 500);
			}
		})
	)


	return c.json({ success: true }, 200);
})

export default app;