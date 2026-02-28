/**
 * Live Activity Utility — DEPRECATED
 *
 * This module is kept for backwards compatibility but now delegates
 * to the Local_Tracker for all operations.
 *
 * NEW CODE SHOULD USE:
 *   import { LocalTracker } from '@/lib/local-tracker/local-tracker';
 */

import { LocalTracker } from '@/lib/local-tracker/local-tracker';

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

function getTracker() {
  return LocalTracker.getInstance();
}

/**
 * @deprecated Use Local_Tracker instead
 */
class LiveActivityManager {
  private static instance: LiveActivityManager;

  static getInstance(): LiveActivityManager {
    if (!LiveActivityManager.instance) {
      LiveActivityManager.instance = new LiveActivityManager();
    }
    return LiveActivityManager.instance;
  }

  async sendActivity(data: LiveActivityData): Promise<void> {
    const tracker = getTracker();
    switch (data.action) {
      case 'started':
        tracker.startWatch(data.contentId, data.contentType, data.contentTitle, data.season, data.episode, data.duration);
        break;
      case 'watching':
        if (data.progress !== undefined && data.duration !== undefined) {
          const position = (data.progress / 100) * data.duration;
          tracker.updateProgress(position, data.duration);
        }
        break;
      case 'paused':
        tracker.pauseWatch();
        break;
      case 'completed':
        tracker.stopWatch();
        break;
    }
  }

  trackWatchStart(contentId: string, contentTitle: string, contentType: 'movie' | 'tv', season?: number, episode?: number): void {
    getTracker().startWatch(contentId, contentType, contentTitle, season, episode);
  }

  trackWatchProgress(_contentId: string, _contentTitle: string, _contentType: 'movie' | 'tv', progress: number, duration: number, _season?: number, _episode?: number): void {
    const position = (progress / 100) * duration;
    getTracker().updateProgress(position, duration);
  }

  trackWatchPause(_contentId: string, _contentTitle: string, _contentType: 'movie' | 'tv', _progress: number, _season?: number, _episode?: number): void {
    getTracker().pauseWatch();
  }

  trackWatchComplete(_contentId: string, _contentTitle: string, _contentType: 'movie' | 'tv', _duration: number, _season?: number, _episode?: number): void {
    getTracker().stopWatch();
  }

  setEnabled(_enabled: boolean): void {}
  clearQueue(): void {}
}

export const liveActivityManager = LiveActivityManager.getInstance();

export const trackWatchStart = (contentId: string, contentTitle: string, contentType: 'movie' | 'tv', season?: number, episode?: number) => {
  getTracker().startWatch(contentId, contentType, contentTitle, season, episode);
};

export const trackWatchProgress = (_contentId: string, _contentTitle: string, _contentType: 'movie' | 'tv', progress: number, duration: number, _season?: number, _episode?: number) => {
  const position = (progress / 100) * duration;
  getTracker().updateProgress(position, duration);
};

export const trackWatchPause = (_contentId: string, _contentTitle: string, _contentType: 'movie' | 'tv', _progress: number, _season?: number, _episode?: number) => {
  getTracker().pauseWatch();
};

export const trackWatchComplete = (_contentId: string, _contentTitle: string, _contentType: 'movie' | 'tv', _duration: number, _season?: number, _episode?: number) => {
  getTracker().stopWatch();
};
