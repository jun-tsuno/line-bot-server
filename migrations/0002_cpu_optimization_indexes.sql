-- CPU使用量最適化のための複合インデックス追加
-- Phase 1: DB操作最適化

-- 既存の単体インデックスを削除（複合インデックスで置き換えるため）
DROP INDEX IF EXISTS idx_entries_user_id;
DROP INDEX IF EXISTS idx_entries_created_at;
DROP INDEX IF EXISTS idx_analyses_user_id;
DROP INDEX IF EXISTS idx_summaries_user_id;

-- entries テーブル用複合インデックス（user_id + created_at）
CREATE INDEX IF NOT EXISTS idx_entries_user_created ON entries(user_id, created_at);

-- analyses テーブル用複合インデックス（user_id + created_at）
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at);

-- analyses テーブル用 entry_id インデックス（既存維持）
CREATE INDEX IF NOT EXISTS idx_analyses_entry_id ON analyses(entry_id);

-- summaries テーブル用複合インデックス（改善版）
-- 既存のidx_summaries_datesを削除し、より効率的なインデックスに置き換え
DROP INDEX IF EXISTS idx_summaries_dates;
CREATE INDEX IF NOT EXISTS idx_summaries_user_dates ON summaries(user_id, start_date, end_date, updated_at);