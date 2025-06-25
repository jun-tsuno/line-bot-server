import type { D1Database } from '@cloudflare/workers-types';
import { EntryService } from './entries';
import { AnalysisService } from './analyses';
import { SummaryService } from './summaries';

export class DatabaseService {
  public entries: EntryService;
  public analyses: AnalysisService;
  public summaries: SummaryService;

  constructor(db: D1Database) {
    this.entries = new EntryService(db);
    this.analyses = new AnalysisService(db);
    this.summaries = new SummaryService(db);
  }
}

export * from '../../types/database';