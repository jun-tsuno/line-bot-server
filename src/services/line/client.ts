import * as line from '@line/bot-sdk';

export function createLineClient(
  channelAccessToken: string
): line.messagingApi.MessagingApiClient {
  const config: line.ClientConfig = {
    channelAccessToken,
  };
  return new line.messagingApi.MessagingApiClient(config);
}

/**
 * LINE メッセージ送信
 * @param client - LINE クライアント
 * @param replyToken - 返信トークン
 * @param messages - 送信メッセージ(テキスト、画像、スタンプなど)
 */
export async function replyMessage(
  client: line.messagingApi.MessagingApiClient,
  replyToken: string,
  messages: line.messagingApi.Message[]
): Promise<void> {
  const replyMessageRequest: line.messagingApi.ReplyMessageRequest = {
    replyToken,
    messages,
  };
  await client.replyMessage(replyMessageRequest);
}
