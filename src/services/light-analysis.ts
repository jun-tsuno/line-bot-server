/**
 * 軽量分析サービス
 * CPU使用量を最小限に抑えた日記分析機能
 * CloudflareWorkers 10ms制限対応
 */

import { ANALYSIS_FORMAT } from '@/constants/messages';

/**
 * 軽量分析結果
 */
export interface LightAnalysisResult {
  emotion: string;
  themes: string;
  patterns: string;
  positive_points: string;
  confidence: 'high' | 'medium' | 'low';
  processingTimeMs: number;
}

/**
 * 感情分析キーワード
 */
const EMOTION_KEYWORDS = {
  positive: [
    'うれしい', 'たのしい', 'よかった', 'すてき', 'がんばった', 'できた', 
    'よい', 'いい', 'よろこび', 'しあわせ', 'まんぞく', 'らく', 'やすらか',
    '嬉しい', '楽しい', '良かった', '素敵', '頑張った', '良い', '喜び', 
    '幸せ', '満足', '楽', '安らか', 'ありがと', '感謝', 'おいしい', '美味しい',
    'すばらしい', '素晴らしい', 'かんどう', '感動', 'げんき', '元気'
  ],
  negative: [
    'つらい', 'かなしい', 'いやだ', 'つかれた', 'しんどい', 'むかつく',
    'いらいら', 'ふあん', 'しんぱい', 'こまった', 'だめ', 'わるい',
    '辛い', '悲しい', '嫌だ', '疲れた', 'むかつく', 'イライラ', '不安',
    '心配', '困った', '駄目', 'ダメ', '悪い', 'ストレス', 'きつい', 'つらい'
  ],
  neutral: [
    'ふつう', 'まあまあ', 'そこそこ', 'びみょう', 'まずまず',
    '普通', '微妙', 'こんな', '今日', 'きょう', 'いちにち', '一日'
  ]
} as const;

/**
 * テーマ分析キーワード
 */
const THEME_KEYWORDS = {
  work: ['しごと', '仕事', '会社', 'かいしゃ', 'しょくば', '職場', 'プロジェクト', '残業'],
  relationships: ['友達', 'ともだち', 'かぞく', '家族', '恋人', '彼氏', '彼女', '夫', '妻', '子供'],
  health: ['健康', 'けんこう', '体調', 'たいちょう', '病気', 'びょうき', '医者', 'いしゃ'],
  study: ['勉強', 'べんきょう', '学校', 'がっこう', 'テスト', '試験', 'しけん'],
  hobby: ['趣味', 'しゅみ', 'ゲーム', '読書', 'どくしょ', '映画', 'えいが', '音楽'],
  daily: ['今日', 'きょう', '朝', 'あさ', '昼', 'ひる', '夜', 'よる', '買い物', 'かいもの']
} as const;

/**
 * 軽量分析サービスクラス
 */
export class LightAnalysisService {
  
  /**
   * 日記を軽量分析する（目標: 1-2ms）
   */
  analyze(diaryContent: string): LightAnalysisResult {
    const startTime = performance.now();
    
    try {
      // 入力検証（即座に終了）
      if (!diaryContent || diaryContent.trim().length === 0) {
        return this.createFallbackResult(performance.now() - startTime);
      }
      
      const text = diaryContent.toLowerCase();
      const charCount = diaryContent.length;
      const lineCount = diaryContent.split('\n').length;
      
      // 感情分析（キーワードベース）
      const emotion = this.analyzeEmotion(text);
      
      // テーマ分析（キーワードベース）
      const themes = this.analyzeThemes(text);
      
      // パターン分析（統計ベース）
      const patterns = this.analyzePatterns(text, charCount, lineCount);
      
      // ポジティブポイント（テンプレートベース）
      const positive_points = this.generatePositivePoints(emotion, charCount);
      
      // 信頼度評価
      const confidence = this.calculateConfidence(text, charCount);
      
      const processingTimeMs = performance.now() - startTime;
      
      return {
        emotion,
        themes,
        patterns,
        positive_points,
        confidence,
        processingTimeMs
      };
      
    } catch (error) {
      console.error('Light analysis error:', error);
      return this.createFallbackResult(performance.now() - startTime);
    }
  }
  
  /**
   * 感情分析（キーワードマッチング）
   */
  private analyzeEmotion(text: string): string {
    let positiveScore = 0;
    let negativeScore = 0;
    
    // ポジティブキーワードのカウント
    for (const keyword of EMOTION_KEYWORDS.positive) {
      if (text.includes(keyword)) positiveScore++;
    }
    
    // ネガティブキーワードのカウント
    for (const keyword of EMOTION_KEYWORDS.negative) {
      if (text.includes(keyword)) negativeScore++;
    }
    
    // 感情判定
    if (positiveScore > negativeScore) {
      return '今日はポジティブな気持ちが感じられますね。良い一日だったようです。';
    } else if (negativeScore > positiveScore) {
      return 'ちょっと大変な一日だったようですが、それでも頑張っているあなたは素晴らしいです。';
    } else {
      return '落ち着いた気持ちで過ごされたようですね。穏やかな一日でした。';
    }
  }
  
  /**
   * テーマ分析（キーワードマッチング）
   */
  private analyzeThemes(text: string): string {
    const detectedThemes: string[] = [];
    
    // テーマ別キーワードチェック
    if (THEME_KEYWORDS.work.some(keyword => text.includes(keyword))) {
      detectedThemes.push('お仕事');
    }
    if (THEME_KEYWORDS.relationships.some(keyword => text.includes(keyword))) {
      detectedThemes.push('人間関係');
    }
    if (THEME_KEYWORDS.health.some(keyword => text.includes(keyword))) {
      detectedThemes.push('健康');
    }
    if (THEME_KEYWORDS.study.some(keyword => text.includes(keyword))) {
      detectedThemes.push('学習');
    }
    if (THEME_KEYWORDS.hobby.some(keyword => text.includes(keyword))) {
      detectedThemes.push('趣味');
    }
    if (THEME_KEYWORDS.daily.some(keyword => text.includes(keyword))) {
      detectedThemes.push('日常生活');
    }
    
    if (detectedThemes.length === 0) {
      return '日常の出来事について思いを巡らせていますね。';
    }
    
    return `主に${detectedThemes.join('、')}について考えていらっしゃいますね。`;
  }
  
  /**
   * パターン分析（統計ベース）
   */
  private analyzePatterns(text: string, charCount: number, lineCount: number): string {
    const patterns: string[] = [];
    
    // 文字数による分析
    if (charCount > 300) {
      patterns.push('詳しく書く習慣');
    } else if (charCount < 50) {
      patterns.push('簡潔に表現する傾向');
    }
    
    // 改行数による分析
    if (lineCount > 5) {
      patterns.push('構造化して考える習慣');
    }
    
    // 疑問符の使用
    if (text.includes('？') || text.includes('?')) {
      patterns.push('自問自答する思考パターン');
    }
    
    // 感嘆符の使用
    if (text.includes('！') || text.includes('!')) {
      patterns.push('感情表現豊かな表現力');
    }
    
    if (patterns.length === 0) {
      return '自然体で思いを表現されていますね。';
    }
    
    return `${patterns.join('、')}が見られます。`;
  }
  
  /**
   * ポジティブポイント生成（テンプレートベース）
   */
  private generatePositivePoints(emotion: string, charCount: number): string {
    const templates = [
      'きちんと日記を書く習慣を続けているのは素晴らしいことです。',
      '自分の気持ちを言葉にできているのは大きな成長ですね。',
      '今日も一日お疲れさまでした。振り返る時間を大切にしていますね。',
      '思いを文字にすることで心が整理されていると思います。',
      '継続は力なり。日記を書く習慣が素敵です。'
    ];
    
    // 文字数に応じたボーナスメッセージ
    if (charCount > 200) {
      templates.push('しっかりと詳しく書けているのは内省力の表れですね。');
    }
    
    // ランダムに選択（実際はハッシュベースで決定論的に）
    const index = Math.abs(charCount) % templates.length;
    return templates[index];
  }
  
  /**
   * 信頼度計算
   */
  private calculateConfidence(text: string, charCount: number): 'high' | 'medium' | 'low' {
    let score = 0;
    
    // 文字数による信頼度
    if (charCount > 100) score++;
    if (charCount > 200) score++;
    
    // キーワードマッチ数による信頼度
    const allKeywords = [
      ...EMOTION_KEYWORDS.positive,
      ...EMOTION_KEYWORDS.negative,
      ...Object.values(THEME_KEYWORDS).flat()
    ];
    
    const matchCount = allKeywords.filter(keyword => text.includes(keyword)).length;
    if (matchCount > 2) score++;
    if (matchCount > 5) score++;
    
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
  
  /**
   * フォールバック結果を生成
   */
  private createFallbackResult(processingTimeMs: number): LightAnalysisResult {
    return {
      emotion: 'お疲れさまでした。',
      themes: '日常の出来事について考えていらっしゃいますね。',
      patterns: '自然体で思いを表現されています。',
      positive_points: '今日も日記を書く時間を作れたのは素晴らしいことです。',
      confidence: 'low',
      processingTimeMs
    };
  }
  
  /**
   * ユーザー向けメッセージにフォーマット
   */
  formatForUser(result: LightAnalysisResult): string {
    return [
      `${ANALYSIS_FORMAT.RESULT_TITLE}`,
      '',
      `${ANALYSIS_FORMAT.EMOTION_SECTION}`,
      result.emotion,
      '',
      `${ANALYSIS_FORMAT.THEMES_SECTION}`,
      result.themes,
      '',
      `${ANALYSIS_FORMAT.PATTERNS_SECTION}`,
      result.patterns,
      '',
      `${ANALYSIS_FORMAT.POSITIVE_SECTION}`,
      result.positive_points,
      '',
      ANALYSIS_FORMAT.CLOSING_MESSAGE,
      '',
      `💻 軽量分析 (${result.processingTimeMs.toFixed(1)}ms, 信頼度: ${result.confidence})`
    ].join('\n');
  }
}

/**
 * 軽量分析サービスのファクトリー関数
 */
export function createLightAnalysisService(): LightAnalysisService {
  return new LightAnalysisService();
}