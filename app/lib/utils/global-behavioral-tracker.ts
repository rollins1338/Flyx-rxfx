/**
 * Global Behavioral Tracker
 * 
 * Tracks mouse entropy, scroll patterns, and other behavioral data
 * from the moment the user lands on ANY page. This data is:
 * 1. Sent with presence heartbeats to build historical trust
 * 2. Available to Quantum Shield for stream protection
 * 3. Used for bot detection across the entire app
 */

'use client';

// Global state - persists across component renders
let isInitialized = false;
let mousePositions: Array<{ x: number; y: number; t: number }> = [];
let scrollEvents: Array<{ y: number; t: number }> = [];
let keystrokeIntervals: number[] = [];
let lastKeyTime = 0;
let mouseEntropy = 0;
let lastEntropyCalculation = 0;

// Listeners for entropy updates
type EntropyListener = (entropy: number, samples: number) => void;
const entropyListeners: Set<EntropyListener> = new Set();

/**
 * Calculate Shannon entropy of mouse movement angles
 */
function calculateMouseEntropy(positions: Array<{ x: number; y: number; t: number }>): number {
  if (positions.length < 10) return 0;

  const angles: number[] = [];
  for (let i = 2; i < positions.length; i++) {
    const p1 = positions[i - 2];
    const p2 = positions[i - 1];
    const p3 = positions[i];

    const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
    angles.push(Math.abs(angle2 - angle1));
  }

  const bins = new Array(20).fill(0);
  angles.forEach((a) => {
    const bin = Math.min(19, Math.floor(a / (Math.PI / 10)));
    bins[bin]++;
  });

  const total = angles.length;
  let entropy = 0;
  bins.forEach((count) => {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  });

  return entropy / Math.log2(20); // Normalize to 0-1
}

/**
 * Initialize global behavioral tracking
 * Call this once when the app loads (e.g., in layout or PresenceProvider)
 */
export function initGlobalBehavioralTracking(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  console.log('[BehavioralTracker] Initializing global tracking...');

  // Mouse movement tracking - throttled to reduce CPU usage
  let lastMouseTime = 0;
  document.addEventListener(
    'mousemove',
    (e) => {
      const now = performance.now();
      
      // Throttle mouse position recording to every 50ms
      if (now - lastMouseTime < 50) {
        return;
      }
      lastMouseTime = now;
      
      mousePositions.push({ x: e.clientX, y: e.clientY, t: now });

      // Keep last 500 positions (reduced from 1000)
      if (mousePositions.length > 500) {
        mousePositions.shift();
      }

      // Recalculate entropy every 500ms (increased from 100ms)
      if (now - lastEntropyCalculation > 500) {
        mouseEntropy = calculateMouseEntropy(mousePositions);
        lastEntropyCalculation = now;

        // Notify listeners
        entropyListeners.forEach((listener) => {
          listener(mouseEntropy, mousePositions.length);
        });
      }
    },
    { passive: true }
  );

  // Scroll tracking
  window.addEventListener(
    'scroll',
    () => {
      scrollEvents.push({ y: window.scrollY, t: performance.now() });
      if (scrollEvents.length > 200) {
        scrollEvents.shift();
      }
    },
    { passive: true }
  );

  // Keystroke timing
  document.addEventListener(
    'keydown',
    () => {
      const now = performance.now();
      if (lastKeyTime > 0) {
        keystrokeIntervals.push(now - lastKeyTime);
        if (keystrokeIntervals.length > 100) {
          keystrokeIntervals.shift();
        }
      }
      lastKeyTime = now;
    },
    { passive: true }
  );

  console.log('[BehavioralTracker] Global tracking initialized');
}

/**
 * Get current behavioral data
 */
export function getBehavioralData(): {
  mouseEntropy: number;
  mouseSamples: number;
  scrollSamples: number;
  keystrokeSamples: number;
  mousePositions: Array<{ x: number; y: number; t: number }>;
  scrollEvents: Array<{ y: number; t: number }>;
  keystrokeIntervals: number[];
} {
  return {
    mouseEntropy,
    mouseSamples: mousePositions.length,
    scrollSamples: scrollEvents.length,
    keystrokeSamples: keystrokeIntervals.length,
    mousePositions: [...mousePositions],
    scrollEvents: [...scrollEvents],
    keystrokeIntervals: [...keystrokeIntervals],
  };
}

/**
 * Get just the entropy value
 */
export function getMouseEntropy(): number {
  return mouseEntropy;
}

/**
 * Get sample counts
 */
export function getSampleCounts(): { mouse: number; scroll: number; keystrokes: number } {
  return {
    mouse: mousePositions.length,
    scroll: scrollEvents.length,
    keystrokes: keystrokeIntervals.length,
  };
}

/**
 * Subscribe to entropy updates
 */
export function onEntropyUpdate(listener: EntropyListener): () => void {
  entropyListeners.add(listener);
  // Return unsubscribe function
  return () => entropyListeners.delete(listener);
}

/**
 * Check if tracking is initialized
 */
export function isTrackingInitialized(): boolean {
  return isInitialized;
}
