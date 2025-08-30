// API設定
export const API_CONFIG = {
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  DEFAULT_MODEL: 'gpt-3.5-turbo',
  TIMEOUT: 30000, // 30秒（OpenAI APIの安定性向上）
  MAX_RETRIES: 1, // 3回 → 1回（CPU使用量削減）
  BASE_DELAY: 500, // 1秒 → 0.5秒（高速化）
  MAX_DELAY: 2000, // 10秒 → 2秒（高速化）
  BACKOFF_MULTIPLIER: 2,
} as const;

// CPU最適化用AI設定
export const OPTIMIZED_AI_CONFIG = {
  MAX_TOKENS: 300, // 1000 → 300（CPU使用量削減）
  TEMPERATURE: 0.3, // 0.7 → 0.3（CPU使用量削減）
  SUMMARY_MAX_TOKENS: 150, // 200 → 150（CPU使用量削減）
  SUMMARY_TEMPERATURE: 0.2, // 0.7 → 0.2（CPU使用量削減）
} as const;

// サーキットブレーカー設定
export const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5,
  RESET_TIMEOUT: 60000, // 60秒
  MONITORING_PERIOD: 60000, // 60秒
} as const;

// エラーハンドラー設定
export const ERROR_HANDLER_CONFIG = {
  DATABASE_TIMEOUT: 10000, // 10秒
  LINE_API_TIMEOUT: 15000, // 15秒
  MAX_DB_RETRIES: 2,
  MAX_LINE_RETRIES: 3,
} as const;

// HTTP関連
export const HTTP_HEADERS = {
  AUTHORIZATION_PREFIX: 'Bearer',
  CONTENT_TYPE_JSON: 'application/json',
  X_RATELIMIT_RESET: 'x-ratelimit-reset-requests',
} as const;