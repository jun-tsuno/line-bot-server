import type { D1Database } from '@cloudflare/workers-types';
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
      .prepare(`
        INSERT INTO analyses (entry_id, user_id, emotion, themes, patterns, positive_points) 
        VALUES (?, ?, ?, ?, ?, ?) 
        RETURNING *
      `)
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
      throw new Error('Failed to create analysis');
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
    const results = await this.db
      .prepare(`
        SELECT a.* FROM analyses a
        JOIN entries e ON a.entry_id = e.id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `)
      .bind(userId, limit)
      .all<Analysis>();

    return results.results || [];
  }
}