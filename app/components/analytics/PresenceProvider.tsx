/**
 * PresenceProvider - Global presence tracking component
 * 
 * Wraps the app to provide automatic presence tracking for all users.
 * Tracks browsing activity by default, can be enhanced for watching/livetv.
 * Includes advanced bot detection and behavioral analysis.
 */

'use client';

import { createContext, useContext, ReactNode, useEffect, useRef, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { detectBotClient, BehaviorAnalyzer, type BotDetectionResult } from '@/lib/utils/bot-detection';
import { initGlobalBehavioralTracking, getBehavioralData } from '@/lib/utils/global-behavioral-tracker';

interface PresenceContextValue {
  userId: string;
  sessionId: string;
  isActive: boolean;
  setActivityType: (type: 'browsing' | 'watching' | 'livetv', content?: ContentInfo) => void;
  setBrowsingContext: (pageName: string, contentTitle?: string, contentId?: string, contentType?: 'movie' | 'tv') => void;
}

interface ContentInfo {
  contentId?: string;
  contentTitle?: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresenceContext() {
  return useContext(PresenceContext);
}

// Generate persistent user ID with fingerprinting
function getUserId(): string {
  if (typeof window === 'undefined') return '';
  
  let userId = localStorage.getItem('flyx_user_id');
  if (userId) return userId;
  
  // Generate fingerprint-based ID with more components
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform || '',
    // Canvas fingerprint
    getCanvasFingerprint(),
    Math.random().toString(36).substring(2, 8),
  ];
  
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  
  userId = `u_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  localStorage.setItem('flyx_user_id', userId);
  return userId;
}

// Canvas fingerprint for user identification
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Flyx', 2, 15);
    return canvas.toDataURL().slice(-30);
  } catch {
    return 'canvas-error';
  }
}

// Generate session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('flyx_session_id');
  if (sessionId) return sessionId;
  
  sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStorage.setItem('flyx_session_id', sessionId);
  return sessionId;
}

interface PresenceProviderProps {
  children: ReactNode;
}

export function PresenceProvider({ children }: PresenceProviderProps) {
  const pathname = usePathname();
  const [userId, setUserId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const activityTypeRef = useRef<'browsing' | 'watching' | 'livetv'>('browsing');
  const contentRef = useRef<ContentInfo>({});
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef(0);
  const interactionCountRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const lastInteractionRef = useRef(0);
  const isInitializedRef = useRef(false);
  const botDetectionRef = useRef<BotDetectionResult | null>(null);
  const behaviorAnalyzerRef = useRef<BehaviorAnalyzer | null>(null);
  
  // Mouse entropy tracking
  const mousePositionsRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const mouseEntropyRef = useRef(0);
  const scrollEventsRef = useRef<Array<{ y: number; t: number }>>([]);
  
  // Send heartbeat with enhanced bot detection
  const sendHeartbeat = useCallback(async (active: boolean, leaving = false) => {
    if (!userId || !sessionId) return;
    
    // Check bot detection result
    const botResult = botDetectionRef.current;
    if (botResult?.isBot && botResult.confidence >= 70) {
      console.log('[Presence] High-confidence bot detected, skipping tracking');
      return;
    }
    
    const now = Date.now();
    
    // Throttle (min 5s apart, except for leaving)
    if (!leaving && now - lastHeartbeatRef.current < 5000) return;
    lastHeartbeatRef.current = now;
    
    // Get behavioral analysis
    const behaviorResult = behaviorAnalyzerRef.current?.analyze();
    
    // Get GLOBAL behavioral data (tracked from page load)
    const globalBehavior = getBehavioralData();
    
    const payload = {
      userId,
      sessionId,
      activityType: activityTypeRef.current,
      ...contentRef.current,
      isActive: active,
      isVisible: document.visibilityState === 'visible',
      isLeaving: leaving,
      // Referrer tracking
      referrer: document.referrer || undefined,
      entryPage: typeof window !== 'undefined' ? window.location.pathname : undefined,
      validation: {
        isBot: botResult?.isBot || false,
        botConfidence: botResult?.confidence || 0,
        botReasons: botResult?.reasons || [],
        fingerprint: botResult?.fingerprint,
        hasInteracted: hasInteractedRef.current,
        interactionCount: interactionCountRef.current,
        timeSinceLastInteraction: lastInteractionRef.current ? now - lastInteractionRef.current : null,
        // Behavioral analysis
        behaviorIsBot: behaviorResult?.isBot || false,
        behaviorConfidence: behaviorResult?.confidence || 0,
        behaviorReasons: behaviorResult?.reasons || [],
        // Mouse entropy data from GLOBAL tracker
        mouseEntropy: globalBehavior.mouseEntropy,
        mouseSamples: globalBehavior.mouseSamples,
        scrollSamples: globalBehavior.scrollSamples,
        // Screen info for fingerprinting/deduplication
        screenResolution: typeof window !== 'undefined' ? `${screen.width}x${screen.height}` : undefined,
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
      },
      timestamp: now,
    };
    
    try {
      if (leaving && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/presence', JSON.stringify(payload));
      } else {
        await fetch('/api/analytics/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: leaving,
        });
      }
      
      // Reset interaction count after heartbeat
      interactionCountRef.current = 0;
    } catch {
      // Silent fail - don't break the app
    }
  }, [userId, sessionId]);
  
  // Handle user interaction with behavioral tracking
  const handleInteraction = useCallback((event?: Event) => {
    hasInteractedRef.current = true;
    interactionCountRef.current++;
    lastInteractionRef.current = Date.now();
    setIsActive(true);
    
    // Record interaction for behavioral analysis
    if (behaviorAnalyzerRef.current && event) {
      behaviorAnalyzerRef.current.recordInteraction(event.type);
    }
    
    // Reset inactivity timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    inactivityTimeoutRef.current = setTimeout(() => {
      setIsActive(false);
      sendHeartbeat(false);
    }, 120000); // 2 min inactivity
  }, [sendHeartbeat]);
  
  // Calculate mouse entropy from positions
  const calculateMouseEntropy = useCallback((positions: Array<{ x: number; y: number; t: number }>): number => {
    if (positions.length < 10) return 0;

    // Calculate angle changes between consecutive movements
    const angles: number[] = [];
    for (let i = 2; i < positions.length; i++) {
      const p1 = positions[i - 2];
      const p2 = positions[i - 1];
      const p3 = positions[i];
      
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      angles.push(Math.abs(angle2 - angle1));
    }

    // Shannon entropy of angle distribution
    const bins = new Array(20).fill(0);
    angles.forEach(a => {
      const bin = Math.min(19, Math.floor(a / (Math.PI / 10)));
      bins[bin]++;
    });

    const total = angles.length;
    let entropy = 0;
    bins.forEach(count => {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    });

    // Normalize to 0-1
    return entropy / Math.log2(20);
  }, []);

  // Handle mouse movement for behavioral analysis and entropy tracking
  // Throttled to reduce CPU usage
  const lastMouseMoveRef = useRef(0);
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const now = performance.now();
    
    // Throttle to every 100ms
    if (now - lastMouseMoveRef.current < 100) {
      return;
    }
    lastMouseMoveRef.current = now;
    
    if (behaviorAnalyzerRef.current) {
      behaviorAnalyzerRef.current.recordMouseMove(event.clientX, event.clientY);
    }
    
    // Track mouse positions for entropy calculation
    mousePositionsRef.current.push({ x: event.clientX, y: event.clientY, t: now });
    
    // Keep last 200 positions (reduced from 500)
    if (mousePositionsRef.current.length > 200) {
      mousePositionsRef.current.shift();
    }
    
    // Recalculate entropy every 50 positions
    if (mousePositionsRef.current.length % 50 === 0) {
      mouseEntropyRef.current = calculateMouseEntropy(mousePositionsRef.current);
    }
  }, [calculateMouseEntropy]);
  
  // Handle scroll for behavioral tracking
  const handleScroll = useCallback(() => {
    const now = performance.now();
    scrollEventsRef.current.push({ y: window.scrollY, t: now });
    
    // Keep last 100 scroll events
    if (scrollEventsRef.current.length > 100) {
      scrollEventsRef.current.shift();
    }
  }, []);
  
  // Handle visibility change
  const handleVisibility = useCallback(() => {
    const visible = document.visibilityState === 'visible';
    if (visible) {
      sendHeartbeat(true);
    } else {
      sendHeartbeat(false);
    }
  }, [sendHeartbeat]);
  
  // Handle page unload
  const handleUnload = useCallback(() => {
    sendHeartbeat(false, true);
  }, [sendHeartbeat]);
  
  // Set activity type (called by video player, etc.)
  const setActivityType = useCallback((type: 'browsing' | 'watching' | 'livetv', content?: ContentInfo) => {
    activityTypeRef.current = type;
    if (content) {
      contentRef.current = content;
    }
    sendHeartbeat(true);
  }, [sendHeartbeat]);
  
  // Set browsing context (called by pages to track what users are browsing)
  // Only sends heartbeat if context actually changed
  const setBrowsingContext = useCallback((pageName: string, contentTitle?: string, contentId?: string, contentType?: 'movie' | 'tv') => {
    const newTitle = contentTitle || pageName;
    const currentTitle = contentRef.current.contentTitle;
    const currentId = contentRef.current.contentId;
    
    // Only update and send heartbeat if something changed
    if (newTitle !== currentTitle || contentId !== currentId) {
      activityTypeRef.current = 'browsing';
      contentRef.current = {
        contentTitle: newTitle,
        contentId: contentId,
        contentType: contentType,
      };
      sendHeartbeat(true);
    }
  }, [sendHeartbeat]);
  
  // Initialize with enhanced bot detection
  useEffect(() => {
    if (typeof window === 'undefined' || isInitializedRef.current) return;
    
    // Run comprehensive bot detection
    const botResult = detectBotClient();
    botDetectionRef.current = botResult;
    
    if (botResult.isBot && botResult.confidence >= 70) {
      console.log('[Presence] Bot detected with high confidence:', botResult.reasons);
      return;
    }
    
    if (botResult.confidence >= 40) {
      console.log('[Presence] Suspicious activity detected:', botResult.reasons);
      // Still track but flag as suspicious
    }
    
    isInitializedRef.current = true;
    
    // Initialize GLOBAL behavioral tracking (tracks from page load)
    initGlobalBehavioralTracking();
    
    // Initialize behavioral analyzer
    behaviorAnalyzerRef.current = new BehaviorAnalyzer();
    
    const uid = getUserId();
    const sid = getSessionId();
    setUserId(uid);
    setSessionId(sid);
    
    // Setup event listeners for interaction tracking
    const interactionEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const interactionHandler = (e: Event) => handleInteraction(e);
    interactionEvents.forEach(e => document.addEventListener(e, interactionHandler, { passive: true }));
    
    // Separate mouse move handler for behavioral analysis (throttled in the handler)
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Scroll tracking for behavioral analysis
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    
    // Start heartbeat interval (30s)
    heartbeatIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(isActive);
      }
    }, 30000);
    
    // Initial heartbeat (delayed to allow bot detection and page components to set their context)
    // 1 second delay gives pages time to call setBrowsingContext
    setTimeout(() => sendHeartbeat(true), 1000);
    
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      
      interactionEvents.forEach(e => document.removeEventListener(e, interactionHandler));
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      
      sendHeartbeat(false, true);
      isInitializedRef.current = false;
      behaviorAnalyzerRef.current = null;
    };
  }, [handleInteraction, handleMouseMove, handleScroll, handleVisibility, handleUnload, sendHeartbeat, isActive]);
  
  // Track page changes
  useEffect(() => {
    if (userId && sessionId) {
      // Reset to browsing when navigating (unless on watch page)
      if (!pathname?.includes('/watch')) {
        activityTypeRef.current = 'browsing';
        // Clear content info when navigating away from watch/details pages
        // Pages will set their own context via setBrowsingContext
        if (!pathname?.includes('/details')) {
          contentRef.current = {};
        }
      }
      // Don't send heartbeat here - let pages call setBrowsingContext which will send the heartbeat
      // This prevents the race condition where we send a heartbeat with empty content before the page sets it
      // The regular 30s heartbeat interval will still keep the session alive
    }
  }, [pathname, userId, sessionId]);
  
  return (
    <PresenceContext.Provider value={{ userId, sessionId, isActive, setActivityType, setBrowsingContext }}>
      {children}
    </PresenceContext.Provider>
  );
}

export default PresenceProvider;
