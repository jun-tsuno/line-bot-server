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

日記の内容を読み、以下の4つの観点から分析を行い、JSON形式で構造化された結果を返してください：

1. emotion: 現在の感情状態と感情の変化（100文字以内）
2. themes: 主要なテーマや思考パターン（100文字以内）  
3. patterns: 行動パターンや習慣の特徴（100文字以内）
4. positive_points: ポジティブな点・成長の兆し・励ましのメッセージ（150文字以内）

必ず以下のJSON形式で回答してください：
{
  "emotion": "感情分析の結果",
  "themes": "主要テーマの分析",
  "patterns": "パターン分析の結果", 
  "positive_points": "ポジティブな点と励ましのメッセージ"
}

親しみやすく温かみのある文体で、ユーザーに寄り添うような分析を心がけてください。`;

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
  try {
    // JSONブロックを抽出（```json で囲まれている場合も対応）
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                     response.match(/```\s*([\s\S]*?)\s*```/) ||
                     [null, response];
    
    const jsonString = jsonMatch[1] || response;
    const parsed = JSON.parse(jsonString.trim());
    
    // 必須フィールドの存在確認
    if (!parsed.emotion || !parsed.themes || !parsed.patterns || !parsed.positive_points) {
      throw new Error(ANALYSIS_ERRORS.MISSING_REQUIRED_FIELDS);
    }
    
    return {
      emotion: String(parsed.emotion).substring(0, 100),
      themes: String(parsed.themes).substring(0, 100),
      patterns: String(parsed.patterns).substring(0, 100),
      positive_points: String(parsed.positive_points).substring(0, 150)
    };
  } catch (error) {
    console.error(ANALYSIS_ERRORS.PARSE_RESULT_FAILED, error);
    
    // フォールバック：構造化されていない応答の場合
    return {
      emotion: ANALYSIS_FALLBACK.EMOTION,
      themes: ANALYSIS_FALLBACK.THEMES,
      patterns: ANALYSIS_FALLBACK.PATTERNS,
      positive_points: ANALYSIS_FALLBACK.POSITIVE_POINTS
    };
  }
}

/**
 * 分析結果をユーザー向けメッセージに変換
 */
export function formatAnalysisForUser(analysis: AnalysisResult): string {
  return `${ANALYSIS_FORMAT.RESULT_TITLE}

${ANALYSIS_FORMAT.EMOTION_SECTION}
${analysis.emotion}

${ANALYSIS_FORMAT.THEMES_SECTION}
${analysis.themes}

${ANALYSIS_FORMAT.PATTERNS_SECTION}
${analysis.patterns}

${ANALYSIS_FORMAT.POSITIVE_SECTION}
${analysis.positive_points}

${ANALYSIS_FORMAT.CLOSING_MESSAGE}`;
}