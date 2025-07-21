# 🌐 API仕様書

## 概要

AI日記リフレクションBotのAPIエンドポイント仕様を詳細に説明します。すべてのエンドポイントはCloudflare Workers上で動作し、LINE Messaging APIとOpenAI GPT-3.5-turboと連携しています。

---

## 🏗️ アーキテクチャ概要

```
LINE Platform → Webhook → Cloudflare Workers → D1 Database
                    ↓              ↓
                OpenAI API ← Analysis Service
```

---

## 📡 エンドポイント一覧

| エンドポイント | メソッド | 用途 | 認証 |
|---------------|----------|------|------|
| `/` | GET | ヘルスチェック | なし |
| `/webhook` | POST | LINE Webhook受信 | LINE署名検証 |
| `/test-db` | GET | データベース接続テスト | なし（開発用） |
| `/test-openai` | GET | OpenAI API接続テスト | なし（開発用） |

---

## 🎯 本番APIエンドポイント

### 1. ヘルスチェック

```http
GET /
```

#### 概要
サーバーの稼働状態を確認するためのエンドポイント

#### リクエスト
```
GET https://mentor-diary.your-worker.workers.dev/
Content-Type: application/json
```

#### レスポンス

**成功時 (200 OK)**
```json
{
  "status": "healthy",
  "message": "AI日記リフレクションBot is running",
  "timestamp": "2025-07-21T01:10:00.000Z",
  "version": "v2"
}
```

#### 実装場所
- `src/handlers/health.ts`

---

### 2. LINE Webhook

```http
POST /webhook
```

#### 概要
LINE Messaging APIからのWebhookを受信し、日記分析を実行するメインエンドポイント

#### セキュリティ
- **署名検証**: `X-Line-Signature` ヘッダーによるHMAC-SHA256署名検証
- **IPホワイトリスト**: LINE Platform IPアドレスからのリクエストのみ受付（推奨）

#### リクエストヘッダー
```
POST /webhook
Content-Type: application/json
X-Line-Signature: {HMAC-SHA256署名}
```

#### リクエストボディ（LINE Webhook形式）
```json
{
  "destination": "xxxxxxxxxx",
  "events": [
    {
      "type": "message",
      "mode": "active",
      "timestamp": 1625097600000,
      "source": {
        "type": "user",
        "userId": "U4af4980629..."
      },
      "replyToken": "0f3779fba3b349968c5d07db31eab56f",
      "message": {
        "id": "444573844083572737",
        "type": "text",
        "quoteToken": "4387302...",
        "text": "今日は仕事が大変だった。でも同僚に助けてもらえて感謝している。"
      }
    }
  ]
}
```

#### 処理フロー
1. **署名検証**: LINE Platform からの正当なリクエストか検証
2. **ローディング表示**: ユーザーに分析処理中であることを通知（最大20秒）
3. **並列処理**: 複数イベントを並列で処理
4. **日記分析**: 
   - 日記内容をDBに保存
   - 過去7日間の履歴要約を取得/生成
   - GPT-3.5-turboで感情・テーマ分析
   - 分析結果をDBに保存
5. **返信**: LINE APIで分析結果をユーザーに送信
6. **エラーハンドリング**: 各段階でのエラー処理と適切なフィードバック

#### レスポンス

**成功時 (200 OK)**
```json
{
  "success": true
}
```

**署名検証エラー (400 Bad Request)**
```json
{
  "error": "Invalid signature"
}
```

**署名ヘッダーなし (400 Bad Request)**
```json
{
  "error": "X-Line-Signature header is required"
}
```

**内部エラー (500 Internal Server Error)**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "分析処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。"
}
```

#### 実装場所
- `src/handlers/webhook.ts`
- `src/services/line/message.ts`
- `src/services/analysis.ts`

---

## 🧪 開発・テスト用エンドポイント

### 3. データベース接続テスト

```http
GET /test-db
```

#### 概要
Cloudflare D1データベースへの接続をテストするエンドポイント

#### レスポンス

**成功時 (200 OK)**
```json
{
  "success": true,
  "message": "Database connection successful",
  "stats": {
    "totalEntries": 150,
    "totalAnalyses": 148,
    "totalSummaries": 23,
    "totalUsers": 12,
    "timestamp": "2025-07-21T01:10:00.000Z"
  }
}
```

**データベースエラー (500 Internal Server Error)**
```json
{
  "success": false,
  "error": "Database connection failed",
  "details": "Connection timeout"
}
```

#### 実装場所
- `src/handlers/test/db.ts`

---

### 4. OpenAI API接続テスト

```http
GET /test-openai
```

#### 概要
OpenAI GPT-3.5-turbo APIへの接続をテストするエンドポイント

#### レスポンス

**成功時 (200 OK)**
```json
{
  "success": true,
  "message": "OpenAI API connection successful",
  "testAnalysis": "テストメッセージの分析が正常に完了しました。",
  "model": "gpt-3.5-turbo",
  "timestamp": "2025-07-21T01:10:00.000Z"
}
```

**OpenAI APIエラー (500 Internal Server Error)**
```json
{
  "success": false,
  "error": "OpenAI API connection failed",
  "details": "Rate limit exceeded"
}
```

#### 実装場所
- `src/handlers/test/openai.ts`

---

## 🔄 Scheduled Workers（バッチ処理）

### バッチ処理概要

定期実行される内部処理で、外部からのHTTPアクセスは不可。

#### スケジュール
- **午前2時** (0 2 * * *): メインバッチ処理
- **午後2時** (0 14 * * *): 軽量メンテナンス処理

#### 処理内容
1. **要約キャッシュ更新**: アクティブユーザーの7日間要約を再生成
2. **データクリーンアップ**: 古いエントリー（90日超）・サマリー（30日超）の削除
3. **API使用量最適化**: 重複サマリー削除・未使用キャッシュクリーンアップ
4. **モニタリング**: 使用量統計・アラート監視

#### 実装場所
- `src/handlers/scheduled.ts`

---

## 🛡️ セキュリティ仕様

### 1. LINE Webhook署名検証

#### 検証プロセス
```javascript
// 署名検証アルゴリズム
const signature = crypto
  .createHmac('sha256', channelSecret)
  .update(requestBody)
  .digest('base64');

if (signature !== receivedSignature) {
  throw new Error('Invalid signature');
}
```

#### 実装詳細
- **アルゴリズム**: HMAC-SHA256
- **シークレット**: 環境変数 `LINE_CHANNEL_SECRET`
- **検証対象**: HTTPリクエストボディ全体
- **実装場所**: `src/services/line/signature.ts`

### 2. 環境変数管理

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE APIアクセストークン | ✅ |
| `LINE_CHANNEL_SECRET` | LINE Webhook署名検証 | ✅ |
| `OPENAI_API_KEY` | OpenAI API認証 | ✅ |
| `CACHE_DURATION_HOURS` | 要約キャッシュ有効期限（デフォルト24時間） | ❌ |

### 3. エラー情報保護

- **技術的詳細の隠蔽**: 内部エラーはログ出力のみ、ユーザーには一般的メッセージ
- **ログ管理**: 構造化ログによる詳細な監視・デバッグ情報
- **機密情報保護**: APIキー・トークンのログ出力防止

---

## 🔧 エラーハンドリング仕様

### エラー分類システム

| カテゴリ | 説明 | リトライ | 例 |
|----------|------|----------|---|
| `temporary` | 一時的エラー | ✅ | ネットワークタイムアウト |
| `permanent` | 永続的エラー | ❌ | 不正なリクエスト |
| `rate_limit` | レート制限 | ✅ | API制限に達した |
| `network` | ネットワークエラー | ✅ | 接続失敗 |
| `validation` | バリデーションエラー | ❌ | 不正な入力値 |
| `unknown` | 不明なエラー | ❌ | 予期しないエラー |

### リトライ設定

```typescript
{
  maxRetries: 3,           // 最大リトライ回数
  baseDelay: 1000,         // 基本遅延時間（ミリ秒）
  maxDelay: 30000,         // 最大遅延時間（ミリ秒）
  backoffMultiplier: 2     // 指数バックオフ倍率
}
```

### サーキットブレーカー

```typescript
{
  failureThreshold: 5,     // 連続失敗数しきい値
  resetTimeout: 60000,     // リセットタイムアウト（ミリ秒）
  monitoringPeriod: 60000  // 監視期間（ミリ秒）
}
```

---

## 📊 パフォーマンス仕様

### レスポンス時間目標

| エンドポイント | 目標時間 | 最大許容時間 |
|---------------|----------|--------------|
| `GET /` | < 100ms | 500ms |
| `POST /webhook` | < 5s | 20s |
| `GET /test-db` | < 200ms | 1s |
| `GET /test-openai` | < 3s | 10s |

### スループット

- **Webhook処理**: 50 req/sec（単一インスタンス）
- **並列処理**: 最大10イベント同時処理
- **バッチ処理**: 50ユーザー/バッチ、100ms間隔

### リソース制限

- **メモリ使用量**: 128MB制限（Cloudflare Workers）
- **実行時間**: 30秒制限（CPU時間10ms制限）
- **ネットワーク**: 発信リクエスト50/分

---

## 🔍 監視・ログ仕様

### ログレベル

| レベル | 用途 | 例 |
|--------|------|---|
| `error` | エラー・例外 | API呼び出し失敗 |
| `warn` | 警告・一時的問題 | リトライ実行 |
| `info` | 重要な状態変化 | ユーザー分析完了 |
| `debug` | デバッグ情報 | 内部処理詳細 |

### 監視項目

#### 機能監視
- **エンドポイント応答時間**
- **エラー率・成功率**
- **OpenAI API使用量**
- **データベース接続状態**

#### ビジネス監視
- **日次アクティブユーザー数**
- **分析処理完了率**
- **要約生成成功率**
- **平均分析時間**

### アラート設定

#### クリティカルアラート
- **エラー率 > 10%**（5分間）
- **応答時間 > 20秒**（連続3回）
- **データベース接続失敗**

#### 警告アラート
- **要約生成失敗率 > 5%**（1時間）
- **アクティブユーザー急増 > 1000人**
- **API使用量 > 80%**（月間制限の）

---

## 🚀 API使用例

### cURLでのWebhookテスト

```bash
# 署名付きWebhookリクエスト例
curl -X POST https://mentor-diary.your-worker.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: YOUR_SIGNATURE" \
  -d '{
    "events": [{
      "type": "message",
      "replyToken": "test-reply-token",
      "source": {"userId": "test-user-id"},
      "message": {"type": "text", "text": "今日は良い一日でした"}
    }]
  }'
```

### ヘルスチェック

```bash
curl https://mentor-diary.your-worker.workers.dev/
```

### データベーステスト

```bash
curl https://mentor-diary.your-worker.workers.dev/test-db
```

---

## 🔄 バージョニング・変更管理

### APIバージョン管理
- **現在バージョン**: v2
- **下位互換性**: 1つ前のバージョン（v1）をサポート
- **変更通知**: 重要な変更は事前通知（1ヶ月前）

### 変更履歴
- **v2.0**: ローディングアニメーション・包括的エラーハンドリング・バッチ最適化機能追加
- **v1.0**: 基本的な日記分析機能・LINE連携・要約機能

---

## 📚 関連ドキュメント

- **[プロジェクト仕様書](project.md)**: システム全体の概要・アーキテクチャ
- **[データベース設計](database-design.md)**: テーブル構造・関係性の詳細
- **[AI分析フロー](ai-analysis-flow.md)**: AI分析処理の詳細アルゴリズム
- **[デプロイメント](deployment.md)**: 環境構築・デプロイ手順

---

## ❓ FAQ

### Q: Webhookエンドポイントのタイムアウト時間は？
A: 最大20秒です。LINE側のタイムアウト（30秒）内で処理完了するよう設計されています。

### Q: 同時接続数の制限は？
A: Cloudflare Workersの制限により、単一インスタンスで最大50並列接続です。

### Q: エラー時のリトライ間隔は？
A: 指数バックオフ（1秒 → 2秒 → 4秒）で最大3回リトライします。

### Q: バッチ処理は手動実行可能？
A: いいえ。セキュリティ上、スケジュール実行のみです。

### Q: APIキーの更新方法は？
A: Cloudflare Dashboard > Workers > 設定 > 環境変数から更新可能です。