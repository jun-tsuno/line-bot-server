/**
 * 日記ハンドラー
 * 1. 日記をDBに保存
 * 2. 即座に「分析中」メッセージを返信
 * 3. バックグラウンドで非同期AI分析を実行
 */

import {
  ANALYSIS_ERRORS,
  ERROR_NAMES,
  SERVER_ERRORS,
} from '@/constants/messages';
import { EntryService } from '@/services/database/entries';
import type { Bindings } from '@/types/bindings';
import type { Entry } from '@/types/database';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * 即座に返信する結果
 */
export interface DiaryHandlerResult {
  entry: Entry;
  userMessage: string;
}

/**
 * 日記処理エラー
 */
export class DiaryHandlerError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = ERROR_NAMES.DIARY_ANALYSIS_ERROR;
  }
}

/**
 * 日記を保存して即座に「分析中」メッセージを返信
 */
export async function processDiaryEntry(
  db: D1Database,
  _env: Bindings,
  userId: string,
  diaryContent: string
): Promise<DiaryHandlerResult> {
  try {
    // 入力検証
    if (!userId || !diaryContent || diaryContent.trim().length === 0) {
      throw new DiaryHandlerError('User ID and diary content are required');
    }

    // 日記をDBに保存
    const entryService = new EntryService(db);
    const entry = await entryService.create(userId, diaryContent.trim());

    // 分析中メッセージを返信
    const analysisMessage = [
      '📝 日記を記録しました！',
      '',
      '🔍 AI分析を実行中です...',
      '少々お待ちください。分析が完了次第、詳細な結果をお送りします。',
      '',
      '✨ 今日も日記を書いていただき、ありがとうございます！',
    ].join('\n');

    return {
      entry,
      userMessage: analysisMessage,
    };
  } catch (error) {
    console.error(ANALYSIS_ERRORS.DIARY_ANALYSIS_FAILED, error);

    if (error instanceof DiaryHandlerError) {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : SERVER_ERRORS.UNKNOWN_ERROR;
    throw new DiaryHandlerError(
      `Diary entry processing failed: ${errorMessage}`,
      error as Error
    );
  }
}
