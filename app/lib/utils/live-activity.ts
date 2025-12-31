/**
 * Live Activity Utility - DEPRECATED
 * 
 * This module is kept for backwards compatibility but now delegates
 * to the unified tracker for all operations.
 * 
 * NEW CODE SHOULD USE:
 *   import { useAnalytics } from '@/lib/hooks/useAnalytics';
 *   // or
 *   import { startWatch, updateProgress, stopWatch } from '@/lib/analytics/unified-tracker';
 */

import { 
  startWatch as trackerStartWatch,
  updateProgress as trackerUpdateProgress,
  pauseWatch as trackerPauseWatch,
  stopWatch as trackerStopWatch,
} from '@/lib/analytics/unified-tracker';

interface LiveActivityData {
  userId?: string;
  contentId: string;
  contentTitle: string;
  contentType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  action: 'started' | 'watching' | 'paused' | 'completed';
  progress?: number;
  duration?: number;
}

/**
 * @deprecated Use unified tracker instead
 */
class LiveActivityManager {
  private static instance: LiveActivityManager;

  static getInstance(): LiveActivityManager {
    if (!LiveActivityManager.instance) {
      LiveActivityManager.instance = new LiveActivityManager();
    }
    return LiveActivityManager.instance;
  }

  /**
   * Send activity data - delegates to unified tracker
   * @deprecated Use startWatch/updateProgress/stopWatch from unified-tracker
   */
  async sendActivity(data: LiveActivityData): Promise<void> {
    switch (data.action) {
      case 'started':
        trackerStartWatch(
          data.contentId,
          data.contentType,
          data.contentTitle,
          data.season,
          data.episode,
          data.duration
        );
        break;
      case 'watching':
        if (data.progress !== undefined && data.duration !== undefined) {
          const position = (data.progress / 100) * data.duration;
          trackerUpdateProgress(position, data.duration);
        }
        break;
      case 'paused':
        trackerPauseWatch();
        break;
      case 'completed':
        trackerStopWatch();
        break;
    }
  }

  /**
   * @deprecated Use startWatch from unified-tracker
   */
  trackWatchStart(
    contentId: string, 
    contentTitle: string, 
    contentType: 'movie' | 'tv', 
    season?: number, 
    episode?: number
  ): void {
    trackerStartWatch(contentId, contentType, contentTitle, season, episode);
  }

  /**
   * @deprecated Use updateProgress from unified-tracker
   */
  trackWatchProgress(
    _contentId: string, 
    _contentTitle: string, 
    _contentType: 'movie' | 'tv', 
    progress: number, 
    duration: number,
    _season?: number, 
    _episode?: number
  ): void {
    const position = (progress / 100) * duration;
    trackerUpdateProgress(position, duration);
  }

  /**
   * @deprecated Use pauseWatch from unified-tracker
   */
  trackWatchPause(
    _contentId: string, 
    _contentTitle: string, 
    _contentType: 'movie' | 'tv', 
    _progress: number,
    _season?: number, 
    _episode?: number
  ): void {
    trackerPauseWatch();
  }

  /**
   * @deprecated Use stopWatch from unified-tracker
   */
  trackWatchComplete(
    _contentId: string, 
    _contentTitle: string, 
    _contentType: 'movie' | 'tv', 
    _duration: number,
    _season?: number, 
    _episode?: number
  ): void {
    trackerStopWatch();
  }

  setEnabled(_enabled: boolean): void {
    // No-op - unified tracker is always enabled
  }

  clearQueue(): void {
    // No-op - unified tracker handles its own queue
  }
}

// Export singleton instance for backwards compatibility
export const liveActivityManager = LiveActivityManager.getInstance();

// Export convenience functions (deprecated - use unified-tracker directly)
export const trackWatchStart = (
  contentId: string, 
  contentTitle: string, 
  contentType: 'movie' | 'tv', 
  season?: number, 
  episode?: number
) => {
  trackerStartWatch(contentId, contentType, contentTitle, season, episode);
};

export const trackWatchProgress = (
  _contentId: string, 
  _contentTitle: string, 
  _contentType: 'movie' | 'tv', 
  progress: number, 
  duration: number, 
  _season?: number, 
  _episode?: number
) => {
  const position = (progress / 100) * duration;
  trackerUpdateProgress(position, duration);
};

export const trackWatchPause = (
  _contentId: string, 
  _contentTitle: string, 
  _contentType: 'movie' | 'tv', 
  _progress: number, 
  _season?: number, 
  _episode?: number
) => {
  trackerPauseWatch();
};

export const trackWatchComplete = (
  _contentId: string, 
  _contentTitle: string, 
  _contentType: 'movie' | 'tv', 
  _duration: number, 
  _season?: number, 
  _episode?: number
) => {
  trackerStopWatch();
};
