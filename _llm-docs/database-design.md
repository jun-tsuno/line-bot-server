# 🗃️ データベース設計詳細

## 概要

AI日記リフレクションBotのデータベース設計について詳細に説明します。Cloudflare D1（SQLiteベース）を使用し、高速なエッジ実行環境での最適化を図っています。

---

## 🏗️ データベースアーキテクチャ

```
Cloudflare D1 (SQLite)
├── 📊 entries     - 日記エントリー（メインテーブル）
├── 📈 analyses    - AI分析結果（エントリーと1:1関係）
└── 💾 summaries   - 履歴要約キャッシュ（ユーザー別）
```

### 技術仕様
- **データベース**: Cloudflare D1
- **エンジン**: SQLite（サーバーレス）
- **レプリケーション**: グローバルエッジレプリケーション
- **トランザクション**: ACID準拠
- **接続**: Worker実行時の自動接続

---

## 📊 テーブル設計

### 1. entries（日記エントリー）

ユーザーが投稿した日記の本文を保存するメインテーブル

```sql
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### カラム詳細

| カラム名 | 型 | 制約 | 説明 |
|----------|---|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 一意識別子（自動増分） |
| `user_id` | TEXT | NOT NULL | LINEユーザーID（U4af4980629...形式） |
| `content` | TEXT | NOT NULL | 日記本文（最大1MB） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 作成日時（UTC） |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新日時（UTC） |

#### インデックス

```sql
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
```

#### データ例

```sql
INSERT INTO entries VALUES (
    1,
    'U4af4980629abc123',
    '今日は仕事で大きなプロジェクトが完了した。チーム全員で頑張った成果だと思う。達成感があって嬉しい。',
    '2025-07-21 10:30:00',
    '2025-07-21 10:30:00'
);
```

#### 使用用途
- **保存**: ユーザーからの日記投稿を即座に保存
- **検索**: ユーザー別・時系列での日記取得
- **分析**: GPT分析の入力データとして使用
- **履歴**: 要約生成時の過去7日間データ取得

---

### 2. analyses（AI分析結果）

各日記エントリーに対するGPT-3.5-turboの分析結果を保存

```sql
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    emotion TEXT,
    themes TEXT,
    patterns TEXT,
    positive_points TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);
```

#### カラム詳細

| カラム名 | 型 | 制約 | 説明 |
|----------|---|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 一意識別子（自動増分） |
| `entry_id` | INTEGER | NOT NULL, FOREIGN KEY | 対応する日記エントリーID |
| `user_id` | TEXT | NOT NULL | LINEユーザーID（冗長化：パフォーマンス最適化） |
| `emotion` | TEXT | - | 感情分析結果（JSON形式または自然文） |
| `themes` | TEXT | - | 主要テーマ・キーワード |
| `patterns` | TEXT | - | 思考パターン・行動傾向 |
| `positive_points` | TEXT | - | ポジティブ要素・励まし |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 分析実行日時（UTC） |

#### インデックス

```sql
CREATE INDEX IF NOT EXISTS idx_analyses_entry_id ON analyses(entry_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
```

#### 外部キー制約
- **CASCADE削除**: エントリー削除時に関連分析も自動削除
- **参照整合性**: 存在しないentry_idは挿入不可

#### データ例

```sql
INSERT INTO analyses VALUES (
    1,
    1,
    'U4af4980629abc123',
    '達成感、満足感が強く感じられます。',
    'チームワーク、仕事の成果、プロジェクト完了',
    '協力的な姿勢、成果を仲間と共有する傾向',
    'チーム全体での成功を喜べる協調性が素晴らしいです。',
    '2025-07-21 10:35:00'
);
```

#### 使用用途
- **保存**: GPT分析結果の永続化
- **表示**: ユーザーへの分析結果送信
- **履歴**: 過去の分析傾向の参照
- **要約**: サマリー生成時の参考データ

---

### 3. summaries（履歴要約キャッシュ）

過去7日間の日記要約をキャッシュとして保存（GPTトークン最適化）

```sql
CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    summary_content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, start_date, end_date)
);
```

#### カラム詳細

| カラム名 | 型 | 制約 | 説明 |
|----------|---|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 一意識別子（自動増分） |
| `user_id` | TEXT | NOT NULL | LINEユーザーID |
| `start_date` | DATE | NOT NULL | 要約対象期間開始日（YYYY-MM-DD） |
| `end_date` | DATE | NOT NULL | 要約対象期間終了日（YYYY-MM-DD） |
| `summary_content` | TEXT | NOT NULL | GPT生成の要約文（最大500文字程度） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 要約作成日時（UTC） |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 要約更新日時（UTC） |

#### ユニーク制約

```sql
UNIQUE(user_id, start_date, end_date)
```
- 同一ユーザー・同一期間の重複要約を防止

#### インデックス

```sql
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_dates ON summaries(user_id, start_date, end_date);
```

#### データ例

```sql
INSERT INTO summaries VALUES (
    1,
    'U4af4980629abc123',
    '2025-07-14',
    '2025-07-21',
    '過去7日間で仕事の達成感と充実感が高まっています。チームワークを重視し、困難な状況でも前向きに取り組む姿勢が見られます。',
    '2025-07-21 10:40:00',
    '2025-07-21 10:40:00'
);
```

#### 使用用途
- **キャッシュ**: 24時間以内の要約は再利用（GPT API節約）
- **分析入力**: 新しい日記分析時のコンテキスト提供
- **最適化**: トークン数削減によるコスト・速度最適化
- **履歴**: ユーザーの長期的な傾向把握

---

## 🔗 テーブル関係性

### ER図（エンティティ関係図）

```
[users (LINE)] ─┐
                │
                ▼
         [entries] ─┐
             │      │
             ▼      ▼
      [analyses] [summaries]
```

### 関係性詳細

#### 1. ユーザー - エントリー（1:N）
- 1人のユーザーは複数の日記を投稿可能
- `entries.user_id` でユーザー識別

#### 2. エントリー - 分析（1:1）
- 1つの日記に対して1つの分析結果
- `analyses.entry_id` でエントリーと関連付け
- CASCADE削除により整合性保証

#### 3. ユーザー - 要約（1:N）
- 1人のユーザーは複数期間の要約を持つ
- `summaries.user_id` でユーザー識別
- 通常は7日間スライディングウィンドウで1件のみ

---

## 🚀 パフォーマンス最適化

### インデックス戦略

#### 1. クエリパフォーマンス最適化

**頻繁なクエリパターン**:
```sql
-- ユーザー別最新エントリー取得
SELECT * FROM entries 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 10;

-- 要約キャッシュ検索
SELECT * FROM summaries 
WHERE user_id = ? 
  AND start_date = ? 
  AND end_date = ?;
```

**対応インデックス**:
- `idx_entries_user_id`: ユーザー別フィルタリング
- `idx_entries_created_at`: 時系列ソート
- `idx_summaries_dates`: 複合条件検索

#### 2. 複合インデックスの活用

```sql
-- 将来的な拡張を考慮した複合インデックス
CREATE INDEX IF NOT EXISTS idx_entries_user_date 
ON entries(user_id, created_at DESC);
```

### クエリ最適化例

#### Before（非効率）
```sql
-- 全テーブルスキャン発生
SELECT e.*, a.emotion 
FROM entries e 
LEFT JOIN analyses a ON e.id = a.entry_id 
WHERE e.content LIKE '%仕事%';
```

#### After（効率化）
```sql
-- インデックス活用
SELECT e.*, a.emotion 
FROM entries e 
LEFT JOIN analyses a ON e.id = a.entry_id 
WHERE e.user_id = ? 
  AND e.created_at >= ? 
ORDER BY e.created_at DESC;
```

---

## 💾 データライフサイクル管理

### 自動クリーンアップ（バッチ処理）

#### 1. 古いエントリーの削除（90日保持）

```sql
DELETE FROM entries 
WHERE datetime(created_at) < datetime('now', '-90 days');
```

#### 2. 古い要約の削除（30日保持）

```sql
DELETE FROM summaries 
WHERE datetime(created_at) < datetime('now', '-30 days');
```

#### 3. 孤立分析データの削除

```sql
-- 対応するエントリーが削除された分析データをクリーンアップ
DELETE FROM analyses 
WHERE entry_id NOT IN (
    SELECT id FROM entries
);
```

### キャッシュ管理戦略

#### 要約キャッシュの有効期限管理

```sql
-- 24時間経過した要約キャッシュを削除
DELETE FROM summaries 
WHERE datetime(updated_at) < datetime('now', '-1 day')
  AND user_id = ?;
```

---

## 🛡️ セキュリティ・整合性

### データ分離

#### ユーザー別データ分離
- 全クエリに `user_id` 条件を含める
- ユーザー間データの漏洩防止
- 適切なアクセス制御実装

```sql
-- 安全なクエリ例
SELECT * FROM entries 
WHERE user_id = ? AND id = ?;

-- 危険なクエリ例（避ける）
SELECT * FROM entries WHERE id = ?;
```

### 制約によるデータ整合性

#### 1. NOT NULL制約
- 必須フィールドの空値防止
- アプリケーションロジックの簡素化

#### 2. 外部キー制約
- 参照整合性の保証
- CASCADE削除による関連データ自動削除

#### 3. ユニーク制約
- 重複要約の防止
- データ一意性の保証

### 入力値検証

#### アプリケーションレベル
```typescript
// 入力値サニタイゼーション例
function sanitizeContent(content: string): string {
  return content
    .trim()
    .substring(0, 10000) // 最大文字数制限
    .replace(/[<>]/g, ''); // 危険文字除去
}
```

#### データベースレベル
```sql
-- 制約による長さ制限（将来的拡張）
ALTER TABLE entries 
ADD CONSTRAINT chk_content_length 
CHECK (length(content) <= 10000);
```

---

## 📊 監視・メトリクス

### データベース監視項目

#### 1. パフォーマンスメトリクス
- **クエリ実行時間**: 各テーブルの平均応答時間
- **接続プール使用率**: D1接続の使用状況
- **スロークエリ**: 1秒超のクエリ検出

#### 2. データ量監視
- **テーブルサイズ**: 各テーブルのレコード数
- **ストレージ使用量**: データベース容量監視
- **成長率**: 日次データ増加量

#### 3. 整合性監視
- **孤立レコード**: 参照先のないanalyses検出
- **重複データ**: ユニーク制約違反検出
- **NULL値**: 必須項目のNULL値監視

### 自動アラート設定

```sql
-- 監視クエリ例
-- 1. データ量アラート
SELECT 
  'entries' as table_name,
  COUNT(*) as record_count,
  CASE WHEN COUNT(*) > 100000 THEN 'ALERT' ELSE 'OK' END as status
FROM entries
UNION ALL
SELECT 
  'analyses' as table_name,
  COUNT(*) as record_count,
  CASE WHEN COUNT(*) > 100000 THEN 'ALERT' ELSE 'OK' END as status
FROM analyses;

-- 2. 整合性チェック
SELECT COUNT(*) as orphaned_analyses
FROM analyses a
LEFT JOIN entries e ON a.entry_id = e.id
WHERE e.id IS NULL;
```

---

## 🔧 マイグレーション・スキーマ変更

### マイグレーション管理

#### ファイル命名規則
```
migrations/
├── 0001_create_tables.sql     # 初期テーブル作成
├── 0002_add_indexes.sql       # インデックス追加
└── 0003_alter_columns.sql     # カラム変更
```

#### マイグレーション実行

```bash
# 開発環境
pnpm wrangler d1 execute mentor-diary-db --local --file=migrations/0001_create_tables.sql

# 本番環境
pnpm wrangler d1 execute mentor-diary-db --file=migrations/0001_create_tables.sql
```

### 将来的なスキーマ拡張

#### 予想される拡張

1. **ユーザー設定テーブル**
```sql
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'ja',
    notification_enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

2. **分析履歴テーブル**
```sql
CREATE TABLE analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_date DATE NOT NULL,
    total_entries INTEGER DEFAULT 0,
    avg_sentiment REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

3. **カテゴリ管理**
```sql
ALTER TABLE entries 
ADD COLUMN category TEXT DEFAULT 'general';

CREATE INDEX idx_entries_category ON entries(category);
```

---

## 🔄 バックアップ・復旧

### Cloudflare D1のバックアップ戦略

#### 1. 自動バックアップ
- **頻度**: Cloudflare側で自動実行
- **保持期間**: 30日間
- **リージョン**: マルチリージョンレプリケーション

#### 2. 手動エクスポート
```bash
# データ全体のエクスポート
pnpm wrangler d1 export mentor-diary-db --output=backup.sql

# テーブル別エクスポート
pnpm wrangler d1 execute mentor-diary-db --command="SELECT * FROM entries" > entries_backup.json
```

#### 3. 復旧手順
```bash
# データベース復旧
pnpm wrangler d1 execute mentor-diary-db --file=backup.sql
```

---

## 📚 クエリリファレンス

### よく使用されるクエリパターン

#### 1. ユーザーの最新エントリー取得
```sql
SELECT e.*, a.emotion, a.themes
FROM entries e
LEFT JOIN analyses a ON e.id = a.entry_id
WHERE e.user_id = ?
ORDER BY e.created_at DESC
LIMIT 1;
```

#### 2. 過去7日間のエントリー取得
```sql
SELECT * FROM entries
WHERE user_id = ?
  AND datetime(created_at) >= datetime('now', '-7 days')
ORDER BY created_at ASC;
```

#### 3. 要約キャッシュの確認・取得
```sql
SELECT summary_content, updated_at
FROM summaries
WHERE user_id = ?
  AND start_date = ?
  AND end_date = ?
  AND datetime(updated_at) >= datetime('now', '-1 day');
```

#### 4. ユーザー統計の取得
```sql
SELECT 
  COUNT(*) as total_entries,
  MIN(created_at) as first_entry,
  MAX(created_at) as latest_entry,
  COUNT(DISTINCT DATE(created_at)) as active_days
FROM entries
WHERE user_id = ?;
```

---

## ❓ FAQ

### Q: なぜuser_idをanalysesテーブルにも含めているのか？
A: パフォーマンス最適化のためです。JOINなしでユーザー別分析データを取得できます。

### Q: SQLiteの制限はありますか？
A: Cloudflare D1は10MB/データベース、1000リクエスト/分の制限があります。

### Q: 外部キー制約を使う理由は？
A: データ整合性保証とCASCADE削除による自動クリーンアップのためです。

### Q: インデックスが多すぎませんか？
A: 書き込み頻度 < 読み込み頻度のため、読み込み最適化を優先しています。

### Q: バイナリデータは保存できますか？
A: 現在は対応していませんが、BLOBカラム追加で将来対応可能です。