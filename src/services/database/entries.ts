import type { D1Database } from '@cloudflare/workers-types';
import type { Entry } from '../../types/database';

export class EntryService {
  constructor(private db: D1Database) {}

  async create(userId: string, content: string): Promise<Entry> {
    const result = await this.db
      .prepare('INSERT INTO entries (user_id, content) VALUES (?, ?) RETURNING *')
      .bind(userId, content)
      .first<Entry>();

    if (!result) {
      throw new Error('Failed to create entry');
    }

    return result;
  }

  async getByUserId(userId: string, limit = 10): Promise<Entry[]> {
    const results = await this.db
      .prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(userId, limit)
      .all<Entry>();

    return results.results || [];
  }

  async getRecentEntries(userId: string, days = 7): Promise<Entry[]> {
    const results = await this.db
      .prepare(`
        SELECT * FROM entries 
        WHERE user_id = ? 
        AND datetime(created_at) >= datetime('now', '-' || ? || ' days')
        ORDER BY created_at DESC
      `)
      .bind(userId, days)
      .all<Entry>();

    return results.results || [];
  }
}