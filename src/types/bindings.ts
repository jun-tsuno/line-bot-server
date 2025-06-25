/**
 * Cloudflare Workers のバインディング
 * 環境変数の型定義
 */
export type Bindings = {
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  DB: D1Database;
};
