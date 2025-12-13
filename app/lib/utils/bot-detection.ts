/**
 * Advanced Bot Detection Utility (Client-Side Only)
 * 
 * All detection runs in the browser. Server-side detection is pointless because:
 * - Bots can simply not call our APIs
 * - Headers are easily spoofed
 * - The real value is in detecting automation in the browser environment
 * 
 * Multi-layered approach:
 * 1. User-Agent analysis
 * 2. Browser fingerprint validation  
 * 3. Behavioral analysis (mouse movements, interaction patterns)
 * 4. JavaScript environment checks (webdriver, automation tools)
 * 5. Timing analysis
 * 6. Canvas/WebGL fingerprinting
 */

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number; // 0-100, higher = more likely bot
  reasons: string[];
  fingerprint?: string;
  checks: {
    userAgent: boolean;
    webdriver: boolean;
    headless: boolean;
    automation: boolean;
    browserFeatures: boolean;
    timing: boolean;
    behavior: boolean;
  };
}

// Known bot user-agent patterns
const BOT_UA_PATTERNS = [
  // Search engine bots
  'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'duckduckbot',
  'slurp', 'msnbot', 'teoma', 'ia_archiver', 'archive.org_bot',
  // Social media bots
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'pinterest',
  'slackbot', 'telegrambot', 'whatsapp', 'discordbot',
  // SEO/Analytics tools
  'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'petalbot', 'rogerbot',
  'screaming frog', 'seokicks', 'sistrix', 'blexbot',
  // Generic patterns
  'bot', 'crawler', 'spider', 'scraper', 'fetcher', 'archiver',
  // HTTP clients
  'curl', 'wget', 'python-requests', 'python-urllib', 'java/',
  'httpclient', 'okhttp', 'axios', 'node-fetch', 'got/',
  // Headless browsers
  'headless', 'phantom', 'puppeteer', 'playwright', 'selenium',
  'webdriver', 'chromedriver', 'geckodriver',
  // Performance tools
  'lighthouse', 'pagespeed', 'gtmetrix', 'pingdom', 'uptimerobot',
];



/**
 * Client-side bot detection
 * Run this in the browser
 */
export function detectBotClient(): BotDetectionResult {
  if (typeof window === 'undefined') {
    return {
      isBot: true,
      confidence: 100,
      reasons: ['server-side-execution'],
      checks: {
        userAgent: true,
        webdriver: true,
        headless: true,
        automation: true,
        browserFeatures: true,
        timing: true,
        behavior: true,
      },
    };
  }

  const reasons: string[] = [];
  const checks = {
    userAgent: false,
    webdriver: false,
    headless: false,
    automation: false,
    browserFeatures: false,
    timing: false,
    behavior: false,
  };

  // 1. User-Agent check
  const ua = navigator.userAgent.toLowerCase();
  for (const pattern of BOT_UA_PATTERNS) {
    if (ua.includes(pattern)) {
      checks.userAgent = true;
      reasons.push(`ua-pattern:${pattern}`);
      break;
    }
  }

  // 2. WebDriver detection
  if (navigator.webdriver) {
    checks.webdriver = true;
    reasons.push('webdriver-property');
  }

  // Check for webdriver in various ways
  // @ts-ignore
  if (window.navigator.webdriver === true) {
    checks.webdriver = true;
    reasons.push('navigator-webdriver');
  }

  // @ts-ignore
  if (document.documentElement.getAttribute('webdriver')) {
    checks.webdriver = true;
    reasons.push('webdriver-attribute');
  }

  // 3. Headless browser detection
  // @ts-ignore
  if (window.chrome && !window.chrome.runtime) {
    // Chrome without runtime could be headless
    // But need more checks to confirm
  }

  // Check for headless Chrome
  if (ua.includes('headlesschrome')) {
    checks.headless = true;
    reasons.push('headless-chrome-ua');
  }

  // Check for missing plugins (headless browsers often have none)
  if (navigator.plugins.length === 0 && !isMobileDevice()) {
    checks.headless = true;
    reasons.push('no-plugins');
  }

  // Check for missing languages
  if (!navigator.languages || navigator.languages.length === 0) {
    checks.headless = true;
    reasons.push('no-languages');
  }

  // 4. Automation tool detection
  // @ts-ignore
  if (window._phantom || window.__nightmare || window.callPhantom) {
    checks.automation = true;
    reasons.push('phantom-detected');
  }

  // @ts-ignore
  if (window.__selenium_unwrapped || window.__webdriver_evaluate) {
    checks.automation = true;
    reasons.push('selenium-detected');
  }

  // @ts-ignore
  if (window.__fxdriver_evaluate || window.__driver_unwrapped) {
    checks.automation = true;
    reasons.push('firefox-webdriver');
  }

  // Check for Puppeteer
  // @ts-ignore
  if (window.__puppeteer_evaluation_script__) {
    checks.automation = true;
    reasons.push('puppeteer-detected');
  }

  // Check for Playwright
  // @ts-ignore
  if (window.__playwright) {
    checks.automation = true;
    reasons.push('playwright-detected');
  }

  // Check for CDP (Chrome DevTools Protocol)
  // @ts-ignore
  if (window.cdc_adoQpoasnfa76pfcZLmcfl_Array) {
    checks.automation = true;
    reasons.push('cdp-detected');
  }

  // 5. Browser feature validation
  // Real browsers have certain features
  if (!window.localStorage || !window.sessionStorage) {
    checks.browserFeatures = true;
    reasons.push('no-storage');
  }

  if (!window.indexedDB) {
    checks.browserFeatures = true;
    reasons.push('no-indexeddb');
  }

  // Check for notification API (most real browsers have it)
  if (!('Notification' in window) && !isMobileDevice()) {
    checks.browserFeatures = true;
    reasons.push('no-notification-api');
  }

  // Check screen dimensions
  if (screen.width === 0 || screen.height === 0) {
    checks.browserFeatures = true;
    reasons.push('invalid-screen');
  }

  // Check for impossible screen dimensions
  if (screen.width < 100 || screen.height < 100) {
    checks.browserFeatures = true;
    reasons.push('suspicious-screen-size');
  }

  // Check color depth
  if (screen.colorDepth < 8) {
    checks.browserFeatures = true;
    reasons.push('low-color-depth');
  }

  // Check for touch support consistency
  const hasTouchUA = /mobile|android|iphone|ipad|tablet/i.test(ua);
  const hasTouchAPI = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (hasTouchUA && !hasTouchAPI) {
    checks.browserFeatures = true;
    reasons.push('touch-mismatch');
  }

  // 6. Timing analysis (basic)
  // Bots often have very consistent/fast timing
  const perfTiming = performance.timing;
  if (perfTiming) {
    const loadTime = perfTiming.loadEventEnd - perfTiming.navigationStart;
    // Suspiciously fast page load (< 50ms) might indicate pre-rendered/cached bot
    if (loadTime > 0 && loadTime < 50) {
      checks.timing = true;
      reasons.push('suspicious-load-time');
    }
  }

  // Calculate confidence score
  let confidence = 0;
  if (checks.userAgent) confidence += 30;
  if (checks.webdriver) confidence += 40;
  if (checks.headless) confidence += 25;
  if (checks.automation) confidence += 50;
  if (checks.browserFeatures) confidence += 15;
  if (checks.timing) confidence += 10;

  // Cap at 100
  confidence = Math.min(100, confidence);

  // Generate fingerprint for tracking
  const fingerprint = generateFingerprint();

  return {
    isBot: confidence >= 50,
    confidence,
    reasons,
    fingerprint,
    checks,
  };
}

// Note: Server-side bot detection removed - it's pointless because:
// 1. Bots can simply not call our presence API
// 2. Headers are easily spoofed
// 3. All meaningful detection happens client-side in the browser environment

/**
 * Generate a browser fingerprint
 */
function generateFingerprint(): string {
  if (typeof window === 'undefined') return '';

  const components: string[] = [];

  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Timezone
  components.push(String(new Date().getTimezoneOffset()));

  // Language
  components.push(navigator.language || '');

  // Platform
  components.push(navigator.platform || '');

  // Plugins count
  components.push(String(navigator.plugins.length));

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Flyx', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Flyx', 4, 17);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push('canvas-error');
  }

  // WebGL info - with proper cleanup to avoid context leaks
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
      // Cleanup WebGL context to prevent "too many contexts" warning
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  } catch {
    components.push('webgl-error');
  }

  // Hash the components
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Check if device is mobile
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent);
}

/**
 * Behavioral analysis - track user interactions
 */
export class BehaviorAnalyzer {
  private interactions: { type: string; timestamp: number; data?: any }[] = [];
  private startTime: number;
  private mouseMovements: { x: number; y: number; t: number }[] = [];

  constructor() {
    this.startTime = Date.now();
  }

  recordInteraction(type: string, data?: any) {
    this.interactions.push({
      type,
      timestamp: Date.now() - this.startTime,
      data,
    });
  }

  recordMouseMove(x: number, y: number) {
    // Sample mouse movements (don't record every single one)
    const now = Date.now();
    const last = this.mouseMovements[this.mouseMovements.length - 1];
    if (!last || now - last.t > 100) {
      this.mouseMovements.push({ x, y, t: now - this.startTime });
      // Keep only last 100 movements
      if (this.mouseMovements.length > 100) {
        this.mouseMovements.shift();
      }
    }
  }

  analyze(): { isBot: boolean; confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    let botScore = 0;

    const sessionDuration = Date.now() - this.startTime;

    // 1. No interactions at all after some time
    if (sessionDuration > 10000 && this.interactions.length === 0) {
      botScore += 20;
      reasons.push('no-interactions');
    }

    // 2. No mouse movements (on desktop)
    if (!isMobileDevice() && sessionDuration > 5000 && this.mouseMovements.length < 5) {
      botScore += 15;
      reasons.push('no-mouse-movement');
    }

    // 3. Perfectly linear mouse movements (bot-like)
    if (this.mouseMovements.length > 10) {
      const isLinear = this.checkLinearMovement();
      if (isLinear) {
        botScore += 25;
        reasons.push('linear-mouse-movement');
      }
    }

    // 4. Interactions too fast (inhuman speed)
    if (this.interactions.length > 2) {
      const avgInterval = this.calculateAverageInterval();
      if (avgInterval < 50) {
        // Less than 50ms between interactions
        botScore += 30;
        reasons.push('inhuman-interaction-speed');
      }
    }

    // 5. No scroll events on a long page
    const hasScroll = this.interactions.some((i) => i.type === 'scroll');
    if (sessionDuration > 15000 && !hasScroll) {
      botScore += 10;
      reasons.push('no-scroll');
    }

    return {
      isBot: botScore >= 40,
      confidence: Math.min(100, botScore),
      reasons,
    };
  }

  private checkLinearMovement(): boolean {
    if (this.mouseMovements.length < 10) return false;

    // Check if movements follow a straight line
    let linearCount = 0;
    for (let i = 2; i < this.mouseMovements.length; i++) {
      const p1 = this.mouseMovements[i - 2];
      const p2 = this.mouseMovements[i - 1];
      const p3 = this.mouseMovements[i];

      // Calculate if points are collinear
      const area = Math.abs(
        (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
      );
      if (area < 10) linearCount++;
    }

    // If more than 80% of movements are linear, suspicious
    return linearCount / (this.mouseMovements.length - 2) > 0.8;
  }

  private calculateAverageInterval(): number {
    if (this.interactions.length < 2) return Infinity;

    let totalInterval = 0;
    for (let i = 1; i < this.interactions.length; i++) {
      totalInterval += this.interactions[i].timestamp - this.interactions[i - 1].timestamp;
    }
    return totalInterval / (this.interactions.length - 1);
  }
}

/**
 * Challenge-response verification
 * Generate a challenge that bots typically fail
 */
export function generateChallenge(): { id: string; challenge: string; answer: string } {
  const id = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Simple math challenge (can be made more complex)
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const operations = ['+', '-', '*'];
  const op = operations[Math.floor(Math.random() * operations.length)];
  
  let answer: number;
  switch (op) {
    case '+': answer = a + b; break;
    case '-': answer = a - b; break;
    case '*': answer = a * b; break;
    default: answer = a + b;
  }

  return {
    id,
    challenge: `${a} ${op} ${b}`,
    answer: String(answer),
  };
}

export default {
  detectBotClient,
  BehaviorAnalyzer,
  generateChallenge,
};
