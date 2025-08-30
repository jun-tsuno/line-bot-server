import * as line from '@line/bot-sdk';
import { LINE_ERRORS } from '../../constants/messages';
import { ERROR_HANDLER_CONFIG } from '../../constants/config';
import {
  EnhancedError,
  ErrorCategory,
  withErrorHandling,
} from '../../utils/error-handler';

export function createLineClient(
  channelAccessToken: string
): line.messagingApi.MessagingApiClient {
  const config: line.ClientConfig = {
    channelAccessToken,
  };
  return new line.messagingApi.MessagingApiClient(config);
}

/**
 * LINE メッセージ送信（エラーハンドリング付き）
 * @param client - LINE クライアント
 * @param replyToken - 返信トークン
 * @param messages - 送信メッセージ(テキスト、画像、スタンプなど)
 */
export async function replyMessage(
  client: line.messagingApi.MessagingApiClient,
  replyToken: string,
  messages: line.messagingApi.Message[]
): Promise<void> {
  return withErrorHandling(
    async () => {
      try {
        const replyMessageRequest: line.messagingApi.ReplyMessageRequest = {
          replyToken,
          messages,
        };
        await client.replyMessage(replyMessageRequest);
      } catch (error) {
        const lineError = error as Error & {
          statusCode?: number;
          retryAfter?: number;
          message?: string;
        };

        // LINE APIエラーの詳細な分類
        if (lineError.statusCode === 429) {
          throw new EnhancedError(LINE_ERRORS.RATE_LIMITED, {
            category: ErrorCategory.RATE_LIMIT,
            isRetryable: true,
            statusCode: 429,
            retryAfter: lineError.retryAfter,
            logData: { replyToken, messageCount: messages.length },
          });
        }

        if (lineError.statusCode === 400) {
          throw new EnhancedError(LINE_ERRORS.INVALID_REQUEST, {
            category: ErrorCategory.PERMANENT,
            isRetryable: false,
            statusCode: 400,
            logData: {
              replyToken,
              messageCount: messages.length,
              error: lineError.message,
            },
          });
        }

        if (lineError.statusCode && lineError.statusCode >= 500) {
          throw new EnhancedError(LINE_ERRORS.API_REQUEST_FAILED, {
            category: ErrorCategory.TEMPORARY,
            isRetryable: true,
            statusCode: lineError.statusCode,
            logData: { replyToken, messageCount: messages.length },
          });
        }

        // 一般的なエラー
        throw new EnhancedError(LINE_ERRORS.MESSAGE_SEND_FAILED, {
          category: ErrorCategory.NETWORK,
          isRetryable: true,
          logData: {
            replyToken,
            messageCount: messages.length,
            error: lineError.message,
          },
        });
      }
    },
    'line.replyMessage',
    {
      useCircuitBreaker: true,
      circuitKey: 'line-api',
      retryConfig: {
        maxRetries: ERROR_HANDLER_CONFIG.MAX_LINE_RETRIES,
        retryCondition: (error) => {
          // 400番台のエラー（クライアントエラー）は再試行しない
          const statusCode = (error as Error & { statusCode?: number })
            .statusCode;
          return !statusCode || statusCode < 400 || statusCode >= 500;
        },
      },
    }
  );
}
