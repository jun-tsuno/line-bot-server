# 📁 ディレクトリ構成詳細

## 概要

このドキュメントでは、AI日記リフレクションBotプロジェクトのディレクトリ構造と各ファイルの役割について詳細に説明します。

---

## 🏗️ ルートディレクトリ構成

```
line-bot-server/
├── 📄 CLAUDE.md              # プロジェクト指示・ガイドライン
├── 📄 README.md              # プロジェクト概要
├── 📄 package.json           # NPM依存関係・スクリプト定義
├── 📄 pnpm-lock.yaml         # 依存関係ロックファイル
├── 📄 tsconfig.json          # TypeScript設定
├── 📄 vitest.config.mts      # テスト設定
├── 📄 wrangler.jsonc         # Cloudflare Workers設定
├── 📄 worker-configuration.d.ts # Worker型定義
├── 📄 schema.dbml            # データベーススキーマ定義
├── 🗂️ _llm-docs/            # LLM用ドキュメント
├── 🗂️ _llm-rules/           # 実装ルール・ガイドライン
├── 🗂️ migrations/           # データベースマイグレーション
├── 🗂️ public/              # 静的ファイル
├── 🗂️ scripts/             # 各種スクリプト
├── 🗂️ seeds/               # データベース初期データ
├── 🗂️ src/                 # メインソースコード
└── 🗂️ test/                # テストファイル
```

---

## 📚 _llm-docs/（LLM用ドキュメント）

```
_llm-docs/
├── 📄 project.md            # プロジェクト仕様書（メイン）
├── 📄 directory-structure.md # ディレクトリ構成詳細（このファイル）
├── 📄 api-specification.md  # APIエンドポイント仕様
├── 📄 database-design.md    # データベース設計詳細
├── 📄 ai-analysis-flow.md   # AI分析フローの詳細
├── 📄 deployment.md         # デプロイメント手順
└── 🗂️ diagrams/            # 図表・ダイアグラム
    ├── 📄 README.md         # 図表の説明
    ├── 📄 er-diagram.md     # ERダイアグラム
    └── 📄 schema.sql        # スキーマ定義
```

### 役割
- **project.md**: システム全体の仕様・機能・アーキテクチャの中心的ドキュメント
- **directory-structure.md**: 本ドキュメント、プロジェクト構造の詳細説明
- **api-specification.md**: REST API・Webhookエンドポイントの詳細仕様
- **database-design.md**: テーブル設計・インデックス・関係性の詳細
- **ai-analysis-flow.md**: AI分析処理の詳細フロー・アルゴリズム
- **deployment.md**: Cloudflare Workers へのデプロイ手順・環境設定

---

## 🛠️ _llm-rules/（実装ルール）

```
_llm-rules/
└── 📄 imprementation.md    # 実装原則・コーディング規則
```

### 役割
- **implementation.md**: コード実装時の必須ガイドライン・エラーハンドリング・命名規則

---

## 💾 データベース関連

```
migrations/
└── 📄 0001_create_tables.sql # 初期テーブル作成SQL

seeds/
└── 📄 development.sql       # 開発用初期データ

scripts/
├── 📄 generate-erd.sh       # ERD生成スクリプト
└── 📄 seed.js              # シードデータ投入スクリプト
```

### 役割
- **migrations/**: データベーススキーマの変更履歴管理
- **seeds/**: テスト・開発用の初期データ
- **scripts/**: データベース操作・図表生成の自動化スクリプト

---

## 🎯 src/（メインソースコード）

```
src/
├── 📄 index.ts              # アプリケーションエントリーポイント
├── 🗂️ constants/           # 定数・設定値
│   └── 📄 messages.ts       # エラーメッセージ・ユーザーメッセージ定数
├── 🗂️ handlers/            # HTTP・イベントハンドラー
│   ├── 📄 health.ts         # ヘルスチェックエンドポイント
│   ├── 📄 scheduled.ts      # バッチ処理・定期実行
│   ├── 📄 webhook.ts        # LINE Webhookハンドラー
│   └── 🗂️ test/            # テスト用ハンドラー
│       ├── 📄 db.ts         # データベース接続テスト
│       └── 📄 openai.ts     # OpenAI API接続テスト
├── 🗂️ prompts/             # AI分析用プロンプト
│   └── 📄 diary-analysis.ts # 日記分析プロンプトテンプレート
├── 🗂️ services/            # ビジネスロジック・外部サービス連携
│   ├── 📄 analysis.ts       # 日記分析メインサービス
│   ├── 📄 openai.ts         # OpenAI API クライアント
│   ├── 📄 summary.ts        # 履歴要約サービス
│   ├── 🗂️ database/        # データベースアクセス層
│   │   ├── 📄 index.ts      # データベースサービス統合
│   │   ├── 📄 entries.ts    # 日記エントリー操作
│   │   ├── 📄 analyses.ts   # 分析結果操作
│   │   └── 📄 summaries.ts  # 要約データ操作
│   └── 🗂️ line/            # LINE API連携
│       ├── 📄 client.ts     # LINE APIクライアント
│       ├── 📄 message.ts    # メッセージ処理・ローディングアニメーション
│       └── 📄 signature.ts  # 署名検証
├── 🗂️ types/               # TypeScript型定義
│   ├── 📄 bindings.ts       # Cloudflare Workers バインディング型
│   └── 📄 database.ts       # データベーステーブル型定義
└── 🗂️ utils/               # ユーティリティ・共通機能
    └── 📄 error-handler.ts  # 包括的エラーハンドリング
```

---

## 🧩 主要ファイルの詳細

### 🎛️ handlers/（リクエスト処理）

| ファイル | 役割 | 主要機能 |
|----------|------|----------|
| `index.ts` | アプリエントリー | Honoアプリ設定・グローバルエラーハンドラー・ルーティング |
| `webhook.ts` | LINE Webhook | 署名検証・イベント処理・並列処理・エラーハンドリング |
| `scheduled.ts` | バッチ処理 | 定期クリーンアップ・キャッシュ更新・使用量最適化 |
| `health.ts` | ヘルスチェック | サーバー稼働状態確認エンドポイント |

### 🔧 services/（ビジネスロジック）

| ファイル | 役割 | 主要機能 |
|----------|------|----------|
| `analysis.ts` | 日記分析 | メイン分析フロー・エラーハンドリング・結果保存 |
| `summary.ts` | 履歴要約 | 7日間要約生成・キャッシュ管理・レースコンディション対策 |
| `openai.ts` | OpenAI連携 | GPT API呼び出し・レスポンス処理・エラーハンドリング |
| `line/message.ts` | LINE メッセージ | ローディングアニメーション・メッセージ送信・フォールバック |
| `line/signature.ts` | 署名検証 | HMAC署名検証・セキュリティ確保 |

### 🗃️ database/（データアクセス層）

| ファイル | 役割 | 主要機能 |
|----------|------|----------|
| `entries.ts` | 日記エントリー | CRUD操作・時系列検索・ユーザー別フィルタ |
| `analyses.ts` | 分析結果 | 分析データ保存・取得・エントリーとの関連 |
| `summaries.ts` | 要約データ | キャッシュ管理・日付範囲検索・期限チェック |

### 🛡️ utils/（共通機能）

| ファイル | 役割 | 主要機能 |
|----------|------|----------|
| `error-handler.ts` | エラー管理 | エラー分類・リトライ機能・サーキットブレーカー・ログ出力 |

---

## 🧪 test/（テスト）

```
test/
├── 📄 env.d.ts              # テスト環境型定義
├── 📄 index.spec.ts         # メインテストスイート
└── 📄 tsconfig.json         # テスト用TypeScript設定
```

---

## 📊 public/（静的ファイル）

```
public/
└── 📄 index.html            # 静的HTML（デフォルトページ）
```

---

## 🔧 設定ファイル詳細

### package.json - 利用可能なスクリプト

| スクリプト | 機能 | 用途 |
|------------|------|------|
| `pnpm dev` | 開発サーバー起動 | ローカル開発・デバッグ |
| `pnpm deploy` | 本番デプロイ | Cloudflare Workers へのデプロイ |
| `pnpm test` | テスト実行 | Vitest による単体・統合テスト |
| `pnpm format` | コード整形 | Prettier によるコード自動整形 |
| `pnpm db:seed` | データ初期化 | データベースへのシードデータ投入 |
| `pnpm db:erd` | ER図生成 | データベーススキーマの図表生成 |
| `pnpm db:erd:svg` | ER図SVG生成 | schema.dbmlからSVG形式のER図を生成 |
| `pnpm db:erd:png` | ER図PNG生成 | schema.dbmlからPNG形式のER図を生成 |

### wrangler.jsonc - Cloudflare Workers設定

| 設定項目 | 内容 | 説明 |
|----------|------|------|
| `name` | "mentor-diary" | Workerアプリケーション名 |
| `d1_databases` | DB設定 | Cloudflare D1 データベース接続 |
| `triggers.crons` | ["0 2 * * *", "0 14 * * *"] | バッチ処理スケジュール（午前2時・午後2時） |
| `observability` | true | パフォーマンス監視・ログ取得 |

---

## 🚀 開発フロー

1. **ローカル開発**: `pnpm dev` でローカル開発サーバー起動
2. **テスト実行**: `pnpm test` で自動テスト
3. **コード整形**: `pnpm format` で統一フォーマット
4. **データベース準備**: `pnpm db:seed` で初期データ投入
5. **デプロイ**: `pnpm deploy` で本番環境へ

---

## 📝 ファイル命名規則

### TypeScript ファイル
- **ケバブケース**: `error-handler.ts`, `diary-analysis.ts`
- **機能別ディレクトリ**: `services/`, `handlers/`, `utils/`
- **型定義ファイル**: `*.d.ts` 拡張子

### ドキュメントファイル
- **ケバブケース**: `directory-structure.md`, `api-specification.md`
- **階層構造**: `_llm-docs/` 配下に分類

### データベースファイル
- **連番管理**: `0001_create_tables.sql`
- **説明的命名**: 機能が分かるファイル名

---

## 🔍 ファイル検索・編集ガイド

### よく編集するファイル
- **新機能追加**: `src/services/` 配下のサービスファイル
- **エラーメッセージ変更**: `src/constants/messages.ts`
- **データベーススキーマ変更**: `migrations/` 配下のSQLファイル
- **API仕様変更**: `src/handlers/` 配下のハンドラーファイル

### 設定変更時
- **依存関係追加**: `package.json`
- **Worker設定変更**: `wrangler.jsonc`
- **TypeScript設定**: `tsconfig.json`
- **テスト設定**: `vitest.config.mts`

---

## 🎯 まとめ

このディレクトリ構成は以下の原則に基づいて設計されています：

1. **機能別分離**: handlers, services, utils の明確な役割分担
2. **レイヤード アーキテクチャ**: プレゼンテーション層、ビジネス層、データ層の分離
3. **保守性重視**: 関連ファイルの近接配置、命名規則の統一
4. **開発効率**: スクリプト自動化、設定ファイルの集約
5. **文書化**: ドキュメント、コメント、型定義による可読性確保

このディレクトリ構成により、新規開発者のオンボーディング効率化と、システムの保守性向上を実現しています。