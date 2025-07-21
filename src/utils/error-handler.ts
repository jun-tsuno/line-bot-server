/**
 * 包括的エラーハンドリングユーティリティ
 * リトライロジック、サーキットブレーカー、エラー分類機能を提供
 */

import {
	API_CONFIG,
	DATABASE_ERRORS,
	ERROR_NAMES,
	LINE_ERRORS,
	USER_MESSAGES,
} from "../constants/messages";

/**
 * エラー分類
 */
export enum ErrorCategory {
	TEMPORARY = "temporary", // 一時的エラー（リトライ可能）
	PERMANENT = "permanent", // 永続的エラー（リトライ不可）
	RATE_LIMIT = "rate_limit", // レート制限エラー
	NETWORK = "network", // ネットワークエラー
	VALIDATION = "validation", // バリデーションエラー
	UNKNOWN = "unknown", // 不明なエラー
}

/**
 * エラー詳細情報
 */
export interface ErrorDetails {
	category: ErrorCategory;
	isRetryable: boolean;
	statusCode?: number;
	retryAfter?: number;
	originalError?: Error;
	userMessage?: string;
	logData?: Record<string, unknown>;
}

/**
 * リトライ設定
 */
export interface RetryConfig {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
	backoffMultiplier: number;
	retryCondition?: (error: Error) => boolean;
}

/**
 * サーキットブレーカー状態
 */
export enum CircuitState {
	CLOSED = "closed", // 正常状態
	OPEN = "open", // エラー状態（リクエスト拒否）
	HALF_OPEN = "half_open", // 回復テスト状態
}

/**
 * サーキットブレーカー設定
 */
export interface CircuitBreakerConfig {
	failureThreshold: number;
	resetTimeout: number;
	monitoringPeriod: number;
}

/**
 * サーキットブレーカー状態管理
 */
class CircuitBreakerState {
	public state: CircuitState = CircuitState.CLOSED;
	public failureCount = 0;
	public lastFailureTime = 0;
	public nextAttemptTime = 0;

	constructor(private config: CircuitBreakerConfig) {}

	public canExecute(): boolean {
		const now = Date.now();

		switch (this.state) {
			case CircuitState.CLOSED:
				return true;
			case CircuitState.OPEN:
				if (now >= this.nextAttemptTime) {
					this.state = CircuitState.HALF_OPEN;
					return true;
				}
				return false;
			case CircuitState.HALF_OPEN:
				return true;
			default:
				return false;
		}
	}

	public onSuccess(): void {
		this.failureCount = 0;
		this.state = CircuitState.CLOSED;
	}

	public onFailure(): void {
		this.failureCount++;
		this.lastFailureTime = Date.now();

		if (this.failureCount >= this.config.failureThreshold) {
			this.state = CircuitState.OPEN;
			this.nextAttemptTime = this.lastFailureTime + this.config.resetTimeout;
		}
	}

	public getStatus() {
		return {
			state: this.state,
			failureCount: this.failureCount,
			nextAttemptTime: this.nextAttemptTime,
		};
	}
}

/**
 * カスタムエラークラス
 */
export class EnhancedError extends Error {
	public readonly category: ErrorCategory;
	public readonly isRetryable: boolean;
	public readonly statusCode?: number;
	public readonly retryAfter?: number;
	public readonly userMessage?: string;
	public readonly logData?: Record<string, unknown>;

	constructor(message: string, details: Partial<ErrorDetails> = {}) {
		super(message);
		this.name = "EnhancedError";
		this.category = details.category ?? ErrorCategory.UNKNOWN;
		this.isRetryable = details.isRetryable ?? false;
		this.statusCode = details.statusCode;
		this.retryAfter = details.retryAfter;
		this.userMessage = details.userMessage ?? USER_MESSAGES.ANALYSIS_ERROR;
		this.logData = details.logData;
	}
}

/**
 * 包括的エラーハンドラークラス
 */
export class ErrorHandler {
	private circuitBreakers = new Map<string, CircuitBreakerState>();
	private defaultRetryConfig: RetryConfig = {
		maxRetries: API_CONFIG.MAX_RETRIES,
		baseDelay: API_CONFIG.BASE_DELAY,
		maxDelay: API_CONFIG.MAX_DELAY,
		backoffMultiplier: API_CONFIG.BACKOFF_MULTIPLIER,
	};
	private defaultCircuitConfig: CircuitBreakerConfig = {
		failureThreshold: 5,
		resetTimeout: 60000, // 60秒
		monitoringPeriod: 60000, // 60秒
	};

	/**
	 * エラーを分類し詳細情報を付与
	 */
	public classifyError(error: Error, context?: string): ErrorDetails {
		// OpenAI APIエラー
		if (
			error.name === ERROR_NAMES.OPENAI_ERROR ||
			error.message.includes("OpenAI")
		) {
			return this.classifyOpenAIError(error);
		}

		// データベースエラー
		if (
			error.message.includes("D1") ||
			error.message.includes("database") ||
			Object.values(DATABASE_ERRORS).some((msg) => error.message.includes(msg))
		) {
			return this.classifyDatabaseError(error);
		}

		// LINE APIエラー
		if (
			error.message.includes("LINE") ||
			Object.values(LINE_ERRORS).some((msg) => error.message.includes(msg))
		) {
			return this.classifyLineError(error);
		}

		// ネットワークエラー
		if (
			error.name === ERROR_NAMES.TIMEOUT_ERROR ||
			error.name === ERROR_NAMES.ABORT_ERROR ||
			error.message.includes("fetch") ||
			error.message.includes("network")
		) {
			return {
				category: ErrorCategory.NETWORK,
				isRetryable: true,
				originalError: error,
				userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
				logData: { context, errorType: "network" },
			};
		}

		// デフォルト（不明なエラー）
		return {
			category: ErrorCategory.UNKNOWN,
			isRetryable: false,
			originalError: error,
			userMessage: USER_MESSAGES.ANALYSIS_ERROR,
			logData: { context, errorType: "unknown" },
		};
	}

	/**
	 * OpenAIエラーの分類
	 */
	private classifyOpenAIError(error: Error): ErrorDetails {
		const statusCode = (error as Error & { statusCode?: number }).statusCode;

		if (statusCode === 429) {
			const retryAfter = (error as Error & { rateLimitReset?: number })
				.rateLimitReset;
			return {
				category: ErrorCategory.RATE_LIMIT,
				isRetryable: true,
				statusCode,
				retryAfter,
				originalError: error,
				userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
				logData: { service: "openai", errorType: "rate_limit" },
			};
		}

		if (statusCode && statusCode >= 500) {
			return {
				category: ErrorCategory.TEMPORARY,
				isRetryable: true,
				statusCode,
				originalError: error,
				userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
				logData: { service: "openai", errorType: "server_error" },
			};
		}

		if (statusCode && statusCode >= 400 && statusCode < 500) {
			return {
				category: ErrorCategory.PERMANENT,
				isRetryable: false,
				statusCode,
				originalError: error,
				userMessage: USER_MESSAGES.ANALYSIS_ERROR,
				logData: { service: "openai", errorType: "client_error" },
			};
		}

		return {
			category: ErrorCategory.NETWORK,
			isRetryable: true,
			originalError: error,
			userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
			logData: { service: "openai", errorType: "network" },
		};
	}

	/**
	 * データベースエラーの分類
	 */
	private classifyDatabaseError(error: Error): ErrorDetails {
		// 接続エラーやタイムアウトは一時的エラーとして扱う
		if (
			error.message.includes("timeout") ||
			error.message.includes("connection") ||
			error.message.includes("network")
		) {
			return {
				category: ErrorCategory.TEMPORARY,
				isRetryable: true,
				originalError: error,
				userMessage: USER_MESSAGES.ANALYSIS_ERROR,
				logData: { service: "database", errorType: "connection" },
			};
		}

		// SQLエラーなどは永続的エラー
		return {
			category: ErrorCategory.PERMANENT,
			isRetryable: false,
			originalError: error,
			userMessage: USER_MESSAGES.ANALYSIS_ERROR,
			logData: { service: "database", errorType: "sql" },
		};
	}

	/**
	 * LINE APIエラーの分類
	 */
	private classifyLineError(error: Error): ErrorDetails {
		const statusCode =
			(error as Error & { statusCode?: number; status?: number }).statusCode ||
			(error as Error & { statusCode?: number; status?: number }).status;

		if (statusCode === 429) {
			return {
				category: ErrorCategory.RATE_LIMIT,
				isRetryable: true,
				statusCode,
				originalError: error,
				userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
				logData: { service: "line", errorType: "rate_limit" },
			};
		}

		if (statusCode && statusCode >= 500) {
			return {
				category: ErrorCategory.TEMPORARY,
				isRetryable: true,
				statusCode,
				originalError: error,
				userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
				logData: { service: "line", errorType: "server_error" },
			};
		}

		return {
			category: ErrorCategory.PERMANENT,
			isRetryable: false,
			statusCode,
			originalError: error,
			userMessage: USER_MESSAGES.ANALYSIS_ERROR,
			logData: { service: "line", errorType: "client_error" },
		};
	}

	/**
	 * 指数バックオフによる遅延計算
	 */
	private calculateDelay(attempt: number, config: RetryConfig): number {
		const delay = config.baseDelay * config.backoffMultiplier ** attempt;
		return Math.min(delay, config.maxDelay);
	}

	/**
	 * 遅延実行
	 */
	private async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * サーキットブレーカーを取得または作成
	 */
	private getCircuitBreaker(key: string): CircuitBreakerState {
		if (!this.circuitBreakers.has(key)) {
			this.circuitBreakers.set(
				key,
				new CircuitBreakerState(this.defaultCircuitConfig),
			);
		}
		const breaker = this.circuitBreakers.get(key);
		if (!breaker) {
			throw new Error(`Circuit breaker not found for key: ${key}`);
		}
		return breaker;
	}

	/**
	 * リトライ機能付きでファンクションを実行
	 */
	async executeWithRetry<T>(
		operation: () => Promise<T>,
		context: string,
		config: Partial<RetryConfig> = {},
	): Promise<T> {
		const retryConfig = { ...this.defaultRetryConfig, ...config };
		let lastError: Error = new Error("No operation attempted");

		for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;
				const errorDetails = this.classifyError(lastError, context);

				// リトライ不可能なエラーの場合は即座に失敗
				if (!errorDetails.isRetryable) {
					this.logError(lastError, errorDetails, context, attempt);
					throw new EnhancedError(lastError.message, errorDetails);
				}

				// 最大リトライ回数に達した場合は失敗
				if (attempt >= retryConfig.maxRetries) {
					this.logError(lastError, errorDetails, context, attempt);
					throw new EnhancedError(lastError.message, errorDetails);
				}

				// カスタムリトライ条件のチェック
				if (
					retryConfig.retryCondition &&
					!retryConfig.retryCondition(lastError)
				) {
					this.logError(lastError, errorDetails, context, attempt);
					throw new EnhancedError(lastError.message, errorDetails);
				}

				// リトライ前の遅延
				const delay = this.calculateDelay(attempt, retryConfig);

				// レート制限エラーの場合はリセット時間を考慮
				if (
					errorDetails.category === ErrorCategory.RATE_LIMIT &&
					errorDetails.retryAfter
				) {
					const rateLimitDelay = errorDetails.retryAfter * 1000;
					await this.delay(Math.max(delay, rateLimitDelay));
				} else {
					await this.delay(delay);
				}

				console.warn(
					`Retrying operation "${context}" (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}):`,
					{
						error: lastError.message,
						delay,
						errorDetails,
					},
				);
			}
		}

		// 到達しないコードパス（型安全性のため）
		throw new EnhancedError(
			lastError.message,
			this.classifyError(lastError, context),
		);
	}

	/**
	 * サーキットブレーカー機能付きでファンクションを実行
	 */
	async executeWithCircuitBreaker<T>(
		operation: () => Promise<T>,
		circuitKey: string,
		context: string,
	): Promise<T> {
		const circuit = this.getCircuitBreaker(circuitKey);

		if (!circuit.canExecute()) {
			const error = new Error(`Circuit breaker is OPEN for ${circuitKey}`);
			const errorDetails: ErrorDetails = {
				category: ErrorCategory.TEMPORARY,
				isRetryable: false,
				userMessage: USER_MESSAGES.AI_SERVICE_TEMPORARY_ISSUE,
				logData: { circuitKey, context, circuitState: circuit.getStatus() },
			};
			this.logError(error, errorDetails, context);
			throw new EnhancedError(error.message, errorDetails);
		}

		try {
			const result = await operation();
			circuit.onSuccess();
			return result;
		} catch (error) {
			circuit.onFailure();
			const errorDetails = this.classifyError(error as Error, context);
			errorDetails.logData = {
				...errorDetails.logData,
				circuitKey,
				circuitState: circuit.getStatus(),
			};
			this.logError(error as Error, errorDetails, context);
			throw new EnhancedError((error as Error).message, errorDetails);
		}
	}

	/**
	 * リトライ＋サーキットブレーカー機能付きでファンクションを実行
	 */
	async executeWithProtection<T>(
		operation: () => Promise<T>,
		circuitKey: string,
		context: string,
		retryConfig: Partial<RetryConfig> = {},
	): Promise<T> {
		return this.executeWithCircuitBreaker(
			() => this.executeWithRetry(operation, context, retryConfig),
			circuitKey,
			context,
		);
	}

	/**
	 * エラーログの出力
	 */
	private logError(
		error: Error,
		errorDetails: ErrorDetails,
		context: string,
		attempt?: number,
	): void {
		const logLevel =
			errorDetails.category === ErrorCategory.TEMPORARY ? "warn" : "error";
		const logData = {
			context,
			attempt,
			category: errorDetails.category,
			isRetryable: errorDetails.isRetryable,
			statusCode: errorDetails.statusCode,
			retryAfter: errorDetails.retryAfter,
			message: error.message,
			stack: error.stack,
			timestamp: new Date().toISOString(),
			...errorDetails.logData,
		};

		if (logLevel === "error") {
			console.error(`Error in ${context}:`, logData);
		} else {
			console.warn(`Temporary error in ${context}:`, logData);
		}
	}

	/**
	 * サーキットブレーカーの状態を取得
	 */
	public getCircuitBreakerStatus(key: string) {
		const circuit = this.circuitBreakers.get(key);
		return circuit ? circuit.getStatus() : null;
	}

	/**
	 * サーキットブレーカーのリセット
	 */
	public resetCircuitBreaker(key: string): void {
		const circuit = this.circuitBreakers.get(key);
		if (circuit) {
			circuit.onSuccess();
		}
	}

	/**
	 * すべてのサーキットブレーカーの状態を取得
	 */
	public getAllCircuitBreakerStatus() {
		const status: Record<
			string,
			ReturnType<CircuitBreakerState["getStatus"]>
		> = {};
		for (const [key, circuit] of this.circuitBreakers.entries()) {
			status[key] = circuit.getStatus();
		}
		return status;
	}
}

/**
 * グローバルエラーハンドラーインスタンス
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * ヘルパー関数：エラーハンドリング付きの非同期実行
 */
export async function withErrorHandling<T>(
	operation: () => Promise<T>,
	context: string,
	options: {
		useCircuitBreaker?: boolean;
		circuitKey?: string;
		retryConfig?: Partial<RetryConfig>;
	} = {},
): Promise<T> {
	const { useCircuitBreaker = false, circuitKey, retryConfig } = options;

	if (useCircuitBreaker && circuitKey) {
		return globalErrorHandler.executeWithProtection(
			operation,
			circuitKey,
			context,
			retryConfig,
		);
	}
	return globalErrorHandler.executeWithRetry(operation, context, retryConfig);
}

/**
 * ヘルパー関数：エラーからユーザーメッセージを取得
 */
export function getUserMessageFromError(
	error: Error,
	context?: string,
): string {
	if (error instanceof EnhancedError) {
		return error.userMessage || USER_MESSAGES.ANALYSIS_ERROR;
	}

	const errorDetails = globalErrorHandler.classifyError(error, context);
	return errorDetails.userMessage || USER_MESSAGES.ANALYSIS_ERROR;
}
