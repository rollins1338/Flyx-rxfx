/**
 * usePresence Hook - Real-time user presence detection
 * 
 * Features:
 * - Heartbeat system for accurate active user counts
 * - Bot/programmatic access detection
 * - Tab visibility tracking (only count truly active users)
 * - User interaction validation (mouse, keyboard, touch)
 * - Automatic cleanup on unmount/tab close
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getAnalyticsEndpoint } from '@/app/lib/utils/analytics-endpoints';

interface PresenceConfig {
  heartbeatInterval?: number; // ms between heartbeats (default: 30s)
  inactivityTimeout?: number; // ms before marking user as inactive (default: 2min)
  activityType?: 'browsing' | 'watching' | 'livetv';
  contentId?: string;
  contentTitle?: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
}

interface PresenceState {
  isActive: boolean;
  isVisible: boolean;
  lastActivity: number;
  sessionId: string;
  userId: string;
}

// Generate a fingerprint-based user ID that persists across sessions
function generateUserId(): string {
  if (typeof window === 'undefined') return '';
  
  const stored = localStorage.getItem('flyx_user_id');
  if (stored) return stored;
  
  // Create a semi-persistent ID based on browser characteristics
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let fingerprint = '';
  
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    fingerprint = canvas.toDataURL().slice(-50);
  }
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    fingerprint,
    Math.random().toString(36).substring(2, 8),
  ];
  
  // Simple hash function
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const userId = `u_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  localStorage.setItem('flyx_user_id', userId);
  return userId;
}

// Generate session ID (new per browser session)
function generateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const stored = sessionStorage.getItem('flyx_session_id');
  if (stored) return stored;
  
  const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStorage.setItem('flyx_session_id', sessionId);
  return sessionId;
}

// Detect if the request is likely from a bot
function detectBot(): { isBot: boolean; reason?: string } {
  if (typeof window === 'undefined') return { isBot: true, reason: 'server-side' };
  
  const ua = navigator.userAgent.toLowerCase();
  
  // Known bot patterns
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python',
    'java/', 'httpclient', 'headless', 'phantom', 'selenium', 'puppeteer',
    'playwright', 'webdriver', 'lighthouse', 'pagespeed', 'gtmetrix',
  ];
  
  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      return { isBot: true, reason: `ua-pattern:${pattern}` };
    }
  }
  
  // Check for headless browser indicators
  if (navigator.webdriver) {
    return { isBot: true, reason: 'webdriver' };
  }
  
  // Check for missing browser features that real browsers have
  // @ts-ignore
  if (!window.chrome && ua.includes('chrome')) {
    return { isBot: true, reason: 'fake-chrome' };
  }
  
  // Check for automation tools
  // @ts-ignore
  if (window._phantom || window.__nightmare || window.callPhantom) {
    return { isBot: true, reason: 'automation-tool' };
  }
  
  // Check for suspicious screen dimensions
  if (screen.width === 0 || screen.height === 0) {
    return { isBot: true, reason: 'no-screen' };
  }
  
  // Check for missing plugins (most real browsers have some)
  if (navigator.plugins.length === 0 && !ua.includes('mobile')) {
    // Could be a bot, but not definitive - just flag it
    return { isBot: false, reason: 'no-plugins-warning' };
  }
  
  return { isBot: false };
}

// Validate user interaction (proof of human activity)
function createInteractionValidator() {
  let hasInteracted = false;
  let interactionCount = 0;
  let lastInteractionTime = 0;
  
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
  
  const handler = () => {
    hasInteracted = true;
    interactionCount++;
    lastInteractionTime = Date.now();
  };
  
  const attach = () => {
    events.forEach(event => {
      document.addEventListener(event, handler, { passive: true });
    });
  };
  
  const detach = () => {
    events.forEach(event => {
      document.removeEventListener(event, handler);
    });
  };
  
  const getStats = () => ({
    hasInteracted,
    interactionCount,
    lastInteractionTime,
    timeSinceLastInteraction: lastInteractionTime ? Date.now() - lastInteractionTime : null,
  });
  
  const reset = () => {
    interactionCount = 0;
  };
  
  return { attach, detach, getStats, reset };
}

export function usePresence(config: PresenceConfig = {}) {
  const {
    heartbeatInterval = 30000, // 30 seconds
    inactivityTimeout = 120000, // 2 minutes
    activityType = 'browsing',
    contentId,
    contentTitle,
    contentType,
    seasonNumber,
    episodeNumber,
  } = config;
  
  const [state, setState] = useState<PresenceState>({
    isActive: true,
    isVisible: true,
    lastActivity: Date.now(),
    sessionId: '',
    userId: '',
  });
  
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityRef = useRef<NodeJS.Timeout | null>(null);
  const validatorRef = useRef<ReturnType<typeof createInteractionValidator> | null>(null);
  const isInitializedRef = useRef(false);
  const lastHeartbeatRef = useRef(0);
  
  // Send heartbeat to server
  const sendHeartbeat = useCallback(async (isActive: boolean, isLeaving = false) => {
    if (typeof window === 'undefined') return;
    
    // Throttle heartbeats (min 5 seconds apart)
    const now = Date.now();
    if (!isLeaving && now - lastHeartbeatRef.current < 5000) return;
    lastHeartbeatRef.current = now;
    
    const botCheck = detectBot();
    const interactionStats = validatorRef.current?.getStats();
    
    try {
      const payload = {
        userId: state.userId,
        sessionId: state.sessionId,
        activityType,
        contentId,
        contentTitle,
        contentType,
        seasonNumber,
        episodeNumber,
        isActive: isActive && !botCheck.isBot,
        isVisible: state.isVisible,
        isLeaving,
        // Validation data
        validation: {
          isBot: botCheck.isBot,
          botReason: botCheck.reason,
          hasInteracted: interactionStats?.hasInteracted ?? false,
          interactionCount: interactionStats?.interactionCount ?? 0,
          timeSinceLastInteraction: interactionStats?.timeSinceLastInteraction,
        },
        timestamp: now,
      };
      
      // Use sendBeacon for leaving events (more reliable)
      // Get the CF worker URL for presence
      const presenceUrl = getAnalyticsEndpoint('presence');
      
      if (isLeaving && navigator.sendBeacon) {
        navigator.sendBeacon(
          presenceUrl,
          JSON.stringify(payload)
        );
      } else {
        await fetch(presenceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: isLeaving,
        });
      }
      
      // Reset interaction count after successful heartbeat
      validatorRef.current?.reset();
    } catch (error) {
      console.error('[Presence] Heartbeat failed:', error);
    }
  }, [state.userId, state.sessionId, activityType, contentId, contentTitle, contentType, seasonNumber, episodeNumber, state.isVisible]);
  
  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    setState(prev => ({ ...prev, isVisible, lastActivity: Date.now() }));
    
    if (isVisible) {
      // Tab became visible - send heartbeat
      sendHeartbeat(true);
    } else {
      // Tab hidden - mark as inactive
      sendHeartbeat(false);
    }
  }, [sendHeartbeat]);
  
  // Handle user activity
  const handleActivity = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true, lastActivity: Date.now() }));
    
    // Reset inactivity timer
    if (inactivityRef.current) {
      clearTimeout(inactivityRef.current);
    }
    
    inactivityRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isActive: false }));
      sendHeartbeat(false);
    }, inactivityTimeout);
  }, [inactivityTimeout, sendHeartbeat]);
  
  // Handle page unload
  const handleUnload = useCallback(() => {
    sendHeartbeat(false, true);
  }, [sendHeartbeat]);
  
  // Initialize presence tracking
  useEffect(() => {
    if (typeof window === 'undefined' || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    // Generate IDs
    const userId = generateUserId();
    const sessionId = generateSessionId();
    setState(prev => ({ ...prev, userId, sessionId }));
    
    // Setup interaction validator
    validatorRef.current = createInteractionValidator();
    validatorRef.current.attach();
    
    // Setup visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Setup unload listeners
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    
    // Setup activity listeners for inactivity detection
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
    
    // Initial heartbeat
    sendHeartbeat(true);
    
    // Setup heartbeat interval
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(state.isActive);
      }
    }, heartbeatInterval);
    
    return () => {
      // Cleanup
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      
      validatorRef.current?.detach();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      // Send final heartbeat
      sendHeartbeat(false, true);
      isInitializedRef.current = false;
    };
  }, []);
  
  // Update heartbeat when content changes
  useEffect(() => {
    if (contentId && state.userId) {
      sendHeartbeat(true);
    }
  }, [contentId, contentTitle, activityType]);
  
  return {
    ...state,
    sendHeartbeat,
  };
}

export default usePresence;
