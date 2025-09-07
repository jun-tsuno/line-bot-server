# バッチ処理ローカル検証手順

## 1. 事前準備

### 環境変数の設定
`.dev.vars` ファイルに必要な環境変数を設定してください：

```env
OPENAI_API_KEY=your_openai_api_key
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
```

### テストデータの準備
```bash
# データベースにシードデータを追加
pnpm run db:seed:dev
```

## 2. ローカルサーバーの起動

```bash
# 開発サーバーを起動
pnpm run dev
```

サーバーが `http://localhost:8787` で起動することを確認してください。

## 3. バッチ処理のテスト実行

### 方法1: npm script（推奨）
```bash
# バッチ処理をテスト実行
pnpm run batch:test
```

### 方法2: curl直接実行
```bash
curl -X POST http://localhost:8787/dev/run-batch \
  -H 'Content-Type: application/json' \
  -w "\nResponse Time: %{time_total}s\n"
```

### 方法3: ブラウザ/Postman
- URL: `http://localhost:8787/dev/run-batch`
- Method: `POST`
- Headers: `Content-Type: application/json`

## 4. 実行結果の確認

### 成功時のレスポンス例
```json
{
  "success": true,
  "message": "バッチ処理完了",
  "stats": {
    "cacheUpdated": 5,
    "entriesDeleted": 0,
    "summariesDeleted": 0,
    "analysesDeleted": 0,
    "duplicatesRemoved": 0,
    "usersProcessed": 3,
    "totalEntries": 25,
    "totalSummaries": 5,
    "totalAnalyses": 20,
    "totalUsers": 3,
    "processingTimeMs": 2500
  },
  "processingTimeMs": 2500
}
```

### ログの確認
コンソールに以下のようなログが出力されます：

```
スケジュールバッチ処理開始 {...}
バッチ処理開始: 要約キャッシュ更新
アクティブユーザー数: 3
要約キャッシュ更新完了 { updatedCount: 5 }
バッチ処理開始: 古いデータクリーンアップ
古いデータクリーンアップ完了 {...}
バッチ処理開始: API使用量最適化
API使用量最適化完了 {...}
バッチ処理開始: モニタリング統計取得
モニタリング統計取得完了 {...}
バッチ処理完了 {...}
```

## 5. 検証ポイント

### データベースの確認
```bash
# D1データベースのクエリ実行例
npx wrangler d1 execute mentor-diary-db --local \
  --command "SELECT COUNT(*) as count FROM summaries;"
```

### 確認項目
- [ ] アクティブユーザーの要約が更新されている
- [ ] 古いデータが削除されている（該当する場合）
- [ ] 重複データが削除されている（該当する場合）
- [ ] エラーが発生していない
- [ ] 処理時間が適切（数秒〜数十秒程度）

## 6. エラーが発生した場合

### よくあるエラーと対処法

1. **OpenAI API エラー**
   - 環境変数 `OPENAI_API_KEY` を確認
   - APIキーの有効性を確認

2. **データベースエラー**
   - ローカルD1データベースが起動していることを確認
   - シードデータが正しく投入されていることを確認

3. **タイムアウトエラー**
   - 処理時間が長い場合は正常（大量データの場合）
   - OpenAI APIのレスポンス時間に依存

### デバッグ用コマンド
```bash
# データベースの状態確認
npx wrangler d1 execute mentor-diary-db --local \
  --command "
    SELECT 
      'entries' as table_name, COUNT(*) as count 
    FROM entries 
    UNION ALL 
    SELECT 
      'summaries', COUNT(*) 
    FROM summaries 
    UNION ALL 
    SELECT 
      'analyses', COUNT(*) 
    FROM analyses;
  "
```

## 7. 本番環境での確認

ローカルテストが成功したら、本番環境での動作確認：

```bash
# 本番環境にデプロイ
pnpm run deploy

# スケジュール実行をトリガー（任意）
npx wrangler cron trigger --cron="0 2 * * *"
```

## 注意事項

- テスト実行は本番データに影響しません（ローカルD1使用）
- OpenAI APIは実際に呼び出されるため、API使用料が発生します
- 大量のテストデータがある場合、実行時間が長くなる場合があります