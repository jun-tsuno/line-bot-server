/**
 * パフォーマンス監視エンドポイント
 * CPU使用量最適化の効果を確認するためのヘルスチェック
 */

import { getPerformanceMonitor } from '@/services/performance-monitor';
import type { Context } from 'hono';
import type { Bindings } from '@/types/bindings';

/**
 * パフォーマンス統計エンドポイント
 */
export const performanceStatsHandler = async (
  c: Context<{ Bindings: Bindings }>
) => {
  try {
    const performanceMonitor = getPerformanceMonitor();
    const stats = performanceMonitor.getStats();
    const trend = performanceMonitor.getRecentTrend();
    const health = performanceMonitor.getHealthStatus();

    return c.json({
      status: 'success',
      data: {
        overview: {
          totalRequests: stats.totalRequests,
          averageProcessingTime:
            Math.round(stats.averageProcessingTime * 100) / 100,
          successRate: Math.round(stats.successRate * 100) / 100,
          healthStatus: health.status,
          healthMessage: health.message,
        },
        performance: {
          p95ProcessingTime: Math.round(stats.p95ProcessingTime * 100) / 100,
          p99ProcessingTime: Math.round(stats.p99ProcessingTime * 100) / 100,
          recentAverage: Math.round(trend.recentAverage * 100) / 100,
          trending: trend.trending,
        },
        analysisLevels: {
          level1Count: stats.level1Count,
          level2Count: stats.level2Count,
          level3Count: stats.level3Count,
          level1Rate: Math.round(
            (stats.level1Count / stats.totalRequests) * 100
          ),
          level2Rate: Math.round(
            (stats.level2Count / stats.totalRequests) * 100
          ),
          level3Rate: Math.round(
            (stats.level3Count / stats.totalRequests) * 100
          ),
          recentLevel3Rate: Math.round(trend.recentLevel3Rate * 100) / 100,
        },
        recommendations: health.recommendations,
        cpuOptimizationStatus: {
          withinLimits: stats.p95ProcessingTime <= 10,
          targetAchieved: stats.p95ProcessingTime <= 8,
          optimalPerformance: stats.p95ProcessingTime <= 5,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Performance stats handler error:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to retrieve performance statistics',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
};

/**
 * ヘルスチェックエンドポイント（簡易版）
 */
export const healthCheckHandler = async (
  c: Context<{ Bindings: Bindings }>
) => {
  try {
    const performanceMonitor = getPerformanceMonitor();
    const health = performanceMonitor.getHealthStatus();
    const stats = performanceMonitor.getStats();

    const isHealthy =
      health.status === 'healthy' && stats.p95ProcessingTime <= 10;

    return c.json(
      {
        status: isHealthy ? 'healthy' : health.status,
        message: health.message,
        cpuWithinLimits: stats.p95ProcessingTime <= 10,
        averageResponseTime:
          Math.round(stats.averageProcessingTime * 100) / 100,
        successRate: Math.round(stats.successRate * 100) / 100,
        timestamp: new Date().toISOString(),
      },
      isHealthy ? 200 : health.status === 'critical' ? 503 : 200
    );
  } catch (error) {
    console.error('Health check handler error:', error);
    return c.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
};

/**
 * メトリクスエクスポートエンドポイント（CSV形式）
 */
export const metricsExportHandler = async (
  c: Context<{ Bindings: Bindings }>
) => {
  try {
    const performanceMonitor = getPerformanceMonitor();
    const csvData = performanceMonitor.exportMetricsAsCSV();

    c.header('Content-Type', 'text/csv');
    c.header(
      'Content-Disposition',
      'attachment; filename="performance-metrics.csv"'
    );

    return c.text(csvData);
  } catch (error) {
    console.error('Metrics export handler error:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to export metrics',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
};

/**
 * メトリクス履歴クリアエンドポイント（管理用）
 */
export const clearMetricsHandler = async (
  c: Context<{ Bindings: Bindings }>
) => {
  try {
    const performanceMonitor = getPerformanceMonitor();
    performanceMonitor.clearHistory();

    return c.json({
      status: 'success',
      message: 'Performance metrics history cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Clear metrics handler error:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to clear metrics history',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
};
