// 認証関連エラー
export const AUTH_ERRORS = {
	NO_SIGNATURE: "署名がありません",
	INVALID_SIGNATURE: "無効な署名です",
} as const;

// サーバー関連エラー
export const SERVER_ERRORS = {
	INTERNAL_SERVER_ERROR: "内部サーバーエラー",
	UNKNOWN_ERROR: "不明なエラー",
} as const;

// 分析関連エラー
export const ANALYSIS_ERRORS = {
	DIARY_ANALYSIS_FAILED: "日記分析に失敗しました:",
	HISTORY_SUMMARY_FAILED: "履歴要約の取得に失敗しました:",
	GPT_ANALYSIS_FAILED: "GPT分析に失敗しました:",
	RECENT_ANALYSES_FAILED: "最近の分析の取得に失敗しました:",
	ANALYSIS_BY_ENTRY_ID_FAILED: "エントリーIDによる分析の取得に失敗しました:",
	PARSE_RESULT_FAILED: "分析結果の解析に失敗しました:",
	MISSING_REQUIRED_FIELDS: "分析結果に必須フィールドがありません",
	PROCESS_ERROR_FALLBACK: "分析処理中にエラーが発生しました",
} as const;

// 分析用フォールバック値
export const ANALYSIS_FALLBACK = {
	EMOTION: "分析処理中にエラーが発生しました",
	THEMES: "分析処理中にエラーが発生しました",
	PATTERNS: "分析処理中にエラーが発生しました",
	POSITIVE_POINTS: "お疲れさまでした。明日も頑張りましょう！",
} as const;

// 分析用フォーマット
export const ANALYSIS_FORMAT = {
	HISTORY_PREFIX: "【過去7日間の傾向】",
	DIARY_PREFIX: "【本日の日記】",
	RESULT_TITLE: "📝 日記分析結果",
	EMOTION_SECTION: "🎭 **感情分析**",
	THEMES_SECTION: "🎯 **主なテーマ**",
	PATTERNS_SECTION: "🔄 **行動パターン**",
	POSITIVE_SECTION: "✨ **ポジティブポイント**",
	CLOSING_MESSAGE: "今日もお疲れさまでした！明日も素敵な一日にしましょう 🌟",
} as const;

// OpenAI関連エラー
export const OPENAI_ERRORS = {
	NO_RESPONSE: "OpenAI APIからのレスポンスがありません",
	EMPTY_RESPONSE: "OpenAI APIからの空のレスポンス",
	CONNECTION_TEST_FAILED: "OpenAI接続テストに失敗しました:",
	API_CONNECTION_FAILED: "OpenAI API接続テストに失敗しました",
	TEST_HANDLER_ERROR: "OpenAIテストハンドラーエラー:",
	API_KEY_REQUIRED: "OpenAI APIキーが必要です",
	DIARY_ENTRY_REQUIRED: "日記エントリーが必要です",
	ANALYSIS_FAILED: "分析に失敗しました:",
	REQUEST_TIMEOUT: "リクエストタイムアウト",
	NETWORK_ERROR: "ネットワークエラー:",
	UNKNOWN_ERROR_FALLBACK: "不明なエラー",
	HTTP_ERROR_PREFIX: "HTTPエラー",
} as const;

// データベース関連エラー
export const DATABASE_ERRORS = {
	CREATE_ANALYSIS_FAILED: "分析の作成に失敗しました",
	CREATE_ENTRY_FAILED: "エントリーの作成に失敗しました",
	CREATE_OR_UPDATE_SUMMARY_FAILED: "要約の作成または更新に失敗しました",
	CONNECTION_FAILED: "データベース接続に失敗しました",
	TIMEOUT: "データベース操作タイムアウト",
	TRANSACTION_FAILED: "データベーストランザクションに失敗しました",
	QUERY_FAILED: "データベースクエリに失敗しました",
	CONSTRAINT_VIOLATION: "データベース制約違反",
} as const;

// LINE関連エラー
export const LINE_ERRORS = {
	USER_ID_NOT_FOUND: "イベントにユーザーIDが見つかりません",
	PROCESS_DIARY_ENTRY_FAILED: "日記エントリーの処理に失敗しました:",
	API_REQUEST_FAILED: "LINE APIリクエストに失敗しました",
	RATE_LIMITED: "LINE APIレート制限を超えました",
	INVALID_REQUEST: "無効なLINE APIリクエスト",
	MESSAGE_SEND_FAILED: "LINEメッセージの送信に失敗しました",
	REPLY_TOKEN_INVALID: "無効なリプライトークン",
	WEBHOOK_VALIDATION_FAILED: "Webhook検証に失敗しました",
} as const;

// 一般的なエラー
export const GENERAL_ERRORS = {
	ERROR_PREFIX: "エラー:",
	LOG_ERROR: "エラー",
} as const;

// エラー名
export const ERROR_NAMES = {
	DIARY_ANALYSIS_ERROR: "DiaryAnalysisError",
	OPENAI_ERROR: "OpenAIError",
	TIMEOUT_ERROR: "TimeoutError",
	ABORT_ERROR: "AbortError",
} as const;

// 成功メッセージ
export const SUCCESS_MESSAGES = {
	OPENAI_CONNECTION_TEST: "OpenAI API接続テストに成功しました",
} as const;

// API設定
export const API_CONFIG = {
	OPENAI_BASE_URL: "https://api.openai.com/v1",
	DEFAULT_MODEL: "gpt-3.5-turbo",
	TIMEOUT: 30000,
	MAX_RETRIES: 3,
	BASE_DELAY: 1000,
	MAX_DELAY: 10000,
	BACKOFF_MULTIPLIER: 2,
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
	AUTHORIZATION_PREFIX: "Bearer",
	CONTENT_TYPE_JSON: "application/json",
	X_RATELIMIT_RESET: "x-ratelimit-reset-requests",
} as const;

// テスト関連メッセージ
export const TEST_MESSAGES = {
	CONNECTION_TEST: "こんにちは、これは接続テストです。",
} as const;

// ユーザー向けメッセージ（LINE）
export const USER_MESSAGES = {
	ANALYSIS_ERROR:
		"申し訳ございません。分析処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。",
	AI_SERVICE_TEMPORARY_ISSUE:
		"AI分析サービスに一時的な問題が発生しています。しばらく時間をおいて再度お試しください。",
} as const;

// ステータス
export const STATUS = {
	SUCCESS: "成功",
	ERROR: "エラー",
} as const;

// イベントタイプ
export const EVENT_TYPES = {
	MESSAGE: "message",
	TEXT: "text",
} as const;

// 後方互換性のため、ERROR_MESSAGESをエクスポート
export const ERROR_MESSAGES = {
	NO_SIGNATURE: AUTH_ERRORS.NO_SIGNATURE,
	INVALID_SIGNATURE: AUTH_ERRORS.INVALID_SIGNATURE,
	INTERNAL_SERVER_ERROR: SERVER_ERRORS.INTERNAL_SERVER_ERROR,
} as const;
