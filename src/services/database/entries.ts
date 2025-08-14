import type { D1Database } from '@cloudflare/workers-types';
import {
  DATABASE_ERRORS,
  ERROR_HANDLER_CONFIG,
} from '../../constants/messages';
import type { Entry } from '../../types/database';
import {
  EnhancedError,
  ErrorCategory,
  withErrorHandling,
} from '../../utils/error-handler';

export class EntryService {
  constructor(private db: D1Database) {}

  async create(userId: string, content: string): Promise<Entry> {
    return withErrorHandling(
      async () => {
        const result = await this.db
          .prepare(
            'INSERT INTO entries (user_id, content) VALUES (?, ?) RETURNING *'
          )
          .bind(userId, content)
          .first<Entry>();

        if (!result) {
          throw new EnhancedError(DATABASE_ERRORS.CREATE_ENTRY_FAILED, {
            category: ErrorCategory.PERMANENT,
            isRetryable: false,
            logData: { userId, operation: 'create_entry' },
          });
        }

        return result;
      },
      'database.entries.create',
      {
        useCircuitBreaker: true,
        circuitKey: 'database',
        retryConfig: {
          maxRetries: ERROR_HANDLER_CONFIG.MAX_DB_RETRIES,
          retryCondition: (error) => {
            // SQLの制約違反などは再試行しない
            return (
              !error.message.includes('UNIQUE constraint') &&
              !error.message.includes('NOT NULL constraint') &&
              !error.message.includes('CHECK constraint')
            );
          },
        },
      }
    );
  }

  async getByUserId(userId: string, limit = 10): Promise<Entry[]> {
    return withErrorHandling(
      async () => {
        const results = await this.db
          .prepare(
            'SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
          )
          .bind(userId, limit)
          .all<Entry>();

        return results.results || [];
      },
      'database.entries.getByUserId',
      {
        useCircuitBreaker: true,
        circuitKey: 'database',
        retryConfig: {
          maxRetries: ERROR_HANDLER_CONFIG.MAX_DB_RETRIES,
        },
      }
    );
  }

  async getRecentEntries(userId: string, days = 7): Promise<Entry[]> {
    return withErrorHandling(
      async () => {
        const results = await this.db
          .prepare(
            `
            SELECT * FROM entries 
            WHERE user_id = ? 
            AND datetime(created_at) >= datetime('now', '-' || ? || ' days')
            ORDER BY created_at DESC
          `
          )
          .bind(userId, days)
          .all<Entry>();

        return results.results || [];
      },
      'database.entries.getRecentEntries',
      {
        useCircuitBreaker: true,
        circuitKey: 'database',
        retryConfig: {
          maxRetries: ERROR_HANDLER_CONFIG.MAX_DB_RETRIES,
        },
      }
    );
  }
}
