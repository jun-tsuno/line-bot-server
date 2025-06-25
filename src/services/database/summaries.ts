import type { D1Database } from '@cloudflare/workers-types';
import type { Summary } from '../../types/database';

export class SummaryService {
  constructor(private db: D1Database) {}

  async create(
    userId: string,
    startDate: string,
    endDate: string,
    summaryContent: string
  ): Promise<Summary> {
    const result = await this.db
      .prepare(`
        INSERT INTO summaries (user_id, start_date, end_date, summary_content) 
        VALUES (?, ?, ?, ?) 
        ON CONFLICT(user_id, start_date, end_date) 
        DO UPDATE SET 
          summary_content = excluded.summary_content,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `)
      .bind(userId, startDate, endDate, summaryContent)
      .first<Summary>();

    if (!result) {
      throw new Error('Failed to create or update summary');
    }

    return result;
  }

  async getLatest(userId: string): Promise<Summary | null> {
    const result = await this.db
      .prepare(`
        SELECT * FROM summaries 
        WHERE user_id = ? 
        ORDER BY end_date DESC 
        LIMIT 1
      `)
      .bind(userId)
      .first<Summary>();

    return result || null;
  }

  async getByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Summary | null> {
    const result = await this.db
      .prepare(`
        SELECT * FROM summaries 
        WHERE user_id = ? 
        AND start_date = ? 
        AND end_date = ?
      `)
      .bind(userId, startDate, endDate)
      .first<Summary>();

    return result || null;
  }
}