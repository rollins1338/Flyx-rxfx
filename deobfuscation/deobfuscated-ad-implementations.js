/**
 * DEOBFUSCATED AD IMPLEMENTATIONS
 * Pop ads, Interstitials, and AutoTag system
 */

const { EventEmitter, BaseAd, AdLogger, ElementTargeting, Utils } = require('./deobfuscated-ad-system');

// ============================================================================
// INTERSTITIAL AD (class ne -> AtagInterstitial)
// ============================================================================

class AtagInterstitial extends BaseAd {
  constructor(config) {
    super();
    
    this.logger = new AdLogger(`atag_${config.collectiveZoneId}_interstitial_${config.zoneId}`);
    this.logger.debug('init atag interstitial with config:', config);
    
    this.zoneId = config.zoneId;
    this.isFullscreen = config.isFullscreen;
    this.adblockSettings = config.adblockSettings;
    this.collectiveZoneId = config.collectiveZoneId;
    this.aggressivity = config.aggressivity;
    this.recordPageView = config.recordPageView;
    this.adsCapping = config.adsCapping;
    this.abTest = config.abTest;
    this.actionCallback = config.actionCallback;
    this.adserverDomain = config.adserverDomain;
    this.adcashGlobal = window[config.adcashGlobalName];
    this.clientHintsQueryStr = config.clientHintsQueryStr;
    
    this.isConfigured = false;
    this.adPayload = null;
    this.renderer = null;
    this.retryDelay = 12; // seconds
    this.tagVersion = '71.1' + (config.tagVersionSuffix || '');
  }
  
  show(sequenceId) {
    const bidUrl = this._buildBidUrl(sequenceId);
    
    fetch(bidUrl)
      .then(response => {
        if (response.status === 200 || response.status === 202) {
          return response.json();
        }
        
        if (response.status === 204) {
          // No inventory
          this.hasNoInventory = true;
          this.logger.debug(`no inventory! reset after ${this.retryDelay} sec`);
          setTimeout(() => {
            this.hasNoInventory = false;
          }, this.retryDelay * 1000);
          
          // Exponential backoff
          if (this.retryDelay < 7200) {
            this.retryDelay *= 5;
          }
        }
        
        return Promise.reject();
      })
      .then(data => {
        this.logger.debug('response:', data);
        
        if (data.capped_ttl) {
          // Capped
          this.isCapped = true;
          this.logger.debug(`capped! reset after ${data.capped_ttl} sec`);
          setTimeout(() => {
            this.isCapped = false;
          }, data.capped_ttl * 1000);
          this.actionCallback('interstitial');
          return;
        }
        
        // Reset retry delay on success
        if (this.retryDelay > 12) {
          this.retryDelay = 12;
        }
        
        if (!this.isConfigured) {
          // First request - configure
          this.isConfigured = true;
          this._configure(data);
          this.adPayload = data.adPayload;
        } else {
          // Subsequent request
          this.adPayload = data;
        }
        
        // Add client hints to URLs
        if (this.clientHintsQueryStr) {
          this.adPayload.url += this.clientHintsQueryStr;
          this.adPayload.iurl += this.clientHintsQueryStr;
          if (this.adPayload.clickPixelUrl) {
            this.adPayload.clickPixelUrl += this.clientHintsQueryStr;
          }
        }
        
        // Wrap HTML if type 4
        if (this.adPayload.type === 4 && this.adPayload.html) {
          this.adPayload.html = `<!DOCTYPE html><html><head><meta name="referrer" content="no-referrer"></head><body>${this.adPayload.html}</body></html>`;
        }
        
        this._render();
      })
      .catch(error => {
        if (error) {
          this.logger.error(error);
        }
        this.actionCallback('interstitial');
      });
  }
  
  _configure(data) {
    this.config = {
      moveTimerInsideButtonAfter: data.moveTimerInsideButtonAfter,
      delay: data.delay,
      refreshRate: data.refreshRate,
      isOverlay: data.isOverlay,
      disableCountdown: data.disableCountdown,
      texts: data.texts,
      showOnInnerLinkClick: data.showOnInnerLinkClick
    };
  }
  
  _render() {
    this.logger.debug('render');
    // Renderer would create the actual interstitial UI
    // This is where the ad is displayed to the user
  }
  
  _buildBidUrl(sequenceId) {
    let url = `${window.location.protocol}//${this.adserverDomain}/script/interstitial.php`;
    
    url += `?r=${this.zoneId}`;
    
    if (this.isConfigured) {
      url += '&rbd=1'; // Request bid data
    }
    
    if (this.clientHintsQueryStr) {
      url += this.clientHintsQueryStr;
    }
    
    url += '&atag=1';
    url += `&czid=${this.collectiveZoneId}`;
    url += `&aggr=${this.aggressivity}`;
    url += `&seqid=${sequenceId}`;
    url += `&cbpage=${encodeURIComponent(Utils.getCurrentPageUrl())}`;
    url += `&atv=${this.tagVersion}`;
    url += `&cbref=${encodeURIComponent(Utils.getReferrer())}`;
    
    if (this.recordPageView) {
      url += '&ppv=1';
    }
    
    if (this.abTest) {
      url += `&ab_test=${this.abTest}`;
    }
    
    if (this.adsCapping === false) {
      url += '&cap=0';
    }
    
    this.logger.debug(`bid url: ${url}`);
    return url;
  }
}

// ============================================================================
// POP AD (class ce -> AtagPop)
// ============================================================================

class AtagPop extends BaseAd {
  constructor(config) {
    super();
    
    this.logger = new AdLogger(`atag_${config.collectiveZoneId}_suv5_${config.zoneId}`);
    this.logger.debug('init atag pop with config:', config);
    
    this.zoneId = config.zoneId;
    this.adserverDomain = config.adserverDomain;
    this.adblockSettings = config.adblockSettings;
    this.collectiveZoneId = config.collectiveZoneId;
    this.aggressivity = config.aggressivity;
    this.adsCapping = config.adsCapping;
    this.abTest = config.abTest;
    this.recordPageView = config.recordPageView;
    this.actionCallback = config.actionCallback;
    this.clientHintsQueryStr = config.clientHintsQueryStr;
    this.adcashGlobal = window[config.adcashGlobalName];
    
    this.elementTargeting = new ElementTargeting(
      config.targetElementsCssSelector,
      config.triggerOnTargetElementsClick,
      config.zoneId
    );
    
    this.adPayload = null;
    this.isConfigured = false;
    this.popWindow = null;
    this.retryDelay = 12;
    this.tagVersion = '71.1' + (config.tagVersionSuffix || '');
  }
  
  show() {
    const bidUrl = this._buildBidUrl();
    
    fetch(bidUrl)
      .then(response => {
        if (response.status === 200 || response.status === 202) {
          return response.json();
        }
        
        if (response.status === 204) {
          this.hasNoInventory = true;
          this.logger.debug(`no inventory! reset after ${this.retryDelay} sec`);
          setTimeout(() => {
            this.hasNoInventory = false;
          }, this.retryDelay * 1000);
          
          if (this.retryDelay < 7200) {
            this.retryDelay *= 5;
          }
        }
        
        return Promise.reject();
      })
      .then(data => {
        this.logger.debug('response:', data);
        
        if (data.capped_ttl) {
          this.isCapped = true;
          this.logger.debug(`capped! reset after ${data.capped_ttl} sec`);
          setTimeout(() => {
            this.isCapped = false;
          }, data.capped_ttl * 1000);
          this.actionCallback('pop');
          return;
        }
        
        if (this.retryDelay > 12) {
          this.retryDelay = 12;
        }
        
        if (!this.isConfigured) {
          this.isConfigured = true;
          const delay = data.delay || 0;
          this.logger.debug('delay is', delay);
          
          setTimeout(() => {
            this._configure(data);
          }, delay * 1000);
        } else {
          this._configure(data);
        }
      })
      .catch(error => {
        if (error) {
          this.logger.error(error);
        }
        this.actionCallback('pop');
      });
  }
  
  _configure(data) {
    this.adPayload = {
      url: this._processUrl(data.url),
      impressionUrl: data.iurl,
      refreshRate: data.refreshRate,
      delay: data.delay,
      type: data.type
    };
    
    // Setup click listeners
    this._setupClickListeners();
    
    this.logger.debug('ready to show ad');
  }
  
  _setupClickListeners() {
    // Attach event listeners to trigger pop on click
    document.addEventListener('click', (e) => {
      if (this.elementTargeting.isActionAllowedOnElement(e.target)) {
        this._triggerPop(e);
      }
    });
  }
  
  _triggerPop(event) {
    this.logger.debug('triggering pop');
    
    if (this.adPayload.type === 'tabswap') {
      this._doTabSwap();
    } else {
      this.popWindow = window.open(
        this.adPayload.url,
        '_blank',
        'noopener,noreferrer'
      );
      
      this._sendImpression();
    }
  }
  
  _doTabSwap() {
    this.logger.debug('do tabswap');
    this.actionCallback('tabswap');
    
    // Open current page in new tab
    this.popWindow = window.open(
      window.location.href,
      '_blank',
      'noreferrer'
    );
    
    // Navigate current tab to ad
    setTimeout(() => {
      window.location.href = this.adPayload.url;
    }, 50);
  }
  
  async _sendImpression() {
    const windowOpened = this.popWindow ? '1' : '0';
    let impUrl = this.adPayload.impressionUrl + `&wo=${windowOpened}`;
    
    if (window['utsid-send']) {
      impUrl += `&utsid=${window['utsid-send']}`;
    }
    
    impUrl += this.clientHintsQueryStr;
    impUrl += `&cbpage=${encodeURIComponent(Utils.getCurrentPageUrl())}`;
    impUrl += `&cbref=${encodeURIComponent(Utils.getReferrer())}`;
    
    this.logger.debug('send impression. url:', impUrl);
    
    try {
      await fetch(impUrl, { keepalive: true });
    } catch (e) {
      this.logger.error(e);
    }
  }
  
  _processUrl(url) {
    // Handle browser-specific URL formats
    const ua = navigator.userAgent;
    const isChrome = /chrome|crios/i.test(ua);
    const isFirefox = /firefox/i.test(ua);
    const version = parseInt((ua.match(/.+(?:ox|me|ra|ie|Edge)[\/: ]([\d.]+)/)||[])[1]);
    
    if ((isChrome && version < 59) || (isFirefox && version < 56)) {
      return `data:text/html;charset=utf-8, <html><meta http-equiv="refresh" content="0;URL=${url}"></html>`;
    }
    
    return url;
  }
  
  _buildBidUrl() {
    let url = `${window.location.protocol}//${this.adserverDomain}/script/suurl5.php`;
    
    url += `?r=${this.zoneId}`;
    
    if (this.isConfigured) {
      url += '&rbd=1';
    }
    
    url += this.clientHintsQueryStr;
    url += '&atag=1';
    url += `&cbur=${Math.random()}`;
    url += `&cbiframe=${Utils.isInIframe() ? 1 : 0}`;
    url += `&cbWidth=${Utils.getScreenWidth()}`;
    url += `&cbHeight=${Utils.getScreenHeight()}`;
    url += `&cbtitle=${encodeURIComponent(Utils.getPageTitle())}`;
    url += `&cbpage=${encodeURIComponent(Utils.getCurrentPageUrl())}`;
    url += `&cbref=${encodeURIComponent(Utils.getReferrer())}`;
    url += `&ts=${Date.now()}`;
    url += `&atv=${this.tagVersion}`;
    
    if (this.aggressivity) {
      url += `&aggr=${this.aggressivity}`;
    }
    
    if (this.collectiveZoneId) {
      url += `&czid=${this.collectiveZoneId}`;
    }
    
    if (this.recordPageView) {
      url += '&ppv=1';
    }
    
    if (this.abTest) {
      url += `&ab_test=${this.abTest}`;
    }
    
    if (this.adsCapping === false) {
      url += '&cap=0';
    }
    
    this.logger.debug(`bid url: ${url}`);
    return url;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AtagInterstitial,
    AtagPop
  };
}

console.log('✅ Ad Implementations Deobfuscated');
