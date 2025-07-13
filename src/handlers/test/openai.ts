/**
 * OpenAI API接続テスト用ハンドラー
 */

import type { Context } from 'hono';
import type { Bindings } from '@/types/bindings';
import { createOpenAIClient } from '@/services/openai';
import {
  SUCCESS_MESSAGES,
  OPENAI_ERRORS,
  STATUS,
  GENERAL_ERRORS,
} from '@/constants/messages';

/**
 * OpenAI API接続テストハンドラー
 */
export async function testOpenAIHandler(c: Context<{ Bindings: Bindings }>) {
  try {
    const openaiClient = createOpenAIClient(c.env);
    
    // 接続テスト実行
    const isConnected = await openaiClient.testConnection();
    
    if (isConnected) {
      return c.json({
        status: STATUS.SUCCESS,
        message: SUCCESS_MESSAGES.OPENAI_CONNECTION_TEST,
        timestamp: new Date().toISOString()
      });
    }
    
    return c.json(
      {
        status: STATUS.ERROR,
        message: OPENAI_ERRORS.API_CONNECTION_FAILED,
        timestamp: new Date().toISOString()
      },
      500
    );
  } catch (error) {
    console.error(OPENAI_ERRORS.TEST_HANDLER_ERROR, error);
    
    const errorMessage = error instanceof Error ? error.message : OPENAI_ERRORS.UNKNOWN_ERROR_FALLBACK;
    
    return c.json(
      {
        status: STATUS.ERROR,
        message: `${OPENAI_ERRORS.CONNECTION_TEST_FAILED} ${errorMessage}`,
        timestamp: new Date().toISOString()
      },
      500
    );
  }
}