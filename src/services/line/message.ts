import * as line from '@line/bot-sdk';
import { replyMessage } from './client';

/**
 * テキストメッセージ受信時の処理
 */
export async function handleTextMessage(
  event: line.WebhookEvent,
  lineClient: line.messagingApi.MessagingApiClient
): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const { replyToken, message } = event;
  const { text } = message;

  const response: line.messagingApi.TextMessage = {
    type: 'text',
    text: `${text} を受信しました`,
  };

  await replyMessage(lineClient, replyToken, [response]);
}
