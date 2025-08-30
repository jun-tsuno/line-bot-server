/**
 * パフォーマンス監視サービス
 * CPU使用量とレスポンス時間を監視・記録
 */

/**
 * パフォーマンス指標
 */
export interface PerformanceMetrics {
  timestamp: string;
  userId: string;
  totalProcessingTimeMs: number;
  analysisLevel: 1 | 2 | 3;
  entryLength: number;
  cpuUsageMs?: number;
  memoryUsageMB?: number;
  success: boolean;
  errorType?: string;
}

/**
 * パフォーマンス統計
 */
export interface PerformanceStats {
  totalRequests: number;
  averageProcessingTime: number;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  successRate: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
}

/**
 * パフォーマンス監視サービス
 */
export class PerformanceMonitorService {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 1000; // 最大保持件数

  /**
   * パフォーマンス指標を記録
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    // メモリ使用量を制限するため、古いメトリクスを削除
    if (this.metrics.length >= this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY / 2);
    }

    this.metrics.push({
      ...metrics,
      timestamp: new Date().toISOString(),
    });

    // CPU制限超過の警告
    if (metrics.totalProcessingTimeMs > 8) {
      console.warn(`High CPU usage detected: ${metrics.totalProcessingTimeMs}ms (Level ${metrics.analysisLevel})`, {
        userId: metrics.userId,
        entryLength: metrics.entryLength,
        success: metrics.success
      });
    }

    // レベル3頻発の警告
    if (metrics.analysisLevel === 3) {
      console.warn(`Emergency mode activated for user ${metrics.userId}`, {
        processingTime: metrics.totalProcessingTimeMs,
        entryLength: metrics.entryLength
      });
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        averageProcessingTime: 0,
        level1Count: 0,
        level2Count: 0,
        level3Count: 0,
        successRate: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0,
      };
    }

    const sortedTimes = this.metrics
      .map(m => m.totalProcessingTimeMs)
      .sort((a, b) => a - b);

    const successCount = this.metrics.filter(m => m.success).length;
    const level1Count = this.metrics.filter(m => m.analysisLevel === 1).length;
    const level2Count = this.metrics.filter(m => m.analysisLevel === 2).length;
    const level3Count = this.metrics.filter(m => m.analysisLevel === 3).length;

    return {
      totalRequests: this.metrics.length,
      averageProcessingTime: sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length,
      level1Count,
      level2Count,
      level3Count,
      successRate: (successCount / this.metrics.length) * 100,
      p95ProcessingTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
      p99ProcessingTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0,
    };
  }

  /**
   * 最近のパフォーマンス傾向を取得
   */
  getRecentTrend(minutes: number = 10): {
    recentAverage: number;
    recentLevel3Rate: number;
    trending: 'improving' | 'stable' | 'degrading';
  } {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(
      m => new Date(m.timestamp) > cutoffTime
    );

    if (recentMetrics.length === 0) {
      return {
        recentAverage: 0,
        recentLevel3Rate: 0,
        trending: 'stable'
      };
    }

    const recentAverage = recentMetrics.reduce((sum, m) => sum + m.totalProcessingTimeMs, 0) / recentMetrics.length;
    const recentLevel3Rate = (recentMetrics.filter(m => m.analysisLevel === 3).length / recentMetrics.length) * 100;

    // トレンド判定（簡易）
    const firstHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
    const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return {
        recentAverage,
        recentLevel3Rate,
        trending: 'stable'
      };
    }

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.totalProcessingTimeMs, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.totalProcessingTimeMs, 0) / secondHalf.length;

    const improvement = (firstHalfAvg - secondHalfAvg) / firstHalfAvg;

    let trending: 'improving' | 'stable' | 'degrading' = 'stable';
    if (improvement > 0.1) trending = 'improving';
    else if (improvement < -0.1) trending = 'degrading';

    return {
      recentAverage,
      recentLevel3Rate,
      trending
    };
  }

  /**
   * 健康状態チェック
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recommendations: string[];
  } {
    const stats = this.getStats();
    const trend = this.getRecentTrend();

    const recommendations: string[] = [];

    // クリティカル状態の判定
    if (stats.p95ProcessingTime > 10 || stats.successRate < 80 || trend.recentLevel3Rate > 50) {
      return {
        status: 'critical',
        message: 'システムが高負荷状態です。緊急対応が必要です。',
        recommendations: [
          'OpenAI APIタイムアウトをさらに短縮',
          'より積極的な軽量分析フォールバック',
          'データベースクエリの最適化',
          'リクエスト頻度の制限検討'
        ]
      };
    }

    // 警告状態の判定
    if (stats.p95ProcessingTime > 8 || stats.successRate < 95 || trend.recentLevel3Rate > 20) {
      if (stats.p95ProcessingTime > 8) {
        recommendations.push('CPU使用量が制限に近づいています');
      }
      if (trend.recentLevel3Rate > 20) {
        recommendations.push('緊急モードの使用頻度が高くなっています');
      }

      return {
        status: 'warning',
        message: 'パフォーマンスに注意が必要です。',
        recommendations
      };
    }

    // 健康状態
    return {
      status: 'healthy',
      message: 'システムは正常に動作しています。',
      recommendations: []
    };
  }

  /**
   * メトリクス履歴をクリア（メモリ節約）
   */
  clearHistory(): void {
    this.metrics = [];
  }

  /**
   * CSV形式でメトリクスをエクスポート
   */
  exportMetricsAsCSV(): string {
    const headers = [
      'timestamp',
      'userId',
      'totalProcessingTimeMs',
      'analysisLevel',
      'entryLength',
      'success',
      'errorType'
    ];

    const rows = this.metrics.map(m => [
      m.timestamp,
      m.userId,
      m.totalProcessingTimeMs.toString(),
      m.analysisLevel.toString(),
      m.entryLength.toString(),
      m.success.toString(),
      m.errorType || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
}

// グローバルインスタンス（シングルトン）
let globalPerformanceMonitor: PerformanceMonitorService | null = null;

/**
 * パフォーマンス監視サービスのシングルトンインスタンスを取得
 */
export function getPerformanceMonitor(): PerformanceMonitorService {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitorService();
  }
  return globalPerformanceMonitor;
}