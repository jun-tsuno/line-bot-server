# 🧠 AI分析フロー詳細

## 概要

AI日記リフレクションBotのコア機能である日記分析処理の詳細フローを説明します。OpenAI GPT-3.5-turboを活用し、感情分析・テーマ抽出・パターン認識・ポジティブフィードバックを提供します。

---

## 🎯 分析システム全体像

```
📝 ユーザー投稿 → 🔍 前処理 → 🧠 AI分析 → 💾 結果保存 → 📤 ユーザー返信
     ↓             ↓           ↓          ↓           ↓
   入力検証    履歴要約取得   GPT分析   データベース  LINE送信
   文字数制限  キャッシュ活用  プロンプト   保存・関連付け ローディング
   サニタイゼ  レース対策     エラー処理   整合性確保   エラー処理
```

---

## 📋 分析フロー詳細

### 1. 🔐 事前検証・準備フェーズ

#### 1.1 LINE Webhook検証
```typescript
// 署名検証フロー
const signature = c.req.header("x-line-signature");
if (!signature || !validateSignature(rawBody, channelSecret, signature)) {
    throw new AuthenticationError("Invalid LINE signature");
}
```

#### 1.2 イベント分析・フィルタリング
```typescript
// 処理対象イベントの判定
if (event.type !== "message" || event.message.type !== "text") {
    return; // 非テキストメッセージは処理しない
}
```

#### 1.3 ユーザー識別・認証
```typescript
const userId = source?.userId;
if (!userId) {
    throw new ValidationError("User ID not found");
}
```

---

### 2. 🎪 ローディング・UX最適化フェーズ

#### 2.1 ローディングアニメーション表示
```typescript
// 最大20秒のローディングアニメーション
try {
    await lineClient.showLoadingAnimation({
        chatId: userId,
        loadingSeconds: 20,
    });
} catch (loadingError) {
    // 失敗してもメイン処理は継続
    console.warn("Loading animation failed:", loadingError);
}
```

**目的**: ユーザー体験向上・処理中であることの明示

---

### 3. 💾 日記データ保存フェーズ

#### 3.1 入力値検証・サニタイゼーション
```typescript
function validateAndSanitizeInput(content: string): string {
    // 文字数制限チェック
    if (content.length > 10000) {
        throw new ValidationError("Content too long");
    }
    
    // 危険文字の除去
    return content
        .trim()
        .replace(/[<>]/g, '')
        .substring(0, 10000);
}
```

#### 3.2 データベース保存
```typescript
// エントリーの保存
const entry = await entryService.create(userId, sanitizedContent);
```

**保存内容**:
- `user_id`: LINEユーザーID
- `content`: サニタイズ済み日記内容
- `created_at`: 投稿日時（UTC）

---

### 4. 📚 履歴要約取得・キャッシュフェーズ

#### 4.1 レースコンディション対策
```typescript
// 同時リクエストの重複処理防止
const requestKey = `${userId}:${startDate}:${endDate}`;
const existingRequest = HistorySummaryService.activeSummaryRequests.get(requestKey);

if (existingRequest) {
    return await existingRequest; // 進行中のリクエストを待機
}
```

#### 4.2 キャッシュ有効性チェック
```typescript
// 24時間以内のキャッシュは再利用
const cacheAge = Date.now() - new Date(cachedSummary.updated_at).getTime();
const cacheAgeHours = cacheAge / (1000 * 60 * 60);

if (cacheAgeHours <= this.CACHE_DURATION_HOURS) {
    return cachedSummary.summary_content; // キャッシュ利用
}
```

#### 4.3 新規要約生成（必要時）
```typescript
// 過去7日間のエントリー取得
const recentEntries = await entryService.getRecentEntries(userId, 7);

if (recentEntries.length >= MIN_ENTRIES_FOR_SUMMARY) {
    // GPTで要約生成
    const summaryContent = await generateGPTSummary(recentEntries);
    
    // キャッシュに保存
    await summaryService.create(userId, startDate, endDate, summaryContent);
}
```

---

### 5. 🧠 GPT分析実行フェーズ

#### 5.1 プロンプト構築

**システムプロンプト**:
```text
あなたは優秀な日記分析AIです。ユーザーの日記から感情や思考を理解し、
温かく建設的なフィードバックを提供します。

以下の要素を分析してください：
1. 感情状態（ポジティブ/ネガティブ/複雑な感情）
2. 主要テーマ・関心事
3. 思考パターン・行動傾向
4. 成長・変化の兆し
5. 励まし・アドバイス
```

**ユーザープロンプト構築**:
```typescript
const prompt = `
【過去7日間の傾向】
${historySummary || "履歴データなし"}

【本日の投稿】
${diaryContent}

以下の形式で分析してください：
1. 感情分析: 現在の感情状態と変化
2. テーマ・関心事: 主要な話題・関心領域
3. 思考パターン: 考え方の特徴・行動傾向
4. ポジティブフィードバック: 励まし・成長ポイント
`;
```

#### 5.2 OpenAI API呼び出し
```typescript
const response = await openaiClient.createChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
], {
    model: "gpt-3.5-turbo",
    max_tokens: 800,
    temperature: 0.7,
    presence_penalty: 0.1,
    frequency_penalty: 0.1
});
```

**パラメータ詳細**:
- **model**: `gpt-3.5-turbo` - コスト効率とパフォーマンスのバランス
- **max_tokens**: 800 - 十分な分析結果を得るための設定
- **temperature**: 0.7 - 創造性と一貫性のバランス
- **presence_penalty**: 0.1 - 多様な表現の促進
- **frequency_penalty**: 0.1 - 繰り返し表現の抑制

#### 5.3 レスポンス解析・構造化
```typescript
// GPTレスポンスの解析
const analysisResult = parseAnalysisResponse(response.choices[0].message.content);

// 構造化データの抽出
const structuredAnalysis = {
    emotion: extractSection(analysisResult, "感情分析"),
    themes: extractSection(analysisResult, "テーマ・関心事"),
    patterns: extractSection(analysisResult, "思考パターン"),
    positive_points: extractSection(analysisResult, "ポジティブフィードバック")
};
```

---

### 6. 💾 分析結果保存フェーズ

#### 6.1 データベース保存
```typescript
// 分析結果の保存
const analysis = await analysisService.create({
    entry_id: entry.id,
    user_id: userId,
    emotion: structuredAnalysis.emotion,
    themes: structuredAnalysis.themes,
    patterns: structuredAnalysis.patterns,
    positive_points: structuredAnalysis.positive_points
});
```

#### 6.2 関連付け・整合性確保
- **外部キー制約**: entry_idによるエントリーとの関連付け
- **CASCADE削除**: エントリー削除時の自動分析削除
- **トランザクション**: データ整合性の保証

---

### 7. 📤 ユーザー返信フェーズ

#### 7.1 ユーザー向けメッセージ構築
```typescript
// 分析結果をユーザーフレンドリーに整形
const userMessage = formatAnalysisForUser({
    emotion: analysis.emotion,
    themes: analysis.themes,
    patterns: analysis.patterns,
    positivePoints: analysis.positive_points,
    userName: "さん" // 敬語での呼びかけ
});
```

**メッセージ例**:
```
📝 日記を分析しました！

🎭 感情分析
達成感と満足感が強く表れていますね。チームでの成功を喜ぶ協調性が素晴らしいです。

🎯 主なテーマ
• 仕事・プロジェクト管理
• チームワーク・協力
• 成果・達成感

🧭 思考パターン
協力的で前向きな姿勢が見られます。困難な状況でも仲間と一緒に乗り越えようとする傾向があります。

✨ ポジティブポイント
チーム全体での成功を素直に喜べる協調性が素晴らしいです。この姿勢が周囲にも良い影響を与えていることでしょう。

今日もお疲れさまでした！🌟
```

#### 7.2 LINE API送信
```typescript
const response: line.messagingApi.TextMessage = {
    type: "text",
    text: userMessage,
};

await replyMessage(lineClient, replyToken, [response]);
```

---

## 🛡️ エラーハンドリング・復旧フロー

### エラー分類と対応戦略

#### 1. 🔄 リトライ可能エラー（一時的障害）

**OpenAI API エラー**:
```typescript
// レート制限・サーバーエラーに対するリトライ
await withErrorHandling(
    () => openaiClient.createChatCompletion(messages, options),
    "openai.analysis",
    {
        maxRetries: 3,
        useCircuitBreaker: true,
        circuitKey: "openai-analysis"
    }
);
```

**データベース接続エラー**:
```typescript
// 接続タイムアウト・一時的障害に対するリトライ
await withErrorHandling(
    () => entryService.create(userId, content),
    "database.entry-save",
    {
        maxRetries: 2,
        baseDelay: 1000
    }
);
```

#### 2. 🚫 非リトライエラー（永続的障害）

**入力値エラー**:
```typescript
// バリデーションエラーは即座に適切なメッセージを返す
if (content.length === 0) {
    await sendErrorMessage(replyToken, "日記の内容が空です。何か書いてみてください。");
    return;
}
```

**認証エラー**:
```typescript
// 署名検証失敗は即座にエラーレスポンス
if (!isValidSignature) {
    return c.json({ error: "Unauthorized" }, 401);
}
```

#### 3. 🔧 フォールバック処理

**GPT分析失敗時**:
```typescript
// AI分析失敗時のフォールバック
if (analysisResult.failed) {
    const fallbackMessage = generateFallbackResponse(diaryContent);
    await sendMessage(replyToken, fallbackMessage);
}

function generateFallbackResponse(content: string): string {
    return `
日記を受け取りました📝

今回は詳細な分析ができませんでしたが、
${content.length}文字の日記をしっかりと保存いたします。

継続して日記を書くことで、より良い分析と
フィードバックを提供できるようになります。

今日もお疲れさまでした🌟
    `.trim();
}
```

---

## ⚡ パフォーマンス最適化

### 1. 📊 トークン最適化戦略

#### GPT入力の最適化
```typescript
// 長いエントリーの切り詰め
const optimizedEntries = entries.map(entry => {
    const maxChars = 500; // エントリーあたりの最大文字数
    return entry.content.length > maxChars 
        ? `${entry.content.substring(0, maxChars)}...`
        : entry.content;
});
```

#### プロンプト最適化
- **簡潔な指示**: 冗長な説明を避け、明確な指示を提供
- **構造化出力**: JSON形式ではなく自然文での出力（トークン節約）
- **テンプレート化**: 再利用可能なプロンプトテンプレート

### 2. 🏃‍♂️ 並列処理最適化

#### 複数イベントの並列処理
```typescript
// LINE Webhookの複数イベントを並列処理
await Promise.all(
    events.map(async (event) => {
        try {
            await handleTextMessage(event, lineClient, env, db);
        } catch (error) {
            // エラーハンドリング
        }
    })
);
```

#### 非同期処理の活用
```typescript
// ローディング表示とデータ保存を並列実行
const [loadingResult, entryResult] = await Promise.allSettled([
    showLoadingAnimation(userId),
    saveEntryToDatabase(userId, content)
]);
```

### 3. 🗄️ キャッシュ戦略

#### 多層キャッシュ構造
1. **メモリキャッシュ**: Worker実行中の一時キャッシュ
2. **データベースキャッシュ**: summariesテーブルによる永続化
3. **Edge キャッシュ**: Cloudflare Edgeの分散キャッシュ

#### キャッシュ更新戦略
```typescript
// 適応的キャッシュ更新
const shouldUpdateCache = (lastUpdate: Date, userActivity: number): boolean => {
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    // アクティブユーザーはより頻繁にキャッシュ更新
    const updateThreshold = userActivity > 5 ? 12 : 24; // 時間
    
    return hoursSinceUpdate > updateThreshold;
};
```

---

## 📊 分析品質・精度向上

### 1. 🎯 プロンプトエンジニアリング

#### コンテキスト活用
```typescript
// 履歴コンテキストの効果的活用
const contextPrompt = historySummary 
    ? `過去の傾向: ${historySummary}\n\n今日の変化や継続性も考慮して分析してください。`
    : "初回の分析です。全体的な印象を重点的に分析してください。";
```

#### 感情分析の精度向上
```typescript
const emotionAnalysisPrompt = `
感情を以下の観点で分析してください：
1. 主要感情（喜怒哀楽）の特定
2. 感情の強度（1-10スケール）
3. 複合感情の識別
4. 感情の変化・動き
5. 潜在的な感情（表面に現れない感情）
`;
```

### 2. 🧪 A/Bテスト・実験的改善

#### プロンプトバリエーション
```typescript
// プロンプトのA/Bテスト実装例
const promptVariants = {
    analytical: "客観的な視点で分析的に...",
    empathetic: "共感的で温かい視点で...",
    coaching: "コーチング的な視点で..."
};

const selectedPrompt = selectPromptVariant(userId, promptVariants);
```

### 3. 📈 フィードバック学習

#### ユーザー反応の収集
```typescript
// 将来的な実装：ユーザーフィードバック収集
interface UserFeedback {
    analysisId: number;
    rating: number; // 1-5スケール
    helpful: boolean;
    comment?: string;
}
```

---

## 🔍 監視・デバッグ・改善

### 1. 📊 分析メトリクス

#### 処理時間監視
```typescript
// 各フェーズの処理時間計測
const timer = new PerformanceTimer();

timer.start("total-analysis");
timer.start("gpt-analysis");
const analysis = await performGPTAnalysis(prompt);
timer.end("gpt-analysis");

timer.start("database-save");
await saveAnalysisResults(analysis);
timer.end("database-save");
timer.end("total-analysis");

// メトリクス出力
console.log("Performance metrics:", timer.getMetrics());
```

#### 品質指標
- **分析完了率**: 正常完了 / 総リクエスト数
- **GPT応答品質**: レスポンス長・構造化度
- **ユーザー満足度**: フィードバック・継続利用率

### 2. 🐛 デバッグ・トラブルシューティング

#### 詳細ログ出力
```typescript
// 構造化ログによるデバッグ支援
const debugLogger = {
    logAnalysisStart: (userId: string, contentLength: number) => {
        console.log("Analysis started", {
            userId: hashUserId(userId), // プライバシー保護
            contentLength,
            timestamp: new Date().toISOString(),
            requestId: generateRequestId()
        });
    },
    
    logGPTRequest: (prompt: string, tokens: number) => {
        console.log("GPT request", {
            promptLength: prompt.length,
            estimatedTokens: tokens,
            model: "gpt-3.5-turbo"
        });
    }
};
```

#### エラー分析
```typescript
// エラーパターンの分析・集計
const errorAnalytics = {
    openaiErrors: 0,
    databaseErrors: 0,
    validationErrors: 0,
    unknownErrors: 0
};

function trackError(error: Error, context: string) {
    const category = classifyError(error);
    errorAnalytics[category]++;
    
    // 詳細なエラー情報をログ出力
    console.error(`Error in ${context}:`, {
        category,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
}
```

---

## 🚀 将来的な拡張・改善計画

### 1. 📈 機能拡張

#### 多言語対応
```typescript
// 言語検出・対応
const detectedLanguage = detectLanguage(diaryContent);
const localizedPrompt = getLocalizedPrompt(detectedLanguage);
```

#### カスタム分析モード
```typescript
// ユーザー設定による分析カスタマイズ
interface AnalysisSettings {
    focusArea: "emotion" | "goals" | "relationships" | "growth";
    analysisDepth: "brief" | "detailed" | "comprehensive";
    feedbackStyle: "encouraging" | "analytical" | "coaching";
}
```

### 2. 🧠 AI・機械学習の活用

#### 感情分析の高度化
- **感情の時系列分析**: 長期的な感情変化の追跡
- **個人特化モデル**: ユーザー固有の感情パターン学習
- **マルチモーダル分析**: テキスト以外の情報活用

#### 予測・推奨機能
```typescript
// 将来的な実装例
interface PredictiveInsights {
    moodForecast: string; // 明日の気分予測
    suggestedActivities: string[]; // 推奨活動
    potentialChallenges: string[]; // 注意すべき課題
}
```

---

## ❓ FAQ

### Q: GPT分析の一回あたりの処理時間は？
A: 平均3-5秒、最大20秒以内に完了するよう設計されています。

### Q: 分析精度はどの程度？
A: 定性的評価中ですが、ユーザーフィードバックに基づく継続的改善を実施しています。

### Q: 過去の分析結果は参照される？
A: 現在は7日間の要約のみ参照。将来的にはより長期的な履歴活用を予定。

### Q: カスタムプロンプトは設定可能？
A: 現在は固定。将来的にはユーザー設定によるカスタマイズを検討中。

### Q: 分析結果の修正・再分析は可能？
A: 現在は未対応。将来的な機能として検討中です。