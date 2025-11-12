/**
 * DEOBFUSCATED VIDSRC AD SYSTEM
 * This is the ad serving code, NOT stream extraction
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const AD_TYPES = {
  INTERSTITIAL: 'interstitial',
  POP: 'pop',
  TABSWAP: 'tabswap'
};

const STORAGE_KEYS = {
  UTSID: 'utsid-send',
  DEBUG: 'adcsh_dbg'
};

const DOM_ATTRIBUTES = {
  ZONE_ID: 'znid',
  DO_SKIP: 'doskip',
  DONT_FOLLOW: 'dontfo',
  DONT_OVERLAY: 'donto',
  PREVENT_CLICK: 'prclck',
  DONT_FOLLOW_ID: 'dontfoid'
};

const MAX_Z_INDEX = 2147483647;
const BLUE_COLOR = '#399afe';

// ============================================================================
// LOGGER CLASS
// ============================================================================

class AdLogger {
  constructor(tagName = 'adcsh', isDebugEnabled = false) {
    this.tagName = tagName;
    this.isDebugEnabled = isDebugEnabled;
    
    // Check localStorage for debug setting
    const storedDebug = localStorage.getItem(STORAGE_KEYS.DEBUG);
    if (storedDebug) {
      this.isDebugEnabled = JSON.parse(storedDebug);
    }
  }
  
  _log(level, args) {
    if (this.isDebugEnabled) {
      console.log(`[${this.tagName}][${level}]:`, ...args);
    }
  }
  
  debug(...args) {
    this._log('debug', args);
  }
  
  error(...args) {
    this._log('error', args);
  }
}

// ============================================================================
// EVENT EMITTER CLASS
// ============================================================================

class EventEmitter {
  constructor() {
    this._handlers = [];
  }
  
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Handler must be a function, got ${typeof handler}`);
    }
    if (!event) {
      throw new TypeError(`Event must be a string, got ${typeof event}`);
    }
    
    this._handlers.push({ event, handler });
    return this;
  }
  
  once(event, handler) {
    const wrapper = (...args) => {
      if (!wrapper.fired) {
        this.off(event, wrapper);
        wrapper.fired = true;
        handler.apply(this, args);
      }
    };
    wrapper.fired = false;
    return this.on(event, wrapper);
  }
  
  off(event, handler) {
    this._handlers = this._handlers.filter(h => 
      h.event !== event || h.handler !== handler
    );
    return this;
  }
  
  emit(event, ...args) {
    let handled = false;
    this._handlers.forEach(h => {
      if (h.event === '*') {
        handled = true;
        h.handler(event, ...args);
      }
      if (h.event === event) {
        handled = true;
        h.handler(...args);
      }
    });
    return handled;
  }
  
  removeAllListeners(event) {
    if (event) {
      this._handlers = this._handlers.filter(h => h.event !== event);
    } else {
      this._handlers = [];
    }
    return this;
  }
  
  listenerCount(event) {
    return this._handlers.filter(h => h.event === event).length;
  }
  
  listeners(event) {
    return this._handlers
      .filter(h => h.event === event)
      .map(h => h.handler);
  }
  
  eventNames() {
    return this._handlers.map(h => h.event);
  }
}

// ============================================================================
// BASE AD CLASS
// ============================================================================

class BaseAd {
  constructor() {
    this.isCapped = false;
    this.hasNoInventory = false;
  }
  
  show() {
    throw new Error('show() must be implemented by subclass');
  }
}

// ============================================================================
// ELEMENT TARGETING
// ============================================================================

class ElementTargeting {
  constructor(cssSelector, shouldTriggerOnTarget, zoneId) {
    this.targetElementsCssSelector = cssSelector;
    this.shouldTriggerPopOnTargetClick = shouldTriggerOnTarget;
    this.zoneId = zoneId;
  }
  
  isPresent() {
    return !!this.targetElementsCssSelector;
  }
  
  isActionAllowedOnElement(element) {
    // Check if element has zone ID attribute
    if (element.hasAttribute(DOM_ATTRIBUTES.ZONE_ID)) {
      return element.getAttribute(DOM_ATTRIBUTES.ZONE_ID) === this.zoneId;
    }
    
    // Check if element should be skipped
    if (element.hasAttribute(DOM_ATTRIBUTES.DO_SKIP)) {
      return false;
    }
    
    // Check if any parent has skip attribute
    const skipElements = Array.from(
      document.querySelectorAll(`[${DOM_ATTRIBUTES.DO_SKIP}*="1"]`)
    );
    
    for (const skipEl of skipElements) {
      if (skipEl.contains(element)) {
        return false;
      }
    }
    
    // If no targeting, allow all
    if (!this.isPresent()) {
      return true;
    }
    
    // Check if element matches target selector
    const isTarget = this._isTargetElement(element);
    return this.shouldTriggerPopOnTargetClick ? isTarget : !isTarget;
  }
  
  _isTargetElement(element) {
    const targets = document.querySelectorAll(this.targetElementsCssSelector);
    let current = element;
    
    do {
      for (let i = 0; i < targets.length; i++) {
        if (current === targets[i]) {
          return true;
        }
      }
    } while (current = current.parentNode);
    
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const Utils = {
  // Get current page URL
  getCurrentPageUrl() {
    let url = window.location.href;
    if (this.isInIframe()) {
      url = document.referrer;
    }
    return this.truncateUrl(url);
  },
  
  // Check if in iframe
  isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  },
  
  // Truncate URL
  truncateUrl(url) {
    let maxLength = Math.max(url.indexOf(' ', 256), url.indexOf(',', 256));
    if (maxLength > 384 || maxLength < 20) {
      maxLength = 256;
    }
    return url.substring(0, maxLength);
  },
  
  // Generate random ID
  generateRandomId() {
    if (typeof window.rgxngibqxq === 'undefined' || window.rgxngibqxq === '') {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
      const id = [];
      for (let i = 0; i < 32; i++) {
        id[i] = chars.substr(Math.floor(Math.random() * 16), 1);
      }
      id[14] = '4';
      id[19] = chars.substr((id[19] & 0x3) | 0x8, 1);
      window.rgxngibqxq = id.join('');
    }
    return window.rgxngibqxq;
  },
  
  // Get screen dimensions
  getScreenWidth() {
    return window.innerWidth || document.body.clientWidth;
  },
  
  getScreenHeight() {
    return window.innerHeight || document.body.clientHeight;
  },
  
  // Get page title
  getPageTitle() {
    let title = document.title;
    if (this.isInIframe()) {
      try {
        title = window.top.document.title;
      } catch (e) {
        title = '';
      }
    }
    return this.truncateUrl(title);
  },
  
  // Get referrer
  getReferrer() {
    let referrer = document.referrer;
    if (this.isInIframe()) {
      try {
        referrer = window.top.document.referrer;
      } catch (e) {
        referrer = '';
      }
    }
    return this.truncateUrl(referrer);
  },
  
  // Detect mobile
  isMobile() {
    const ua = navigator.userAgent;
    return /android|ipad|ipod|iphone|blackberry|iemobile|opera mini|ucbrowser|kindle|silk/i.test(ua);
  },
  
  // Random string generator
  randomString(chars, minLen = 1, maxLen = 15) {
    const length = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AdLogger,
    EventEmitter,
    BaseAd,
    ElementTargeting,
    Utils,
    AD_TYPES,
    STORAGE_KEYS,
    DOM_ATTRIBUTES
  };
}

console.log('✅ Ad System Deobfuscated');
console.log('This code handles ad serving, NOT stream extraction');
