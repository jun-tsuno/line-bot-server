# 🚀 デプロイメント手順書

## 概要

AI日記リフレクションBotのCloudflare Workersへのデプロイ手順と環境構築について詳細に説明します。本番環境、ステージング環境、ローカル開発環境のセットアップを網羅します。

---

## 🏗️ デプロイメントアーキテクチャ

```
開発環境           ステージング環境        本番環境
 Local              Cloudflare             Cloudflare
┌─────────┐        ┌─────────────┐        ┌─────────────┐
│ wrangler│   →    │   Workers   │   →    │   Workers   │
│   dev   │        │  (staging)  │        │ (production)│
└─────────┘        └─────────────┘        └─────────────┘
     ↓                      ↓                      ↓
┌─────────┐        ┌─────────────┐        ┌─────────────┐
│ Local   │        │ D1 Database │        │ D1 Database │
│Database │        │ (staging)   │        │(production) │
└─────────┘        └─────────────┘        └─────────────┘
```

---

## 📋 前提条件・必要なもの

### 1. 開発環境
- **Node.js**: v18.0.0以上
- **pnpm**: 最新版（`npm install -g pnpm`）
- **Git**: バージョン管理
- **エディタ**: VS Code（推奨）

### 2. Cloudflareアカウント
- **Cloudflare Workers**: 有料プラン（$5/月）推奨
- **D1 Database**: 有料プラン（データベース容量）
- **API Token**: Workers操作用

### 3. 外部サービス
- **LINE Developers Account**: Messaging API
- **OpenAI Account**: GPT-3.5-turbo API

---

## 🔧 環境構築

### 1. プロジェクトクローン・依存関係インストール

```bash
# リポジトリクローン
git clone https://github.com/your-username/line-bot-server.git
cd line-bot-server

# 依存関係インストール
pnpm install

# TypeScript型生成
pnpm cf-typegen
```

### 2. Wrangler CLI設定

```bash
# Wrangler CLI インストール（グローバル）
npm install -g wrangler

# Cloudflareアカウントにログイン
wrangler auth login

# アカウント確認
wrangler whoami
```

---

## 🗄️ データベースセットアップ

### 1. D1データベース作成

#### 本番用データベース
```bash
# 本番データベース作成
wrangler d1 create mentor-diary-db

# 出力例:
# ✅ Successfully created DB mentor-diary-db
# 📋 Binding: DB
# 🆔 UUID: b0b5377e-c887-4c6e-a37b-a0d94803f930
```

#### ステージング用データベース
```bash
# ステージング用データベース作成
wrangler d1 create mentor-diary-db-staging

# 出力例:
# ✅ Successfully created DB mentor-diary-db-staging
# 📋 Binding: DB
# 🆔 UUID: a1a4266d-b776-3b5e-9a2b-9fd83703e820
```

### 2. wrangler.jsonc設定更新

```jsonc
{
  "name": "mentor-diary",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-07",
  
  // 本番環境用データベース設定
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "mentor-diary-db",
      "database_id": "b0b5377e-c887-4c6e-a37b-a0d94803f930"
    }
  ],
  
  // スケジュールトリガー設定
  "triggers": {
    "crons": ["0 2 * * *", "0 14 * * *"]
  }
}
```

### 3. マイグレーション実行

#### 本番環境
```bash
# テーブル作成
wrangler d1 execute mentor-diary-db --file=migrations/0001_create_tables.sql

# 実行結果確認
wrangler d1 execute mentor-diary-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

#### ローカル開発環境
```bash
# ローカルD1セットアップ
wrangler d1 execute mentor-diary-db --local --file=migrations/0001_create_tables.sql

# シードデータ投入（開発環境のみ）
wrangler d1 execute mentor-diary-db --local --file=seeds/development.sql
```

---

## 🔐 環境変数・Secrets設定

### 1. Cloudflare Secrets設定

```bash
# LINE Messaging API設定
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# プロンプト: Enter a secret value: 
# → チャネルアクセストークンを入力

wrangler secret put LINE_CHANNEL_SECRET
# プロンプト: Enter a secret value:
# → チャネルシークレットを入力

# OpenAI API設定
wrangler secret put OPENAI_API_KEY
# プロンプト: Enter a secret value:
# → OpenAI APIキーを入力

# オプション設定（デフォルト値あり）
wrangler secret put CACHE_DURATION_HOURS
# プロンプト: Enter a secret value:
# → 24（要約キャッシュ有効期限）
```

### 2. 環境変数確認
```bash
# 設定済みSecrets確認
wrangler secret list

# 出力例:
# [
#   {
#     "name": "LINE_CHANNEL_ACCESS_TOKEN",
#     "type": "secret_text"
#   },
#   ...
# ]
```

### 3. ローカル開発用環境変数

`.dev.vars` ファイル作成（Git管理対象外）:
```bash
# .dev.vars ファイル作成
touch .dev.vars

# 内容例
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here
OPENAI_API_KEY=your_openai_api_key_here
CACHE_DURATION_HOURS=24
```

**⚠️ 注意**: `.dev.vars`は`.gitignore`に含めて、Gitに追跡されないよう注意

---

## 🚀 デプロイ手順

### 1. ローカル開発・テスト

```bash
# ローカル開発サーバー起動
pnpm dev

# 出力例:
# ⛅️ wrangler 3.xx.x
# ------------------
# Your worker is running at http://localhost:8787/

# 別ターミナルでテスト実行
curl http://localhost:8787/
# レスポンス: {"status":"healthy","message":"AI日記リフレクションBot is running"}

# データベース接続テスト
curl http://localhost:8787/test-db

# OpenAI接続テスト
curl http://localhost:8787/test-openai
```

### 2. 本番デプロイ

```bash
# TypeScript型チェック・ビルド
pnpm run cf-typegen

# フォーマット確認
pnpm run format:check

# テスト実行
pnpm test

# 本番環境にデプロイ
pnpm deploy

# 出力例:
# ✨ Compiled Worker successfully
# ✨ Successfully published your Worker to the following routes:
#   - mentor-diary.your-subdomain.workers.dev
# ✨ Upload complete!
```

### 3. デプロイ確認

```bash
# 本番環境ヘルスチェック
curl https://mentor-diary.your-subdomain.workers.dev/

# データベース接続確認
curl https://mentor-diary.your-subdomain.workers.dev/test-db

# OpenAI API接続確認
curl https://mentor-diary.your-subdomain.workers.dev/test-openai
```

---

## 🔗 LINE Webhook設定

### 1. LINE Developers Console設定

1. **チャネル作成**: LINE Developers Consoleでメッセージング APIチャネル作成
2. **Webhook URL設定**:
   ```
   https://mentor-diary.your-subdomain.workers.dev/webhook
   ```
3. **Webhook使用**: 有効化
4. **応答メッセージ**: 無効化（Botで制御）

### 2. Webhook検証

```bash
# LINE Platform Simulator使用
# または cURL での検証（署名計算が必要）

# 署名計算例（Node.js）
const crypto = require('crypto');
const channelSecret = 'your_channel_secret';
const body = '{"events":[]}';

const signature = crypto
  .createHmac('SHA256', channelSecret)
  .update(body)
  .digest('base64');

console.log(`X-Line-Signature: ${signature}`);
```

---

## 📊 監視・ログ設定

### 1. Cloudflare Workers Analytics

```bash
# Workers Analytics確認
wrangler deployment list

# リアルタイムログ監視
wrangler tail

# ログフィルタリング
wrangler tail --format=pretty --status=error
```

### 2. カスタムログ出力

#### 構造化ログ設定
```typescript
// src/utils/logger.ts
interface LogData {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  context: string;
  data?: Record<string, unknown>;
}

export function logInfo(context: string, data?: Record<string, unknown>) {
  const logEntry: LogData = {
    timestamp: new Date().toISOString(),
    level: 'info',
    context,
    data
  };
  console.log(JSON.stringify(logEntry));
}
```

### 3. アラート設定

Cloudflare Dashboardでの設定:
1. **Workers** → **Observability** → **Alerts**
2. **アラート作成**:
   - エラー率 > 10%
   - レスポンス時間 > 10秒
   - CPU使用率 > 80%

---

## 🔄 CI/CD パイプライン

### 1. GitHub Actions設定

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm test
      - run: pnpm run format:check

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm run cf-typegen
      - run: pnpm deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 2. 必要なSecrets設定

GitHub Repository → Settings → Secrets and variables → Actions:
```
CLOUDFLARE_API_TOKEN: your_cloudflare_api_token
```

---

## 🔧 環境別設定管理

### 1. 複数環境対応

#### ステージング環境用設定
`wrangler.staging.jsonc`:
```jsonc
{
  "name": "mentor-diary-staging",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-07",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "mentor-diary-db-staging",
      "database_id": "a1a4266d-b776-3b5e-9a2b-9fd83703e820"
    }
  ],
  "triggers": {
    "crons": ["0 3 * * *"]  // ステージングは1回のみ
  }
}
```

#### 環境別デプロイコマンド
```bash
# ステージング環境
wrangler deploy --config wrangler.staging.jsonc

# 本番環境
wrangler deploy --config wrangler.jsonc
```

### 2. package.json スクリプト更新

```json
{
  "scripts": {
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --config wrangler.staging.jsonc",
    "deploy:production": "wrangler deploy --config wrangler.jsonc"
  }
}
```

---

## 🔍 トラブルシューティング

### 1. よくある問題と解決方法

#### ⚠️ デプロイエラー
```bash
# エラー: "Failed to publish Worker"
# 解決策:
wrangler logout
wrangler auth login
pnpm deploy
```

#### ⚠️ データベース接続エラー
```bash
# エラー: "D1_ERROR: No such database"
# 解決策: wrangler.jsonc のdatabase_id確認
wrangler d1 list
# 正しいdatabase_idをコピーしてwrangler.jsonc更新
```

#### ⚠️ 環境変数エラー
```bash
# エラー: "Environment variable not found"
# 解決策: Secrets再設定
wrangler secret put VARIABLE_NAME
# または .dev.vars ファイル確認（ローカル）
```

#### ⚠️ LINE Webhook エラー
```bash
# エラー: "Invalid signature"
# 解決策: 
# 1. LINE_CHANNEL_SECRET が正しく設定されているか確認
# 2. Webhook URLがHTTPSであること確認
# 3. 署名検証ロジックの確認
```

### 2. ログを活用したデバッグ

```bash
# リアルタイムログ監視
wrangler tail --format=pretty

# 特定のエラーのみ表示
wrangler tail --format=pretty | grep "ERROR"

# JSON形式でログ解析
wrangler tail --format=json | jq '.logs[] | select(.level == "error")'
```

### 3. ロールバック手順

```bash
# デプロイ履歴確認
wrangler deployment list

# 特定のデプロイメントにロールバック
wrangler rollback --deployment-id=deployment_id_here

# 確認
curl https://mentor-diary.your-subdomain.workers.dev/
```

---

## 📈 パフォーマンス監視

### 1. メトリクス監視

#### Cloudflare Analytics確認項目
- **リクエスト数**: 時間別リクエスト数
- **エラー率**: 4xx/5xxエラーの割合
- **レスポンス時間**: P50/P95/P99パーセンタイル
- **CPU時間**: Workers実行時間

#### カスタムメトリクス
```typescript
// Workers Analytics Engine活用
export default {
  async fetch(request: Request, env: Env) {
    const start = Date.now();
    
    try {
      const response = await handleRequest(request, env);
      
      // 成功メトリクス記録
      env.ANALYTICS.writeDataPoint({
        'blobs': [request.url, 'success'],
        'doubles': [Date.now() - start],
        'indexes': [request.method]
      });
      
      return response;
    } catch (error) {
      // エラーメトリクス記録
      env.ANALYTICS.writeDataPoint({
        'blobs': [request.url, 'error', error.message],
        'doubles': [Date.now() - start],
        'indexes': [request.method]
      });
      
      throw error;
    }
  }
};
```

### 2. アラート・通知設定

#### Discord Webhook通知例
```typescript
// 重要なエラー発生時の通知
async function notifyDiscord(error: Error, context: string) {
  if (error.severity === 'critical') {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 Critical Error in ${context}: ${error.message}`
      })
    });
  }
}
```

---

## 🔐 セキュリティ考慮事項

### 1. Secrets管理

#### ベストプラクティス
- **ローテーション**: 定期的なAPIキー更新
- **最小権限**: 必要最小限の権限でAPIキー作成
- **監査**: Secrets変更履歴の記録

```bash
# APIキーローテーション例
# 1. 新しいAPIキー生成（OpenAI/LINE）
# 2. 新しいキーでテスト
# 3. Secrets更新
wrangler secret put OPENAI_API_KEY  # 新しいキー入力
# 4. デプロイ・動作確認
# 5. 古いキー無効化
```

### 2. アクセス制御

#### IP制限（必要に応じて）
```typescript
// LINE Platform IPのホワイトリスト
const LINE_IPS = [
  '147.92.150.192/26',
  '147.92.150.128/26'
];

function isValidLineIP(request: Request): boolean {
  const clientIP = request.headers.get('CF-Connecting-IP');
  return LINE_IPS.some(range => ipInRange(clientIP, range));
}
```

### 3. レート制限・DDoS対策

```typescript
// Cloudflare Workers の標準機能活用
// Rate Limiting Rules をCloudflare Dashboardで設定
// - /webhook: 100 req/min per IP
// - 他エンドポイント: 1000 req/min per IP
```

---

## 🚀 スケーリング戦略

### 1. 水平スケーリング

Cloudflare Workersの自動スケーリング:
- **自動スケーリング**: トラフィック増加時の自動インスタンス増加
- **グローバル分散**: 世界200+都市でのエッジ実行
- **コールドスタート最適化**: 数ミリ秒での起動時間

### 2. データベーススケーリング

```sql
-- インデックス最適化によるパフォーマンス向上
EXPLAIN QUERY PLAN 
SELECT * FROM entries 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 10;

-- 必要に応じてパーティショニング検討
-- （将来的な大規模データ対応）
```

### 3. 外部サービス最適化

#### OpenAI API使用量最適化
```typescript
// バッチ処理による効率化
const batchAnalyze = async (entries: Entry[]): Promise<Analysis[]> => {
  // 複数エントリーを1回のAPIコールで処理
  const batchPrompt = entries
    .map((entry, index) => `${index + 1}. ${entry.content}`)
    .join('\n\n');
    
  // GPT APIでバッチ分析実行
  return await processMultipleEntries(batchPrompt);
};
```

---

## 📚 リファレンス・関連資料

### 公式ドキュメント
- **[Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)**
- **[Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)**
- **[Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)**
- **[LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)**
- **[OpenAI API Documentation](https://platform.openai.com/docs/)**

### 追加ツール
- **[Workers DevTools](https://github.com/cloudflare/workers-sdk)**: ローカル開発環境
- **[Miniflare](https://miniflare.dev/)**: Workers シミュレーター
- **[Workerd](https://github.com/cloudflare/workerd)**: Workers ランタイム

---

## ❓ FAQ

### Q: デプロイに時間制限はありますか？
A: Wrangler CLIのデプロイは通常1-2分で完了します。タイムアウトは15分です。

### Q: 複数リージョンに同時デプロイ可能？
A: Cloudflare Workersは自動的にグローバル分散されるため、単一デプロイで世界中にサービス提供されます。

### Q: カスタムドメインは設定可能？
A: はい。Cloudflare Dashboardでカスタムドメインを設定し、DNS設定を行えます。

### Q: ダウンタイムなしでデプロイ可能？
A: はい。Cloudflare Workersはブルーグリーンデプロイメントにより、ダウンタイムなしでデプロイできます。

### Q: 本番環境のデータベースをローカルで確認できますか？
A: セキュリティ上、本番データベースへの直接アクセスは制限されています。ステージング環境経由での確認を推奨します。