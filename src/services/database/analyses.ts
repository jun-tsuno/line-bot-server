import type { D1Database } from '@cloudflare/workers-types';
import { DATABASE_ERRORS } from '../../constants/messages';
import type { Analysis } from '../../types/database';

export class AnalysisService {
  constructor(private db: D1Database) {}

  async create(
    entryId: number,
    userId: string,
    analysis: {
      emotion?: string;
      themes?: string;
      patterns?: string;
      positive_points?: string;
    }
  ): Promise<Analysis> {
    const result = await this.db
      .prepare(
        `
        INSERT INTO analyses (entry_id, user_id, emotion, themes, patterns, positive_points) 
        VALUES (?, ?, ?, ?, ?, ?) 
        RETURNING *
      `
      )
      .bind(
        entryId,
        userId,
        analysis.emotion || null,
        analysis.themes || null,
        analysis.patterns || null,
        analysis.positive_points || null
      )
      .first<Analysis>();

    if (!result) {
      throw new Error(DATABASE_ERRORS.CREATE_ANALYSIS_FAILED);
    }

    return result;
  }

  async getByEntryId(entryId: number): Promise<Analysis | null> {
    const result = await this.db
      .prepare('SELECT * FROM analyses WHERE entry_id = ?')
      .bind(entryId)
      .first<Analysis>();

    return result || null;
  }

  async getRecentAnalyses(userId: string, limit = 10): Promise<Analysis[]> {
    // CPU最適化: JOINを削除し、直接フィルタリング
    const results = await this.db
      .prepare(
        `
        SELECT * FROM analyses
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `
      )
      .bind(userId, limit)
      .all<Analysis>();

    return results.results || [];
  }

  /**
   * 既存の分析を更新（AI分析結果で上書き）
   */
  async updateAnalysis(
    entryId: number,
    userId: string,
    data: {
      emotion: string;
      themes: string;
      patterns: string;
      positive_points: string;
    }
  ): Promise<void> {
    const result = await this.db
      .prepare(
        `
        UPDATE analyses 
        SET emotion = ?, themes = ?, patterns = ?, positive_points = ?, updated_at = CURRENT_TIMESTAMP
        WHERE entry_id = ? AND user_id = ?
      `
      )
      .bind(
        data.emotion,
        data.themes,
        data.patterns,
        data.positive_points,
        entryId,
        userId
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to update analysis for entry ${entryId}`);
    }
  }
}
