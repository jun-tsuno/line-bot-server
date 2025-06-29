# Database ER Diagram

このディレクトリには、mentor-diaryプロジェクトのデータベースER図が含まれています。

## ER図の生成方法

1. DBMLスキーマファイル（`/schema.dbml`）を編集
2. 以下のコマンドでER図を生成：
   ```bash
   pnpm run db:erd
   ```

## データベース構造

### entries テーブル
- ユーザーの日記エントリを保存
- `user_id`と`created_at`でインデックス作成

### analyses テーブル
- 各エントリのGPT分析結果を保存
- `entry_id`で`entries`テーブルと外部キー関連
- カスケード削除設定

### summaries テーブル
- 過去7日間の要約データをキャッシュ
- `user_id`、`start_date`、`end_date`でユニークインデックス作成

## 生成されるファイル

- `schema.sql` - DBMLから生成されたSQL
- `er-diagram.mermaid` - Mermaid形式のER図