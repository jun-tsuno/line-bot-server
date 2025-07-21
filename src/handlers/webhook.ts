import {
	ERROR_MESSAGES,
	GENERAL_ERRORS,
	USER_MESSAGES,
} from "@/constants/messages";
import { createLineClient } from "@/services/line/client";
import { handleTextMessage } from "@/services/line/message";
import { validateSignature } from "@/services/line/signature";
import type { Bindings } from "@/types/bindings";
import {
	EnhancedError,
	getUserMessageFromError,
	globalErrorHandler,
} from "@/utils/error-handler";
import type * as line from "@line/bot-sdk";
import type { Context } from "hono";

/**
 * LINE Webhook エンドポイント
 */
export const webhookHandler = async (c: Context<{ Bindings: Bindings }>) => {
	// 署名検証
	const signature = c.req.header("x-line-signature");
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
				// エラーの詳細な処理
				const errorDetails = globalErrorHandler.classifyError(
					error as Error,
					"webhook.handleTextMessage",
				);

				// ユーザー向けエラーメッセージを取得
				const userMessage = getUserMessageFromError(
					error as Error,
					"webhook.handleTextMessage",
				);

				// エラーログの出力（EnhancedErrorの場合は詳細ログが既に出力されている）
				if (!(error instanceof EnhancedError)) {
					console.error(`${GENERAL_ERRORS.LOG_ERROR} in webhook:`, {
						error: (error as Error).message,
						stack: (error as Error).stack,
						event: event.type,
						userId: (event as { source?: { userId?: string } }).source?.userId,
						timestamp: new Date().toISOString(),
						errorDetails,
					});
				}

				// ユーザーにエラーメッセージを送信（可能であれば）
				if (event.type === "message" && "replyToken" in event) {
					try {
						await lineClient.replyMessage({
							replyToken: event.replyToken,
							messages: [
								{
									type: "text",
									text: userMessage,
								},
							],
						});
					} catch (replyError) {
						// 返信エラーはログのみ出力
						console.error("Failed to send error message to user:", replyError);
					}
				}

				// サーバーエラーレスポンスは返さず、LINEには200を返す
				// （LINEのWebhook仕様に従い、エラーでも200を返すことが推奨）
			}
		}),
	);

	return c.json({ success: true }, 200);
};
