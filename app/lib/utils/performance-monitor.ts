/**
 * Performance Monitoring Utility
 * Tracks and logs performance metrics for optimization
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  start(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End timing and record metric
   */
  end(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`[Performance] No start time found for: ${name}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Log slow operations
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation: ${name} took ${duration}ms`, metadata);
    } else if (duration > 500) {
      console.log(`[Performance] ${name} took ${duration}ms`, metadata);
    }

    return duration;
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name);
    }
    return this.metrics;
  }

  /**
   * Get average duration for an operation
   */
  getAverage(name: string): number {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return Math.round(total / metrics.length);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const summary: Record<string, { count: number; avg: number; min: number; max: number }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          avg: 0,
          min: Infinity,
          max: 0,
        };
      }

      const s = summary[metric.name];
      s.count++;
      s.min = Math.min(s.min, metric.duration);
      s.max = Math.max(s.max, metric.duration);
    }

    // Calculate averages
    for (const name in summary) {
      const metrics = this.getMetrics(name);
      const total = metrics.reduce((sum, m) => sum + m.duration, 0);
      summary[name].avg = Math.round(total / metrics.length);
    }

    return summary;
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    const summary = this.getSummary();
    console.table(summary);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper function for timing async operations
export async function timeAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  performanceMonitor.start(name);
  try {
    const result = await fn();
    performanceMonitor.end(name, metadata);
    return result;
  } catch (error) {
    performanceMonitor.end(name, { ...metadata, error: true });
    throw error;
  }
}

// Helper function for timing sync operations
export function timeSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  performanceMonitor.start(name);
  try {
    const result = fn();
    performanceMonitor.end(name, metadata);
    return result;
  } catch (error) {
    performanceMonitor.end(name, { ...metadata, error: true });
    throw error;
  }
}
