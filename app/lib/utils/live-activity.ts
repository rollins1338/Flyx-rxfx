/**
 * Live Activity Utility
 * Helper functions for sending activity data to the live tracker
 */

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

class LiveActivityManager {
  private static instance: LiveActivityManager;
  private isEnabled = true;
  private queue: LiveActivityData[] = [];
  private isProcessing = false;

  static getInstance(): LiveActivityManager {
    if (!LiveActivityManager.instance) {
      LiveActivityManager.instance = new LiveActivityManager();
    }
    return LiveActivityManager.instance;
  }

  /**
   * Send activity data to the live tracker
   */
  async sendActivity(data: LiveActivityData): Promise<void> {
    if (!this.isEnabled) return;

    // Add to queue for batch processing
    this.queue.push({
      ...data,
      userId: data.userId || this.generateAnonymousUserId()
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the activity queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      // Process activities in batches
      while (this.queue.length > 0) {
        const activity = this.queue.shift();
        if (activity) {
          await this.sendActivityToAPI(activity);
        }
      }
    } catch (error) {
      console.error('Live activity processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send individual activity to API
   */
  private async sendActivityToAPI(data: LiveActivityData): Promise<void> {
    try {
      const response = await fetch('/api/admin/live-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Live activity API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send live activity:', error);
      // Don't throw - we don't want to break the main app if live tracking fails
    }
  }

  /**
   * Generate anonymous user ID for tracking
   */
  private generateAnonymousUserId(): string {
    // Check if we already have an anonymous ID in localStorage
    const existingId = typeof window !== 'undefined' 
      ? localStorage.getItem('flyx_anonymous_user_id') 
      : null;

    if (existingId) {
      return existingId;
    }

    // Generate new anonymous ID
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('flyx_anonymous_user_id', anonymousId);
    }

    return anonymousId;
  }

  /**
   * Track watch start
   */
  trackWatchStart(contentId: string, contentTitle: string, contentType: 'movie' | 'tv', season?: number, episode?: number): void {
    this.sendActivity({
      contentId,
      contentTitle,
      contentType,
      season,
      episode,
      action: 'started',
      progress: 0
    });
  }

  /**
   * Track watch progress
   */
  trackWatchProgress(
    contentId: string, 
    contentTitle: string, 
    contentType: 'movie' | 'tv', 
    progress: number, 
    duration: number,
    season?: number, 
    episode?: number
  ): void {
    let action: 'started' | 'watching' | 'completed' = 'watching';
    
    if (progress < 5) {
      action = 'started';
    } else if (progress >= 90) {
      action = 'completed';
    }

    this.sendActivity({
      contentId,
      contentTitle,
      contentType,
      season,
      episode,
      action,
      progress: Math.round(progress),
      duration: Math.round(duration)
    });
  }

  /**
   * Track watch pause
   */
  trackWatchPause(
    contentId: string, 
    contentTitle: string, 
    contentType: 'movie' | 'tv', 
    progress: number,
    season?: number, 
    episode?: number
  ): void {
    this.sendActivity({
      contentId,
      contentTitle,
      contentType,
      season,
      episode,
      action: 'paused',
      progress: Math.round(progress)
    });
  }

  /**
   * Track watch completion
   */
  trackWatchComplete(
    contentId: string, 
    contentTitle: string, 
    contentType: 'movie' | 'tv', 
    duration: number,
    season?: number, 
    episode?: number
  ): void {
    this.sendActivity({
      contentId,
      contentTitle,
      contentType,
      season,
      episode,
      action: 'completed',
      progress: 100,
      duration: Math.round(duration)
    });
  }

  /**
   * Enable/disable live activity tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Clear the activity queue
   */
  clearQueue(): void {
    this.queue = [];
  }
}

// Export singleton instance
export const liveActivityManager = LiveActivityManager.getInstance();

// Export convenience functions
export const trackWatchStart = (contentId: string, contentTitle: string, contentType: 'movie' | 'tv', season?: number, episode?: number) => {
  liveActivityManager.trackWatchStart(contentId, contentTitle, contentType, season, episode);
};

export const trackWatchProgress = (contentId: string, contentTitle: string, contentType: 'movie' | 'tv', progress: number, duration: number, season?: number, episode?: number) => {
  liveActivityManager.trackWatchProgress(contentId, contentTitle, contentType, progress, duration, season, episode);
};

export const trackWatchPause = (contentId: string, contentTitle: string, contentType: 'movie' | 'tv', progress: number, season?: number, episode?: number) => {
  liveActivityManager.trackWatchPause(contentId, contentTitle, contentType, progress, season, episode);
};

export const trackWatchComplete = (contentId: string, contentTitle: string, contentType: 'movie' | 'tv', duration: number, season?: number, episode?: number) => {
  liveActivityManager.trackWatchComplete(contentId, contentTitle, contentType, duration, season, episode);
};