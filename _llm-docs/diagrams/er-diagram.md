# ER Diagram

## ER図

```mermaid
erDiagram
    entries {
        integer id PK "PRIMARY KEY, AUTO INCREMENT"
        text user_id "NOT NULL"
        text content "NOT NULL"
        timestamp created_at "NOT NULL, DEFAULT current_timestamp"
        timestamp updated_at "NOT NULL, DEFAULT current_timestamp"
    }
    
    analyses {
        integer id PK "PRIMARY KEY, AUTO INCREMENT"
        integer entry_id FK "NOT NULL"
        text user_id "NOT NULL"
        text emotion "NULL"
        text themes "NULL"
        text patterns "NULL"
        text positive_points "NULL"
        timestamp created_at "NOT NULL, DEFAULT current_timestamp"
    }
    
    summaries {
        integer id PK "PRIMARY KEY, AUTO INCREMENT"
        text user_id "NOT NULL"
        date start_date "NOT NULL"
        date end_date "NOT NULL"
        text summary_content "NOT NULL"
        timestamp created_at "NOT NULL, DEFAULT current_timestamp"
        timestamp updated_at "NOT NULL, DEFAULT current_timestamp"
    }
    
    entries ||--o{ analyses : "has"
```

## ER図の生成方法

このER図は、DBMLスキーマファイル（`schema.dbml`）から手動で作成されています。

### 自動生成スクリプト

`scripts/generate-erd.sh`を実行すると、以下のファイルが生成されます：

```bash
# ER図関連ファイルの生成
pnpm run generate:erd
```

生成されるファイル：
- `_llm-docs/diagrams/schema.sql` - フォーマット済みのSQLスキーマ
- `_llm-docs/diagrams/er-diagram.md` - Mermaid形式のER図（このファイル）

### Mermaidダイアグラムの表示方法

1. **VS Code / Cursor**
   - Markdown Previewを使用（Cmd+Shift+V）
   - Mermaid対応の拡張機能をインストール

2. **GitHub**
   - GitHubは`.md`ファイル内のMermaidコードブロックを自動的にレンダリング

3. **オンラインツール**
   - [Mermaid Live Editor](https://mermaid.live)