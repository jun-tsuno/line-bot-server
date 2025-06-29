/**
 * OpenAI API接続テスト用ハンドラー
 */

import type { Context } from 'hono';
import type { Bindings } from '@/types/bindings';
import { createOpenAIClient } from '@/services/openai';

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
        status: 'success',
        message: 'OpenAI API connection test successful',
        timestamp: new Date().toISOString()
      });
    }
    
    return c.json(
      {
        status: 'error',
        message: 'OpenAI API connection test failed',
        timestamp: new Date().toISOString()
      },
      500
    );
  } catch (error) {
    console.error('OpenAI test handler error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return c.json(
      {
        status: 'error',
        message: `OpenAI API test failed: ${errorMessage}`,
        timestamp: new Date().toISOString()
      },
      500
    );
  }
}