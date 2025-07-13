// 認証関連エラー
export const AUTH_ERRORS = {
  NO_SIGNATURE: 'No signature',
  INVALID_SIGNATURE: 'Invalid signature',
} as const;

// サーバー関連エラー
export const SERVER_ERRORS = {
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  UNKNOWN_ERROR: 'Unknown error',
} as const;

// 分析関連エラー
export const ANALYSIS_ERRORS = {
  DIARY_ANALYSIS_FAILED: 'Diary analysis failed:',
  HISTORY_SUMMARY_FAILED: 'Failed to get history summary:',
  GPT_ANALYSIS_FAILED: 'GPT analysis failed:',
  RECENT_ANALYSES_FAILED: 'Failed to get recent analyses:',
  ANALYSIS_BY_ENTRY_ID_FAILED: 'Failed to get analysis by entry ID:',
  PARSE_RESULT_FAILED: 'Failed to parse analysis result:',
  MISSING_REQUIRED_FIELDS: 'Missing required fields in analysis result',
  PROCESS_ERROR_FALLBACK: '分析処理中にエラーが発生しました',
} as const;

// 分析用フォールバック値
export const ANALYSIS_FALLBACK = {
  EMOTION: '分析処理中にエラーが発生しました',
  THEMES: '分析処理中にエラーが発生しました',
  PATTERNS: '分析処理中にエラーが発生しました',
  POSITIVE_POINTS: 'お疲れさまでした。明日も頑張りましょう！',
} as const;

// 分析用フォーマット
export const ANALYSIS_FORMAT = {
  HISTORY_PREFIX: '【過去7日間の傾向】',
  DIARY_PREFIX: '【本日の日記】',
  RESULT_TITLE: '📝 日記分析結果',
  EMOTION_SECTION: '🎭 **感情分析**',
  THEMES_SECTION: '🎯 **主なテーマ**',
  PATTERNS_SECTION: '🔄 **行動パターン**',
  POSITIVE_SECTION: '✨ **ポジティブポイント**',
  CLOSING_MESSAGE: '今日もお疲れさまでした！明日も素敵な一日にしましょう 🌟',
} as const;

// OpenAI関連エラー
export const OPENAI_ERRORS = {
  NO_RESPONSE: 'No response from OpenAI API',
  EMPTY_RESPONSE: 'Empty response from OpenAI API',
  CONNECTION_TEST_FAILED: 'OpenAI connection test failed:',
  API_CONNECTION_FAILED: 'OpenAI API connection test failed',
  TEST_HANDLER_ERROR: 'OpenAI test handler error:',
  API_KEY_REQUIRED: 'OpenAI API key is required',
  DIARY_ENTRY_REQUIRED: 'Diary entry is required',
  ANALYSIS_FAILED: 'Analysis failed:',
  REQUEST_TIMEOUT: 'Request timeout',
  NETWORK_ERROR: 'Network error:',
  UNKNOWN_ERROR_FALLBACK: 'Unknown error',
  HTTP_ERROR_PREFIX: 'HTTP',
} as const;

// データベース関連エラー
export const DATABASE_ERRORS = {
  CREATE_ANALYSIS_FAILED: 'Failed to create analysis',
  CREATE_ENTRY_FAILED: 'Failed to create entry',
  CREATE_OR_UPDATE_SUMMARY_FAILED: 'Failed to create or update summary',
} as const;

// LINE関連エラー
export const LINE_ERRORS = {
  USER_ID_NOT_FOUND: 'User ID not found in event',
  PROCESS_DIARY_ENTRY_FAILED: 'Failed to process diary entry:',
} as const;

// 一般的なエラー
export const GENERAL_ERRORS = {
  ERROR_PREFIX: 'Error:',
  LOG_ERROR: 'Error',
} as const;

// エラー名
export const ERROR_NAMES = {
  DIARY_ANALYSIS_ERROR: 'DiaryAnalysisError',
  OPENAI_ERROR: 'OpenAIError',
  TIMEOUT_ERROR: 'TimeoutError',
  ABORT_ERROR: 'AbortError',
} as const;

// 成功メッセージ
export const SUCCESS_MESSAGES = {
  OPENAI_CONNECTION_TEST: 'OpenAI API connection test successful',
} as const;

// API設定
export const API_CONFIG = {
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  DEFAULT_MODEL: 'gpt-3.5-turbo',
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// HTTP関連
export const HTTP_HEADERS = {
  AUTHORIZATION_PREFIX: 'Bearer',
  CONTENT_TYPE_JSON: 'application/json',
  X_RATELIMIT_RESET: 'x-ratelimit-reset-requests',
} as const;

// テスト関連メッセージ
export const TEST_MESSAGES = {
  CONNECTION_TEST: 'Hello, this is a connection test.',
} as const;

// ユーザー向けメッセージ（LINE）
export const USER_MESSAGES = {
  ANALYSIS_ERROR: '申し訳ございません。分析処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。',
  AI_SERVICE_TEMPORARY_ISSUE: 'AI分析サービスに一時的な問題が発生しています。しばらく時間をおいて再度お試しください。',
} as const;


// ステータス
export const STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

// イベントタイプ
export const EVENT_TYPES = {
  MESSAGE: 'message',
  TEXT: 'text',
} as const;


// 後方互換性のため、ERROR_MESSAGESをエクスポート
export const ERROR_MESSAGES = {
  NO_SIGNATURE: AUTH_ERRORS.NO_SIGNATURE,
  INVALID_SIGNATURE: AUTH_ERRORS.INVALID_SIGNATURE,
  INTERNAL_SERVER_ERROR: SERVER_ERRORS.INTERNAL_SERVER_ERROR,
} as const;
