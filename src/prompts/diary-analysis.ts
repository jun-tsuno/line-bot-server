/**
 * 日記分析用のGPTプロンプトテンプレート
 */

import {
  ANALYSIS_ERRORS,
  ANALYSIS_FALLBACK,
  ANALYSIS_FORMAT,
} from '../constants/messages';

/**
 * 分析結果の構造化データ型
 */
export interface AnalysisResult {
  emotion: string;
  themes: string;
  patterns: string;
  positive_points: string;
}

/**
 * 日記分析用のシステムプロンプト
 */
export const DIARY_ANALYSIS_SYSTEM_PROMPT = `あなたはユーザーの日記を分析し、心理的サポートを提供するAIアシスタントです。

日記の内容を読み、以下の4つの観点から分析を行い、JSON形式で構造化された結果を返してください。

【重要】各項目は必ず指定された文字数以内で簡潔にまとめてください：

1. emotion: 現在の感情状態と感情の変化（80-100文字程度、最大100文字）
2. themes: 主要なテーマや思考パターン（80-100文字程度、最大100文字）
3. patterns: 行動パターンや習慣の特徴（80-100文字程度、最大100文字）
4. positive_points: ポジティブな点・成長の兆し・励ましのメッセージ（80-100文字程度、最大100文字）

必ず以下のJSON形式で回答してください：
{
  "emotion": "感情分析の結果（100文字以内）",
  "themes": "主要テーマの分析（100文字以内）",
  "patterns": "パターン分析の結果（100文字以内）",
  "positive_points": "ポジティブな点と励まし（100文字以内）"
}

親しみやすく温かみのある文体で、ユーザーに寄り添うような分析を心がけてください。
各項目は要点を絞って簡潔に表現してください。`;

/**
 * 日記分析用のユーザープロンプトを生成
 */
export function generateDiaryAnalysisPrompt(
  diaryEntry: string,
  historySummary?: string
): string {
  let prompt = '';

  if (historySummary) {
    prompt += `${ANALYSIS_FORMAT.HISTORY_PREFIX}\n${historySummary}\n\n`;
  }

  prompt += `${ANALYSIS_FORMAT.DIARY_PREFIX}\n${diaryEntry}`;

  return prompt;
}

/**
 * 分析結果をパースする
 */
export function parseAnalysisResult(response: string): AnalysisResult {
  // jsonStringを外側のスコープで定義
  let jsonString = '';

  try {
    // デバッグ用ログ：受信した応答全体を確認
    console.log('AI応答（生データ）:', response);
    console.log('AI応答の長さ:', response.length);

    // JSONブロックを抽出（```json で囲まれている場合も対応）
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
      response.match(/```\s*([\s\S]*?)\s*```/) || [null, response];

    jsonString = jsonMatch[1] || response;

    // デバッグ用ログ：抽出したJSON文字列を確認
    console.log('抽出したJSON文字列:', jsonString);
    console.log('JSON文字列の長さ:', jsonString.length);

    const parsed = JSON.parse(jsonString.trim());

    // 必須フィールドの存在確認
    if (
      !parsed.emotion ||
      !parsed.themes ||
      !parsed.patterns ||
      !parsed.positive_points
    ) {
      throw new Error(ANALYSIS_ERRORS.MISSING_REQUIRED_FIELDS);
    }

    return {
      emotion: String(parsed.emotion).substring(0, 100),
      themes: String(parsed.themes).substring(0, 100),
      patterns: String(parsed.patterns).substring(0, 100),
      positive_points: String(parsed.positive_points).substring(0, 150),
    };
  } catch (error) {
    console.error(ANALYSIS_ERRORS.PARSE_RESULT_FAILED, error);

    // エラー時の詳細な処理
    if (error instanceof SyntaxError) {
      console.error('JSONパースエラー - 不完全な応答の可能性があります');
      console.error('エラー位置:', error.message);

      // 不完全なJSONを修復する試み
      try {
        // 末尾の閉じカッコを追加して再パース
        const trimmedResponse = jsonString.trim();
        let fixedJson = trimmedResponse;

        // 文字列が途中で切れている可能性をチェック
        const lastChar = trimmedResponse[trimmedResponse.length - 1];
        if (lastChar !== '}') {
          // 最後の不完全な値を削除して閉じる
          const lastCommaIndex = trimmedResponse.lastIndexOf(',');
          if (lastCommaIndex > 0) {
            fixedJson = trimmedResponse.substring(0, lastCommaIndex) + '}';
          } else {
            // 引用符を閉じてからオブジェクトを閉じる
            fixedJson = trimmedResponse + '"}';
          }
        }

        console.log(
          '修復を試みたJSON（最初の500文字）:',
          fixedJson.substring(0, 500)
        );
        const parsed = JSON.parse(fixedJson);

        // 最低限の必須フィールドがある場合は使用
        if (parsed.emotion || parsed.themes) {
          console.log('修復されたJSONから部分的な結果を返します');
          return {
            emotion: String(
              parsed.emotion || '感情の分析中にエラーが発生しました'
            ).substring(0, 100),
            themes: String(
              parsed.themes || 'テーマの抽出中にエラーが発生しました'
            ).substring(0, 100),
            patterns: String(
              parsed.patterns || 'パターンの分析中にエラーが発生しました'
            ).substring(0, 100),
            positive_points: String(
              parsed.positive_points ||
                'ポジティブな要素の抽出中にエラーが発生しました'
            ).substring(0, 150),
          };
        }
      } catch (repairError) {
        console.error('JSON修復にも失敗しました:', repairError);
      }
    }

    // フォールバック：構造化されていない応答の場合
    return {
      emotion: ANALYSIS_FALLBACK.EMOTION,
      themes: ANALYSIS_FALLBACK.THEMES,
      patterns: ANALYSIS_FALLBACK.PATTERNS,
      positive_points: ANALYSIS_FALLBACK.POSITIVE_POINTS,
    };
  }
}
