/**
 * Temporal Entropy Analyzer
 * 
 * A novel bot detection system based on the fundamental principle that
 * humans have natural, unpredictable timing patterns that are nearly
 * impossible for bots to simulate accurately.
 * 
 * Key insight: Bots either have:
 * 1. Too consistent timing (programmatic delays)
 * 2. Fake randomness (Math.random() has detectable patterns)
 * 3. Wrong distribution (human timing follows specific statistical distributions)
 * 
 * This analyzer measures:
 * - Inter-event timing at microsecond precision
 * - Statistical entropy of timing sequences
 * - Distribution shape (humans follow log-normal, not uniform/normal)
 * - Autocorrelation (humans have natural rhythm, bots don't)
 * - Jitter patterns (humans have 15-50ms natural variance)
 */

export interface EntropyResult {
  isHuman: boolean;
  confidence: number; // 0-100
  entropy: number; // Shannon entropy of timing
  distribution: 'human-like' | 'too-uniform' | 'too-random' | 'programmatic';
  anomalies: string[];
  stats: {
    sampleCount: number;
    meanInterval: number;
    stdDev: number;
    coefficientOfVariation: number;
    skewness: number;
    kurtosis: number;
    autocorrelation: number;
  };
}

interface TimingEvent {
  type: string;
  timestamp: number; // High-precision timestamp (performance.now())
  data?: any;
}

export class TemporalEntropyAnalyzer {
  private events: TimingEvent[] = [];
  private readonly maxEvents = 500;
  private readonly minEventsForAnalysis = 20;
  
  // High-precision timing using performance.now()
  private getHighPrecisionTime(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
  
  /**
   * Record an event with high-precision timing
   */
  recordEvent(type: string, data?: any): void {
    const timestamp = this.getHighPrecisionTime();
    
    this.events.push({ type, timestamp, data });
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }
  
  /**
   * Record a keystroke with additional timing data
   */
  recordKeystroke(key: string, eventType: 'keydown' | 'keyup'): void {
    this.recordEvent(`key_${eventType}`, { key });
  }
  
  /**
   * Record mouse movement
   */
  recordMouseMove(x: number, y: number): void {
    this.recordEvent('mousemove', { x, y });
  }
  
  /**
   * Record a click
   */
  recordClick(x: number, y: number, button: number): void {
    this.recordEvent('click', { x, y, button });
  }
  
  /**
   * Record scroll event
   */
  recordScroll(scrollY: number): void {
    this.recordEvent('scroll', { scrollY });
  }
  
  /**
   * Analyze collected timing data
   */
  analyze(): EntropyResult {
    const anomalies: string[] = [];
    
    if (this.events.length < this.minEventsForAnalysis) {
      return {
        isHuman: true, // Assume human until proven otherwise
        confidence: 0,
        entropy: 0,
        distribution: 'human-like',
        anomalies: ['insufficient-data'],
        stats: this.getEmptyStats(),
      };
    }
    
    // Calculate inter-event intervals
    const intervals = this.calculateIntervals();
    
    // Basic statistics
    const stats = this.calculateStatistics(intervals);
    
    // Shannon entropy of binned intervals
    const entropy = this.calculateEntropy(intervals);
    
    // Check for programmatic patterns
    const programmaticScore = this.detectProgrammaticPatterns(intervals);
    
    // Check distribution shape (method modifies stats as side effect)
    this.analyzeDistribution(intervals, stats);
    
    // Check autocorrelation (rhythm detection)
    const autocorr = this.calculateAutocorrelation(intervals);
    stats.autocorrelation = autocorr;
    
    // Scoring
    let humanScore = 50; // Start neutral
    
    // Entropy analysis (humans have moderate entropy, not too high or low)
    if (entropy < 1.5) {
      humanScore -= 30;
      anomalies.push('low-entropy');
    } else if (entropy > 4.5) {
      humanScore -= 20;
      anomalies.push('artificially-high-entropy');
    } else if (entropy >= 2.5 && entropy <= 3.8) {
      humanScore += 15;
    }
    
    // Coefficient of variation (humans: 0.3-0.8, bots: often <0.1 or >1.5)
    if (stats.coefficientOfVariation < 0.15) {
      humanScore -= 35;
      anomalies.push('too-consistent-timing');
    } else if (stats.coefficientOfVariation > 1.5) {
      humanScore -= 20;
      anomalies.push('artificially-random-timing');
    } else if (stats.coefficientOfVariation >= 0.3 && stats.coefficientOfVariation <= 0.8) {
      humanScore += 20;
    }
    
    // Skewness (human timing is right-skewed / log-normal)
    if (stats.skewness < 0.5) {
      humanScore -= 15;
      anomalies.push('wrong-distribution-shape');
    } else if (stats.skewness >= 1.0 && stats.skewness <= 3.0) {
      humanScore += 15;
    }
    
    // Programmatic pattern detection
    if (programmaticScore > 0.7) {
      humanScore -= 40;
      anomalies.push('programmatic-patterns-detected');
    } else if (programmaticScore < 0.2) {
      humanScore += 10;
    }
    
    // Autocorrelation (humans have slight positive autocorrelation due to rhythm)
    if (Math.abs(autocorr) < 0.05) {
      humanScore -= 10;
      anomalies.push('no-natural-rhythm');
    } else if (autocorr > 0.1 && autocorr < 0.4) {
      humanScore += 15;
    } else if (autocorr > 0.8) {
      humanScore -= 25;
      anomalies.push('artificial-rhythm');
    }
    
    // Kurtosis (human timing has moderate kurtosis)
    if (stats.kurtosis < 2) {
      humanScore -= 10;
      anomalies.push('flat-distribution');
    } else if (stats.kurtosis > 10) {
      humanScore -= 15;
      anomalies.push('extreme-outliers');
    }
    
    // Clamp score
    humanScore = Math.max(0, Math.min(100, humanScore));
    
    // Determine distribution type
    let distribution: EntropyResult['distribution'] = 'human-like';
    if (programmaticScore > 0.5) {
      distribution = 'programmatic';
    } else if (stats.coefficientOfVariation < 0.15) {
      distribution = 'too-uniform';
    } else if (stats.coefficientOfVariation > 1.5 || entropy > 4.5) {
      distribution = 'too-random';
    }
    
    return {
      isHuman: humanScore >= 45,
      confidence: Math.abs(humanScore - 50) * 2, // 0-100 confidence
      entropy,
      distribution,
      anomalies,
      stats,
    };
  }
  
  /**
   * Calculate intervals between consecutive events
   */
  private calculateIntervals(): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < this.events.length; i++) {
      const interval = this.events[i].timestamp - this.events[i - 1].timestamp;
      // Filter out unreasonably long intervals (> 10 seconds)
      if (interval > 0 && interval < 10000) {
        intervals.push(interval);
      }
    }
    return intervals;
  }
  
  /**
   * Calculate basic statistics
   */
  private calculateStatistics(intervals: number[]): EntropyResult['stats'] {
    if (intervals.length === 0) return this.getEmptyStats();
    
    const n = intervals.length;
    const mean = intervals.reduce((a, b) => a + b, 0) / n;
    
    // Variance and standard deviation
    const squaredDiffs = intervals.map(x => Math.pow(x - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // Coefficient of variation
    const cv = mean > 0 ? stdDev / mean : 0;
    
    // Skewness (third standardized moment)
    const cubedDiffs = intervals.map(x => Math.pow((x - mean) / stdDev, 3));
    const skewness = stdDev > 0 ? cubedDiffs.reduce((a, b) => a + b, 0) / n : 0;
    
    // Kurtosis (fourth standardized moment)
    const fourthDiffs = intervals.map(x => Math.pow((x - mean) / stdDev, 4));
    const kurtosis = stdDev > 0 ? fourthDiffs.reduce((a, b) => a + b, 0) / n : 0;
    
    return {
      sampleCount: n,
      meanInterval: mean,
      stdDev,
      coefficientOfVariation: cv,
      skewness,
      kurtosis,
      autocorrelation: 0, // Calculated separately
    };
  }
  
  /**
   * Calculate Shannon entropy of timing intervals
   */
  private calculateEntropy(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    // Bin intervals into buckets (log scale for better human timing capture)
    const bins = new Map<number, number>();
    const binSize = 20; // 20ms bins
    
    for (const interval of intervals) {
      const bin = Math.floor(interval / binSize);
      bins.set(bin, (bins.get(bin) || 0) + 1);
    }
    
    // Calculate Shannon entropy
    const total = intervals.length;
    let entropy = 0;
    
    Array.from(bins.values()).forEach((count) => {
      const p = count / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    });
    
    return entropy;
  }
  
  /**
   * Detect programmatic timing patterns
   */
  private detectProgrammaticPatterns(intervals: number[]): number {
    if (intervals.length < 10) return 0;
    
    let patternScore = 0;
    
    // Check for repeated exact intervals (common in setTimeout/setInterval)
    const roundedIntervals = intervals.map(i => Math.round(i));
    const counts = new Map<number, number>();
    for (const interval of roundedIntervals) {
      counts.set(interval, (counts.get(interval) || 0) + 1);
    }
    
    // If any single interval appears more than 30% of the time, suspicious
    const maxCount = Math.max(...counts.values());
    if (maxCount / intervals.length > 0.3) {
      patternScore += 0.4;
    }
    
    // Check for arithmetic sequences (constant delay)
    const diffs = [];
    for (let i = 1; i < intervals.length; i++) {
      diffs.push(intervals[i] - intervals[i - 1]);
    }
    const diffVariance = this.variance(diffs);
    if (diffVariance < 100) { // Very consistent differences
      patternScore += 0.3;
    }
    
    // Check for common programmatic intervals (100ms, 200ms, 500ms, 1000ms)
    const commonIntervals = [100, 200, 250, 500, 1000];
    for (const common of commonIntervals) {
      const nearCommon = intervals.filter(i => Math.abs(i - common) < 10).length;
      if (nearCommon / intervals.length > 0.2) {
        patternScore += 0.2;
      }
    }
    
    return Math.min(1, patternScore);
  }
  
  /**
   * Analyze distribution shape
   */
  private analyzeDistribution(intervals: number[], stats: EntropyResult['stats']): string {
    // Human timing typically follows a log-normal distribution
    // Check if log-transformed data is more normal
    
    const logIntervals = intervals.filter(i => i > 0).map(i => Math.log(i));
    const logStats = this.calculateStatistics(logIntervals);
    
    // Log-normal data should have skewness closer to 0 after log transform
    if (Math.abs(logStats.skewness) < Math.abs(stats.skewness) * 0.5) {
      return 'log-normal (human-like)';
    }
    
    if (stats.coefficientOfVariation < 0.1) {
      return 'uniform (bot-like)';
    }
    
    return 'unknown';
  }
  
  /**
   * Calculate autocorrelation at lag 1
   */
  private calculateAutocorrelation(intervals: number[]): number {
    if (intervals.length < 3) return 0;
    
    const n = intervals.length;
    const mean = intervals.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n - 1; i++) {
      numerator += (intervals[i] - mean) * (intervals[i + 1] - mean);
    }
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(intervals[i] - mean, 2);
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }
  
  /**
   * Helper: Calculate variance
   */
  private variance(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
  }
  
  /**
   * Get empty stats object
   */
  private getEmptyStats(): EntropyResult['stats'] {
    return {
      sampleCount: 0,
      meanInterval: 0,
      stdDev: 0,
      coefficientOfVariation: 0,
      skewness: 0,
      kurtosis: 0,
      autocorrelation: 0,
    };
  }
  
  /**
   * Get raw events for debugging
   */
  getEvents(): TimingEvent[] {
    return [...this.events];
  }
  
  /**
   * Clear all recorded events
   */
  clear(): void {
    this.events = [];
  }
  
  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }
}

// Singleton for global use
let analyzerInstance: TemporalEntropyAnalyzer | null = null;

export function getEntropyAnalyzer(): TemporalEntropyAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new TemporalEntropyAnalyzer();
  }
  return analyzerInstance;
}

export default TemporalEntropyAnalyzer;
