/**
 * OpenAI APIクライアント
 * Chat Completions APIを使用して日記の分析を行う
 */

import {
	API_CONFIG,
	ERROR_NAMES,
	HTTP_HEADERS,
	OPENAI_ERRORS,
	TEST_MESSAGES,
} from "../constants/messages";
import type { Bindings } from "../types/bindings";

/**
 * OpenAI API関連のエラータイプ
 */
export class OpenAIError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public rateLimitReset?: number,
	) {
		super(message);
		this.name = ERROR_NAMES.OPENAI_ERROR;
	}
}

/**
 * OpenAI APIのリクエスト・レスポンス型定義
 */
export interface ChatCompletionRequest {
	model: string;
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	max_tokens?: number;
	temperature?: number;
}

export interface ChatCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * リトライ設定
 */
interface RetryConfig {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
	backoffMultiplier: number;
}

/**
 * OpenAI APIクライアントクラス
 */
export class OpenAIClient {
	private apiKey: string;
	private baseURL = API_CONFIG.OPENAI_BASE_URL;
	private defaultModel = API_CONFIG.DEFAULT_MODEL;
	private timeout = API_CONFIG.TIMEOUT;
	private retryConfig: RetryConfig = {
		maxRetries: API_CONFIG.MAX_RETRIES,
		baseDelay: API_CONFIG.BASE_DELAY,
		maxDelay: API_CONFIG.MAX_DELAY,
		backoffMultiplier: API_CONFIG.BACKOFF_MULTIPLIER,
	};

	constructor(apiKey: string) {
		if (!apiKey) {
			throw new OpenAIError(OPENAI_ERRORS.API_KEY_REQUIRED);
		}
		this.apiKey = apiKey;
	}

	/**
	 * 指数バックオフによる遅延計算
	 */
	private calculateDelay(attempt: number): number {
		const delay =
			this.retryConfig.baseDelay *
			this.retryConfig.backoffMultiplier ** attempt;
		return Math.min(delay, this.retryConfig.maxDelay);
	}

	/**
	 * 遅延実行
	 */
	private async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * リトライ可能なエラーかどうかを判定
	 */
	private isRetryableError(error: OpenAIError): boolean {
		if (!error.statusCode) return false;

		// 429 (Rate Limit), 500-599 (Server Error)はリトライ可能
		return (
			error.statusCode === 429 ||
			(error.statusCode >= 500 && error.statusCode < 600)
		);
	}

	/**
	 * HTTPリクエストの実行（リトライ機能付き）
	 */
	private async makeRequest(
		endpoint: string,
		body: ChatCompletionRequest,
		attempt = 0,
	): Promise<Response> {
		const url = `${this.baseURL}${endpoint}`;

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `${HTTP_HEADERS.AUTHORIZATION_PREFIX} ${this.apiKey}`,
					"Content-Type": HTTP_HEADERS.CONTENT_TYPE_JSON,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.timeout),
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorMessage = `${OPENAI_ERRORS.HTTP_ERROR_PREFIX} ${response.status}: ${response.statusText}`;

				try {
					const errorJson = JSON.parse(errorText);
					if (errorJson.error?.message) {
						errorMessage = errorJson.error.message;
					}
				} catch {
					// JSONパースに失敗した場合はテキストをそのまま使用
					if (errorText) {
						errorMessage = errorText;
					}
				}

				const rateLimitReset = response.headers.get(
					HTTP_HEADERS.X_RATELIMIT_RESET,
				);
				const resetTime = rateLimitReset
					? Number.parseInt(rateLimitReset, 10)
					: undefined;

				throw new OpenAIError(errorMessage, response.status, resetTime);
			}

			return response;
		} catch (error) {
			if (error instanceof OpenAIError) {
				// リトライ可能なエラーかつ、最大リトライ回数に達していない場合はリトライ
				if (
					this.isRetryableError(error) &&
					attempt < this.retryConfig.maxRetries
				) {
					const delay = this.calculateDelay(attempt);

					// Rate Limitエラーの場合はリセット時間を考慮
					if (error.statusCode === 429 && error.rateLimitReset) {
						const resetDelay = error.rateLimitReset * 1000;
						await this.delay(Math.max(delay, resetDelay));
					} else {
						await this.delay(delay);
					}

					return this.makeRequest(endpoint, body, attempt + 1);
				}

				throw error;
			}

			// タイムアウトやネットワークエラー
			if (
				error instanceof Error &&
				(error.name === ERROR_NAMES.TIMEOUT_ERROR ||
					error.name === ERROR_NAMES.ABORT_ERROR)
			) {
				const timeoutError = new OpenAIError(
					OPENAI_ERRORS.REQUEST_TIMEOUT,
					408,
				);

				if (attempt < this.retryConfig.maxRetries) {
					const delay = this.calculateDelay(attempt);
					await this.delay(delay);
					return this.makeRequest(endpoint, body, attempt + 1);
				}

				throw timeoutError;
			}

			// その他のネットワークエラー
			const errorMessage =
				error instanceof Error
					? error.message
					: OPENAI_ERRORS.UNKNOWN_ERROR_FALLBACK;
			const networkError = new OpenAIError(
				`${OPENAI_ERRORS.NETWORK_ERROR} ${errorMessage}`,
				0,
			);

			if (attempt < this.retryConfig.maxRetries) {
				const delay = this.calculateDelay(attempt);
				await this.delay(delay);
				return this.makeRequest(endpoint, body, attempt + 1);
			}

			throw networkError;
		}
	}

	/**
	 * Chat Completions APIを呼び出し
	 */
	async createChatCompletion(
		messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
		options: {
			model?: string;
			maxTokens?: number;
			temperature?: number;
		} = {},
	): Promise<ChatCompletionResponse> {
		const request: ChatCompletionRequest = {
			model: options.model || this.defaultModel,
			messages,
			max_tokens: options.maxTokens || 1000,
			temperature: options.temperature ?? 0.7,
		};

		const response = await this.makeRequest("/chat/completions", request);
		return (await response.json()) as ChatCompletionResponse;
	}

	/**
	 * 日記分析用のプロンプトを生成
	 */
	private generateAnalysisPrompt(
		diaryEntry: string,
		historySummary?: string,
	): Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}> {
		const systemPrompt = `あなたはユーザーの日記を分析するAIアシスタントです。
日記の内容を読み、以下の観点から分析してください：

1. 現在の感情状態と感情の変化
2. 主要なテーマや思考パターン
3. ポジティブな点や成長の兆し
4. 励ましやアドバイス

分析結果は自然で親しみやすい文体で返してください。`;

		const messages: Array<{
			role: "system" | "user" | "assistant";
			content: string;
		}> = [{ role: "system", content: systemPrompt }];

		if (historySummary) {
			messages.push({
				role: "user",
				content: `【過去7日間の傾向】\n${historySummary}`,
			});
		}

		messages.push({
			role: "user",
			content: `【本日の投稿】\n${diaryEntry}`,
		});

		return messages;
	}

	/**
	 * 日記を分析する
	 */
	async analyzeDiary(
		diaryEntry: string,
		historySummary?: string,
	): Promise<string> {
		if (!diaryEntry || diaryEntry.trim().length === 0) {
			throw new OpenAIError(OPENAI_ERRORS.DIARY_ENTRY_REQUIRED);
		}

		const messages = this.generateAnalysisPrompt(diaryEntry, historySummary);

		try {
			const response = await this.createChatCompletion(messages, {
				model: this.defaultModel,
				maxTokens: 1000,
				temperature: 0.7,
			});

			if (!response.choices || response.choices.length === 0) {
				throw new OpenAIError(OPENAI_ERRORS.NO_RESPONSE);
			}

			const analysis = response.choices[0].message.content;
			if (!analysis) {
				throw new OpenAIError(OPENAI_ERRORS.EMPTY_RESPONSE);
			}

			return analysis;
		} catch (error) {
			if (error instanceof OpenAIError) {
				throw error;
			}
			const errorMessage =
				error instanceof Error
					? error.message
					: OPENAI_ERRORS.UNKNOWN_ERROR_FALLBACK;
			throw new OpenAIError(`${OPENAI_ERRORS.ANALYSIS_FAILED} ${errorMessage}`);
		}
	}

	/**
	 * API接続テスト
	 */
	async testConnection(): Promise<boolean> {
		try {
			const testMessages = [
				{
					role: "user" as const,
					content: TEST_MESSAGES.CONNECTION_TEST,
				},
			];

			await this.createChatCompletion(testMessages, {
				model: this.defaultModel,
				maxTokens: 10,
				temperature: 0,
			});

			return true;
		} catch (error) {
			console.error(OPENAI_ERRORS.CONNECTION_TEST_FAILED, error);
			return false;
		}
	}
}

/**
 * OpenAIクライアントのファクトリー関数
 */
export function createOpenAIClient(env: Bindings): OpenAIClient {
	return new OpenAIClient(env.OPENAI_API_KEY);
}
