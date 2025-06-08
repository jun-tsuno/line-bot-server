# 📘 AI日記リフレクションBot（MVP）

## 🎯 目的・コンセプト

ユーザーが LINE 上で日記を書くだけで、AI が感情や主題、傾向を分析・要約し、
自己理解・自己受容・内省習慣の定着をサポートする AI 日記 Bot。

---

## 🚀 プロジェクトのセットアップと起動

### 前提条件

- Node.js (v18以上)
- pnpm
- Cloudflareアカウント

### 初期化

1. **依存関係のインストール**
   ```bash
   pnpm install
   ```

### 環境設定

プロジェクト直下に `.dev.vars` ファイルを追加する

### 開発サーバーの起動

```bash
# 開発モードで起動
pnpm run dev

# または
pnpm start
```

### デプロイ

```bash
pnpm run deploy
```

### 利用可能なコマンド

| コマンド | 説明 |
|----------|------|
| `pnpm run dev` | 開発サーバーを起動 |
| `pnpm start` | 開発サーバーを起動（devと同じ） |
| `pnpm test` | テストを実行 |
| `pnpm run deploy` | Cloudflare Workersにデプロイ |
| `pnpm run cf-typegen` | Cloudflareの型定義を生成 |

---

## 🏗️ システム構成と使用技術

[プロジェクト仕様書](./docs/index.md)を参照してください。