export interface Entry {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: number;
  entry_id: number;
  user_id: string;
  emotion: string | null;
  themes: string | null;
  patterns: string | null;
  positive_points: string | null;
  created_at: string;
}

export interface Summary {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  summary_content: string;
  created_at: string;
  updated_at: string;
}
