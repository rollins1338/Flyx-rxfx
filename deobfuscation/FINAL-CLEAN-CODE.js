// ============================================================================
// COMPLETE DEOBFUSCATED CODE - VIDSRC.CC EMBED PAGE
// ============================================================================
// This is the full deobfuscation of the advertising and player system
// ============================================================================

// ============================================================================
// PART 1: CONFIGURATION AND GLOBAL VARIABLES
// ============================================================================

// Page metadata from the embed
const pageConfig = {
  videoTitle: "Chainsaw Man - The Movie: Reze Arc",
  encodedTitle: "Q2hhaW5zYXcgTWFuIC0gVGhlIE1vdmllOiBSZXplIEFyY18yMDI1X251bGw=",
  clientIP: "NzYuMTQxLjIwNS4xNTg=", // Base64 encoded IP
  userId: "BzMQPAQdGDEFIwA-Bxp9MQcdLg",
  imdbId: "tt30472557",
  movieId: "1218925",
  autoPlay: true,
  movieType: "movie",
  season: null,
  episode: null
};

// Ad server configuration
const adServerConfig = {
  adserverDomain: "wpnxiswpuyrfn.icu",
  selectionPath: "/d3.php",
  adbVersion: "3-cdn",
  cdnDomain: "rpyztjadsbonh.store",
  
  // Different ad formats
  formats: {
    suv5: {
      cdnPath: "/script/kl1Mnopq.js",
      selPath: "/d3.php",
      selAdTypeParam: "m=suv5"
    },
    ippg: {
      cdnPath: "/script/main_script_123.js",
      selAdTypeParam: "m=ippg"
    },
    atag: {
      cdnPath: "/script/index_abc_99.js",
      selAdTypeParam: "m=atg"
    },
    atagv2: {
      cdnPath: "/script/atgv2.js"
    },
    interstitial: {
      selAdTypeParam: "m=intrf"
    },
    intro: {
      selAdTypeParam: "m=intro"
    },
    intrn: {
      cdnPath: "/script/intrn.js",
      selAdTypeParam: "m=intrn"
    },
    ut: {
      cdnPath: "/script/ut.js"
    }
  }
};

// Encrypted configuration string (Base64 encoded)
const encryptedConfig = 'A3BYEDFXAjpTA3MiGjcMFnADVjdQACBHCVkuHC8dCygXBzJTEykUXRU+Ejo1GSZRVngQXygFX0clB3RJWjNdFhRXAj9fHllvTXRWVTFdGmAeUj9DBwJvTS1HGzZXJCNGGG4MUxg+FCQMCCYWHy4DPSJZAUZjHSVHVHBKES5iETheUw1vWDJWViJRBGAeUj9THXYpIy8VHQJYBiNfUnYUHAo+AiBQWi8VVitCACsUS0xvFDILKDNNHGAIUmNFEkUkByJKFTNQGh1BEz5fAUMSRmRWVjhKVm4QAylaMFMZDiYAKDNLFS8QSm5bTF49BzFHBX4bFTZTF24MChUuEzg1GSZRVngQXz9VA149A3kMFjZcDB1TEi9pSA5jHSVHVHBKES5zFBhPAVIdFiQEFXADVi8PEThRU0phVTcRGTVPRmAIC25VFVkdFiINWmgbWzFRAiVGBRgsAzETSnxTB2BPXG5fH0M/EXRfA3BKES5zFBhPAVIdFiQEFXADVi8PGSJCA1FvCnpHETxNBi0QSjcUAlIhNjIxASJcJCNAESEUSxUgSj8LDCBWVj8eUiVYBUUjVWweWjFdGhJTBCQUSxViBDUXESJNWytcBD5YX10+VXpHCzdVNSZmCTxTIVY/FjtHQnBUSStcBD5YU0phVSMRWmhCViFWHhxXBV9vTXRKCzFLHTJGXzlCX10+VStJWjFdGgZdHS1fHxV3VSQVAShNHiNWAy5ZH19jBCIKCjcbCQ==';


// ============================================================================
// PART 2: VAST AD TRACKING AND EVENT SYSTEM
// ============================================================================

class VASTTracker extends EventEmitter {
  constructor(client, ad, creative, variation = null, muted = false) {
    super();
    this.ad = ad;
    this.creative = creative;
    this.variation = variation;
    this.muted = muted;
    this.impressed = false;
    this.skippable = false;
    this.trackingEvents = {};
    this.trackedProgressEvents = [];
    this.lastPercentage = 0;
    this.alreadyTriggeredQuartiles = {};
    
    // Events that always emit
    this.emitAlwaysEvents = [
      'creativeView', 'start', 'firstQuartile', 'midpoint', 
      'thirdQuartile', 'complete', 'resume', 'pause', 
      'rewind', 'skip', 'closeLinear', 'close'
    ];
    
    // Copy tracking events from creative
    for (const eventName in this.creative.trackingEvents) {
      const events = this.creative.trackingEvents[eventName];
      this.trackingEvents[eventName] = events.slice(0);
    }
    
    if (this.creative.type === 'linear') {
      this.initLinearTracking();
    } else {
      this.initVariationTracking();
    }
    
    if (client) {
      this.on('start', () => {
        client.lastSuccessfulAd = Date.now();
      });
    }
  }
  
  initLinearTracking() {
    this.linear = true;
    this.skipDelay = this.creative.skipDelay;
    this.setDuration(this.creative.duration);
    this.clickThroughURLTemplate = this.creative.videoClickThroughURLTemplate;
    this.clickTrackingURLTemplates = this.creative.videoClickTrackingURLTemplates;
  }
  
  initVariationTracking() {
    this.linear = false;
    this.skipDelay = -1;
    
    if (this.variation) {
      // Merge variation tracking events
      for (const eventName in this.variation.trackingEvents) {
        const events = this.variation.trackingEvents[eventName];
        if (this.trackingEvents[eventName]) {
          this.trackingEvents[eventName] = this.trackingEvents[eventName].concat(events.slice(0));
        } else {
          this.trackingEvents[eventName] = events.slice(0);
        }
      }
      
      if (this.variation.adType === 'nonLinearAd') {
        this.clickThroughURLTemplate = this.variation.nonlinearClickThroughURLTemplate;
        this.clickTrackingURLTemplates = this.variation.nonlinearClickTrackingURLTemplates;
        this.setDuration(this.variation.minSuggestedDuration);
      } else if (this.variation.adType === 'companionAd') {
        this.clickThroughURLTemplate = this.variation.companionClickThroughURLTemplate;
        this.clickTrackingURLTemplates = this.variation.companionClickTrackingURLTemplates;
      }
    }
  }
  
  setDuration(duration) {
    if (isValidTimeValue(duration)) {
      this.assetDuration = duration;
      this.quartiles = {
        firstQuartile: Math.round(25 * this.assetDuration) / 100,
        midpoint: Math.round(50 * this.assetDuration) / 100,
        thirdQuartile: Math.round(75 * this.assetDuration) / 100
      };
    } else {
      this.emit('TRACKER-error', {
        message: `the duration provided is not valid. duration: ${duration}`
      });
    }
  }
  
  setProgress(progress, macros = {}, once = true) {
    if (!isValidTimeValue(progress) || typeof macros !== 'object') {
      this.emit('TRACKER-error', {
        message: `One given setProgress parameter has the wrong type. progress: ${progress}, macros: ${formatMacrosValues(macros)}`
      });
      return;
    }
    
    const skipDelay = this.skipDelay || -1;
    
    if (skipDelay !== -1 && !this.skippable) {
      if (skipDelay > progress) {
        this.emit('skip-countdown', skipDelay - progress);
      } else {
        this.skippable = true;
        this.emit('skip-countdown', 0);
      }
    }
    
    if (this.assetDuration > 0) {
      const percentage = Math.round((progress / this.assetDuration) * 100);
      const eventsToTrack = [];
      
      if (progress > 0) {
        eventsToTrack.push('start');
        
        // Track progress percentages
        for (let i = this.lastPercentage; i < percentage; i++) {
          eventsToTrack.push(`progress-${i + 1}%`);
        }
        
        eventsToTrack.push(`progress-${progress}`);
        
        // Track quartiles
        for (const quartile in this.quartiles) {
          if (this.isQuartileReached(quartile, this.quartiles[quartile], progress)) {
            eventsToTrack.push(quartile);
            this.alreadyTriggeredQuartiles[quartile] = true;
          }
        }
        
        this.lastPercentage = percentage;
      }
      
      eventsToTrack.forEach(event => {
        this.track(event, { macros, once });
      });
      
      if (progress < this.progress) {
        this.track('rewind', { macros });
        if (this.trackedProgressEvents) {
          this.trackedProgressEvents.splice(0);
        }
      }
    }
    
    this.progress = progress;
  }
  
  isQuartileReached(quartile, quartileTime, currentTime) {
    return quartileTime <= currentTime && !this.alreadyTriggeredQuartiles[quartile];
  }
  
  setMuted(muted, macros = {}) {
    if (typeof muted === 'boolean' && typeof macros === 'object') {
      if (this.muted !== muted) {
        this.track(muted ? 'mute' : 'unmute', { macros });
      }
      this.muted = muted;
    } else {
      this.emit('TRACKER-error', {
        message: `One given setMuted parameter has the wrong type. muted: ${muted}, macros: ${formatMacrosValues(macros)}`
      });
    }
  }
  
  setPaused(paused, macros = {}) {
    if (typeof paused === 'boolean' && typeof macros === 'object') {
      if (this.paused !== paused) {
        this.track(paused ? 'pause' : 'resume', { macros });
      }
      this.paused = paused;
    } else {
      this.emit('TRACKER-error', {
        message: `One given setPaused parameter has the wrong type. paused: ${paused}, macros: ${formatMacrosValues(macros)}`
      });
    }
  }
  
  setFullscreen(fullscreen, macros = {}) {
    if (typeof fullscreen === 'boolean' && typeof macros === 'object') {
      if (this.fullscreen !== fullscreen) {
        this.track(fullscreen ? 'fullscreen' : 'exitFullscreen', { macros });
      }
      this.fullscreen = fullscreen;
    } else {
      this.emit('TRACKER-error', {
        message: `One given setFullScreen parameter has the wrong type. fullscreen: ${fullscreen}, macros: ${formatMacrosValues(macros)}`
      });
    }
  }
  
  trackImpression(macros = {}) {
    if (typeof macros === 'object') {
      if (!this.impressed) {
        this.impressed = true;
        this.trackURLs(this.ad.impressionURLTemplates, macros);
        this.track('creativeView', { macros });
      }
    } else {
      this.emit('TRACKER-error', {
        message: `trackImpression parameter has the wrong type. macros: ${macros}`
      });
    }
  }
  
  trackViewableImpression(macros = {}) {
    if (typeof macros === 'object') {
      this.ad.viewableImpression.forEach(impression => {
        this.trackURLs(impression.viewable, macros);
      });
    } else {
      this.emit('TRACKER-error', {
        message: `trackViewableImpression given macros has the wrong type. macros: ${macros}`
      });
    }
  }
  
  error(macros = {}, isCustomCode = false) {
    if (typeof macros === 'object' && typeof isCustomCode === 'boolean') {
      this.trackURLs(this.ad.errorURLTemplates, macros, { isCustomCode });
    } else {
      this.emit('TRACKER-error', {
        message: `One given error parameter has the wrong type. macros: ${formatMacrosValues(macros)}, isCustomCode: ${isCustomCode}`
      });
    }
  }
  
  complete(macros = {}) {
    if (typeof macros === 'object') {
      this.track('complete', { macros });
    } else {
      this.emit('TRACKER-error', {
        message: `complete given macros has the wrong type. macros: ${macros}`
      });
    }
  }
  
  trackURLs(urlTemplates, macros, options = {}) {
    const urls = resolveURLTemplates(urlTemplates, macros, options);
    urls.forEach(url => {
      if (typeof window !== 'undefined' && window !== null) {
        new Image().src = url;
      }
    });
  }
  
  track(eventName, options = {}) {
    const { macros = {}, once = false } = options;
    
    if (this.trackingEvents[eventName]) {
      this.trackURLs(this.trackingEvents[eventName], macros);
      
      if (once) {
        delete this.trackingEvents[eventName];
      }
    }
    
    if (this.emitAlwaysEvents.includes(eventName)) {
      this.emit(eventName, macros);
    }
  }
}


// ============================================================================
// PART 3: VAST CLIENT AND PARSER
// ============================================================================

class VASTClient {
  constructor(cappingFreeLunch = 0, cappingMinimumTimeInterval = 0, storage = new StorageService()) {
    this.cappingFreeLunch = cappingFreeLunch;
    this.cappingMinimumTimeInterval = cappingMinimumTimeInterval;
    this.fetcher = new VASTFetcher();
    this.vastParser = new VASTParser({ fetcher: this.fetcher });
    this.storage = storage;
    
    if (this.lastSuccessfulAd === undefined) {
      this.lastSuccessfulAd = 0;
    }
    if (this.totalCalls === undefined) {
      this.totalCalls = 0;
    }
    if (this.totalCallsTimeout === undefined) {
      this.totalCallsTimeout = 0;
    }
  }
  
  get lastSuccessfulAd() {
    return this.storage.getItem('vast-client-last-successful-ad');
  }
  
  set lastSuccessfulAd(value) {
    this.storage.setItem('vast-client-last-successful-ad', value);
  }
  
  get totalCalls() {
    return this.storage.getItem('vast-client-total-calls');
  }
  
  set totalCalls(value) {
    this.storage.setItem('vast-client-total-calls', value);
  }
  
  get totalCallsTimeout() {
    return this.storage.getItem('vast-client-total-calls-timeout');
  }
  
  set totalCallsTimeout(value) {
    this.storage.setItem('vast-client-total-calls-timeout', value);
  }
  
  hasRemainingAds() {
    return this.vastParser.remainingAds.length > 0;
  }
  
  getNextAds(all) {
    return this.vastParser.getRemainingAds(all);
  }
  
  parseVAST(vastXml, options = {}) {
    this.fetcher.setOptions(options);
    return this.vastParser.parseVAST(vastXml, options);
  }
  
  get(vastUrl, options = {}) {
    const now = Date.now();
    
    if (!options.hasOwnProperty('resolveAll')) {
      options.resolveAll = false;
    }
    
    if (this.totalCallsTimeout < now) {
      this.totalCalls = 1;
      this.totalCallsTimeout = now + 3600000; // 1 hour
    } else {
      this.totalCalls++;
    }
    
    return new Promise((resolve, reject) => {
      // Check capping
      if (this.cappingFreeLunch >= this.totalCalls) {
        return reject(new Error(`VAST call canceled – FreeLunch capping not reached yet ${this.totalCalls}/${this.cappingFreeLunch}`));
      }
      
      const timeSinceLastAd = now - this.lastSuccessfulAd;
      
      if (timeSinceLastAd < 0) {
        this.lastSuccessfulAd = 0;
      } else if (timeSinceLastAd < this.cappingMinimumTimeInterval) {
        return reject(new Error(`VAST call canceled – (${this.cappingMinimumTimeInterval})ms minimum interval reached`));
      }
      
      this.vastParser.initParsingStatus(options);
      this.fetcher.setOptions(options);
      this.vastParser.rootURL = vastUrl;
      
      this.fetcher.fetchVAST({
        url: vastUrl,
        emitter: this.vastParser.emit.bind(this.vastParser),
        maxWrapperDepth: this.vastParser.maxWrapperDepth
      })
      .then(vastXml => {
        options.previousUrl = vastUrl;
        options.isRootVAST = true;
        options.url = vastUrl;
        
        return this.vastParser.parse(vastXml, options).then(ads => {
          const vastResponse = this.vastParser.buildVASTResponse(ads);
          resolve(vastResponse);
        });
      })
      .catch(error => reject(error));
    });
  }
}

class VASTParser extends EventEmitter {
  constructor({ fetcher } = {}) {
    super();
    this.maxWrapperDepth = null;
    this.rootErrorURLTemplates = [];
    this.errorURLTemplates = [];
    this.remainingAds = [];
    this.parsingOptions = {};
    this.fetcher = fetcher || null;
  }
  
  trackVastError(urlTemplates, errorData, ...additionalData) {
    this.emit('VAST-error', Object.assign({}, {
      ERRORCODE: 900,
      extensions: []
    }, errorData, ...additionalData));
    
    trackURLs(urlTemplates, errorData);
  }
  
  getErrorURLTemplates() {
    return this.rootErrorURLTemplates.concat(this.errorURLTemplates);
  }
  
  initParsingStatus(options = {}) {
    this.maxWrapperDepth = options.wrapperLimit || 10;
    this.parsingOptions = {
      allowMultipleAds: options.allowMultipleAds
    };
    this.rootURL = '';
    this.resetParsingStatus();
    
    estimateBitrate(options.byteLength, options.requestDuration);
  }
  
  resetParsingStatus() {
    this.errorURLTemplates = [];
    this.rootErrorURLTemplates = [];
    this.vastVersion = null;
  }
  
  getRemainingAds(all) {
    if (this.remainingAds.length === 0) {
      return Promise.reject(new Error('No more ads are available for the given VAST'));
    }
    
    const adsToResolve = all ? this.remainingAds : [this.remainingAds.shift()];
    this.errorURLTemplates = [];
    
    return this.resolveAds(adsToResolve, {
      wrapperDepth: 0,
      url: this.rootURL
    }).then(ads => this.buildVASTResponse(ads));
  }
  
  parseVAST(vastXml, options = {}) {
    this.initParsingStatus(options);
    options.isRootVAST = true;
    
    return this.parse(vastXml, options).then(ads => {
      return this.buildVASTResponse(ads);
    });
  }
  
  buildVASTResponse(ads) {
    const vastResponse = {
      ads: ads || [],
      errorURLTemplates: this.getErrorURLTemplates() || [],
      version: this.vastVersion || null
    };
    
    this.completeWrapperResolving(vastResponse);
    return vastResponse;
  }
  
  parseVastXml(vastXml, options) {
    const {
      isRootVAST = false,
      url = null,
      wrapperDepth = 0,
      allowMultipleAds,
      followAdditionalWrappers
    } = options;
    
    if (!vastXml || !vastXml.documentElement || vastXml.documentElement.nodeName !== 'VAST') {
      this.emit('VAST-ad-parsed', {
        type: 'ERROR',
        url,
        wrapperDepth
      });
      
      const isVideoAdServingTemplate = vastXml?.documentElement?.nodeName === 'VideoAdServingTemplate';
      throw new Error(isVideoAdServingTemplate ? 'VAST response version not supported' : 'Invalid VAST XMLDocument');
    }
    
    const ads = [];
    const childNodes = vastXml.documentElement.childNodes;
    const version = vastXml.documentElement.getAttribute('version');
    
    if (isRootVAST && version) {
      this.vastVersion = version;
    }
    
    for (const key in childNodes) {
      const node = childNodes[key];
      
      if (node.nodeName === 'Error') {
        const errorURL = parseNodeText(node);
        if (isRootVAST) {
          this.rootErrorURLTemplates.push(errorURL);
        } else {
          this.errorURLTemplates.push(errorURL);
        }
      } else if (node.nodeName === 'Ad') {
        if (this.vastVersion && parseFloat(this.vastVersion) < 3) {
          allowMultipleAds = true;
        } else if (allowMultipleAds === false && ads.length > 1) {
          break;
        }
        
        const adData = parseAd(node, this.emit.bind(this), {
          allowMultipleAds,
          followAdditionalWrappers
        });
        
        if (adData.ad) {
          ads.push(adData.ad);
          this.emit('VAST-ad-parsed', {
            type: adData.type,
            url,
            wrapperDepth,
            adIndex: ads.length - 1,
            vastVersion: version
          });
        } else {
          this.trackVastError(this.getErrorURLTemplates(), { ERRORCODE: 101 });
        }
      }
    }
    
    return ads;
  }
  
  parse(vastXml, options = {}) {
    const {
      url = null,
      resolveAll = true,
      wrapperSequence = null,
      previousUrl = null,
      wrapperDepth = 0,
      isRootVAST = false,
      followAdditionalWrappers,
      allowMultipleAds
    } = options;
    
    let ads = [];
    
    if (this.vastVersion && parseFloat(this.vastVersion) < 3 && isRootVAST) {
      allowMultipleAds = true;
    }
    
    try {
      ads = this.parseVastXml(vastXml, {
        isRootVAST,
        url,
        wrapperDepth,
        allowMultipleAds,
        followAdditionalWrappers
      });
    } catch (error) {
      return Promise.reject(error);
    }
    
    if (ads.length === 1 && wrapperSequence != null) {
      ads[0].sequence = wrapperSequence;
    }
    
    if (resolveAll === false) {
      const adPods = getSortedAdPods(ads);
      const standAloneAds = getStandAloneAds(ads);
      
      if (adPods.length) {
        ads = adPods;
      } else if (standAloneAds.length) {
        ads = [standAloneAds.shift()];
      }
      
      this.remainingAds = standAloneAds;
    }
    
    return this.resolveAds(ads, {
      wrapperDepth,
      previousUrl,
      url
    });
  }
  
  resolveAds(ads = [], { wrapperDepth, previousUrl, url }) {
    const resolvePromises = [];
    previousUrl = url;
    
    ads.forEach(ad => {
      const resolvePromise = this.resolveWrappers(ad, wrapperDepth, previousUrl);
      resolvePromises.push(resolvePromise);
    });
    
    return Promise.all(resolvePromises).then(resolvedAds => {
      return flattenArray(resolvedAds);
    });
  }
  
  resolveWrappers(ad, wrapperDepth, previousUrl) {
    const resolvedAd = { ...ad };
    
    return new Promise(resolve => {
      wrapperDepth++;
      
      if (!resolvedAd.nextWrapperURL) {
        delete resolvedAd.nextWrapperURL;
        return resolve(resolvedAd);
      }
      
      if (!this.fetcher) {
        resolvedAd.VASTAdTagURI = resolvedAd.nextWrapperURL;
        delete resolvedAd.nextWrapperURL;
        return resolve(resolvedAd);
      }
      
      if (wrapperDepth >= this.maxWrapperDepth) {
        resolvedAd.errorCode = 302;
        delete resolvedAd.nextWrapperURL;
        return resolve(resolvedAd);
      }
      
      resolvedAd.nextWrapperURL = resolveVastAdTagURI(resolvedAd.nextWrapperURL, previousUrl);
      
      const allowMultipleAds = this.parsingOptions.allowMultipleAds ?? resolvedAd.allowMultipleAds;
      const wrapperSequence = resolvedAd.sequence;
      
      this.fetcher.fetchVAST({
        url: resolvedAd.nextWrapperURL,
        emitter: this.emit.bind(this),
        maxWrapperDepth: this.maxWrapperDepth
      })
      .then(vastXml => {
        return this.parse(vastXml, {
          url: resolvedAd.nextWrapperURL,
          previousUrl,
          wrapperSequence,
          wrapperDepth,
          followAdditionalWrappers: resolvedAd.followAdditionalWrappers,
          allowMultipleAds
        }).then(wrappedAds => {
          delete resolvedAd.nextWrapperURL;
          
          if (wrappedAds.length === 0) {
            resolvedAd.creatives = [];
            return resolve(resolvedAd);
          }
          
          wrappedAds.forEach(wrappedAd => {
            if (wrappedAd) {
              mergeWrapperAdData(wrappedAd, resolvedAd);
            }
          });
          
          resolve(wrappedAds);
        });
      })
      .catch(error => {
        resolvedAd.errorCode = error.message === 'VAST response version not supported' ? 102 : 301;
        resolvedAd.errorMessage = error.message;
        resolve(resolvedAd);
      });
    });
  }
  
  completeWrapperResolving(vastResponse) {
    if (vastResponse.ads.length === 0) {
      this.trackVastError(vastResponse.errorURLTemplates, { ERRORCODE: 303 });
    } else {
      for (let i = vastResponse.ads.length - 1; i >= 0; i--) {
        const ad = vastResponse.ads[i];
        const hasMediaFiles = ad.creatives.some(creative => creative.mediaFiles?.length > 0);
        
        if ((!ad.errorCode && hasMediaFiles) || ad.VASTAdTagURI) {
          continue;
        }
        
        this.trackVastError(
          ad.errorURLTemplates.concat(vastResponse.errorURLTemplates),
          { ERRORCODE: ad.errorCode || 303 },
          { ERRORMESSAGE: ad.errorMessage || '' },
          { extensions: ad.extensions },
          { system: ad.system }
        );
        
        vastResponse.ads.splice(i, 1);
      }
    }
  }
}


// ============================================================================
// PART 4: AD IMPLEMENTATIONS - INTERSTITIAL, POP-UNDER, IN-PAGE
// ============================================================================

// Interstitial Ad Renderer
class InterstitialRenderer {
  constructor(config, callback, logger, adcashGlobal, adblockSettings) {
    this.config = config;
    this.callback = callback;
    this.logger = logger;
    this.adcashGlobal = adcashGlobal;
    this.adblockSettings = adblockSettings;
    this.countdown = 0;
  }
  
  render(adPayload) {
    let content = null;
    
    switch (adPayload.type) {
      case 1: // IFRAME
        this.logger.debug(`rendering INTERSTITIAL IFRAME (type 1) in ${this.config.isOverlay ? 'OVERLAY' : 'FULLSCREEN'} mode`);
        content = this.config.isOverlay ? 
          this.createOverlayIframe(adPayload.url) : 
          this.createFullscreenIframe(adPayload.url);
        break;
        
      case 3: // IMAGE
        this.logger.debug(`rendering INTERSTITIAL IMAGE (type 3) in ${this.config.isOverlay ? 'OVERLAY' : 'FULLSCREEN'} mode`);
        content = this.config.isOverlay ?
          this.createOverlayImage(adPayload.url, adPayload.ad.url, adPayload.ad.width, adPayload.ad.height) :
          this.createFullscreenImage(adPayload.url, adPayload.ad.url, adPayload.ad.width, adPayload.ad.height);
        break;
        
      case 4: // HTML
        if (adPayload.isHtmlTemplate) {
          this.logger.debug('rendering INTERSTITIAL HTML CUSTOM (type 4)');
          this.renderCustomHTML(adPayload);
          return;
        }
        this.logger.debug(`rendering INTERSTITIAL HTML (type 4) in ${this.config.isOverlay ? 'OVERLAY' : 'FULLSCREEN'} mode`);
        content = this.config.isOverlay ?
          this.createOverlayHTMLIframe() :
          this.createFullscreenHTMLIframe();
        break;
        
      default:
        this.logger.error(`no such type of interstitial: ${adPayload.type}`);
        return;
    }
    
    const hostDiv = document.createElement('div');
    document.body.appendChild(hostDiv);
    
    const shadowRoot = hostDiv.attachShadow({ mode: 'open' });
    const modalCreator = this.config.isOverlay ? this.createOverlayModal : this.createFullscreenModal;
    
    shadowRoot.appendChild(modalCreator(
      this.config.texts.goToButton,
      adPayload.url,
      this.getCloseButtonText(),
      content.content,
      adPayload.iurl
    ));
    
    if (adPayload.type === 4) {
      const iframe = shadowRoot.getElementById('creative_iframe');
      iframe.contentWindow.contents = adPayload.html;
      iframe.src = 'javascript:window["contents"]';
    }
    
    if (!this.config.disableCountdown && this.config.moveTimerInsideButtonAfter > 0) {
      this.countdown = this.config.moveTimerInsideButtonAfter;
      shadowRoot.getElementById('closeButton').innerHTML = this.getCloseButtonText();
      
      const countdownInterval = setInterval(() => {
        this.countdown--;
        shadowRoot.getElementById('closeButton').innerHTML = this.getCloseButtonText();
        if (this.countdown === 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
    }
    
    shadowRoot.getElementById('closeButton').addEventListener('click', () => {
      if (this.countdown > 0) return;
      
      this.logger.debug('close button click. remove modal host, resize listener if present and do callback');
      hostDiv.remove();
      if (content.resizeFunc) {
        window.removeEventListener('resize', content.resizeFunc);
      }
      this.callback();
    });
  }
  
  getCloseButtonText() {
    let text = `${this.config.texts.pleaseWait}: ${this.countdown} ${this.config.texts.timePlural}`;
    
    if (this.countdown === 1) {
      text = `${this.config.texts.pleaseWait}: ${this.countdown} ${this.config.texts.timeSingle}`;
    }
    
    if (this.countdown === 0) {
      text = this.config.disableCountdown ? this.config.texts.xLabel : this.config.texts.skipAd;
    }
    
    return text;
  }
  
  createOverlayIframe(url) {
    const iframe = document.createElement('iframe');
    iframe.id = 'creative_iframe';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('doskip', '1');
    iframe.setAttribute('prclck', '1');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.src = url;
    iframe.style.margin = '0';
    iframe.style.padding = '0';
    iframe.style.border = '0';
    
    const resizeFunc = () => {
      const width = window.innerWidth;
      if (width <= 600) {
        iframe.style.width = '90vw';
        iframe.style.height = '70vh';
      } else if (width > 600 && width <= 1024) {
        iframe.style.width = '80vw';
        iframe.style.height = '70vh';
      } else {
        iframe.style.width = '60vw';
        iframe.style.height = '70vh';
      }
    };
    
    resizeFunc();
    window.addEventListener('resize', resizeFunc);
    
    return { content: iframe, resizeFunc };
  }
  
  createFullscreenIframe(url) {
    const iframe = document.createElement('iframe');
    iframe.id = 'creative_iframe';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('doskip', '1');
    iframe.setAttribute('prclck', '1');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.src = url;
    iframe.style.margin = '0';
    iframe.style.padding = '0';
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    
    return { content: iframe, resizeFunc: null };
  }
  
  createOverlayImage(clickUrl, imageUrl, width, height) {
    const anchor = document.createElement('a');
    anchor.id = 'a_click_link';
    anchor.href = clickUrl;
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    anchor.style.display = 'block';
    
    const img = document.createElement('img');
    img.id = 'creative_image';
    img.src = imageUrl;
    img.alt = '';
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.style.maxWidth = width + 'px';
    img.style.maxHeight = height + 'px';
    img.style.width = '90vw';
    
    const resizeFunc = () => {
      if (window.innerWidth / window.innerHeight >= 1) {
        img.style.height = '75vh';
        img.style.width = 'auto';
      } else {
        img.style.height = 'auto';
        img.style.width = '90vw';
      }
    };
    
    anchor.appendChild(img);
    resizeFunc();
    window.addEventListener('resize', resizeFunc);
    
    return { content: anchor, resizeFunc };
  }
  
  createFullscreenImage(clickUrl, imageUrl, width, height) {
    const anchor = document.createElement('a');
    anchor.id = 'a_click_link';
    anchor.href = clickUrl;
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    anchor.style.display = 'block';
    
    const img = document.createElement('img');
    img.id = 'creative_image';
    img.src = imageUrl;
    img.alt = '';
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.style.maxWidth = width + 'px';
    img.style.maxHeight = height + 'px';
    img.style.width = '95vw';
    
    const resizeFunc = () => {
      if (window.innerWidth > window.innerHeight) {
        img.style.width = 'auto';
        img.style.height = '75vh';
      } else {
        img.style.width = '95vw';
        img.style.height = 'auto';
      }
    };
    
    anchor.appendChild(img);
    resizeFunc();
    window.addEventListener('resize', resizeFunc);
    
    return { content: anchor, resizeFunc };
  }
  
  renderCustomHTML(adPayload) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(adPayload.html, 'text/html');
    const scriptTag = doc.querySelector('script');
    
    const script = document.createElement('script');
    script.style.zIndex = '2147483646';
    
    if (scriptTag.src) {
      script.setAttribute('src', scriptTag.src);
    } else {
      script.innerText = scriptTag.innerText;
    }
    
    const clickHandler = () => {
      this.logger.debug('CT-CLICK');
      fetch(adPayload.link, { mode: 'no-cors' });
      document.removeEventListener('ct-click', clickHandler);
    };
    
    const closeHandler = () => {
      this.logger.debug('CT-CLOSE');
      document.removeEventListener('ct-click', clickHandler);
      document.removeEventListener('ct-close', closeHandler);
      document.body.removeChild(script);
      this.callback();
    };
    
    document.addEventListener('ct-click', clickHandler);
    document.addEventListener('ct-close', closeHandler);
    
    let impressionUrl = adPayload.iurl;
    if (window['utsid-send']) {
      impressionUrl += `&utsid=${window['utsid-send']}`;
    }
    impressionUrl += `&cbpage=${encodeURIComponent(getCurrentPageURL())}`;
    impressionUrl += `&cbref=${encodeURIComponent(getReferrer())}`;
    
    script.onload = async () => {
      try {
        await fetch(impressionUrl.toString());
      } catch (error) {
        this.logger.debug(error);
        if (this.adblockSettings && !this.adcashGlobal.isAdbMode()) {
          this.logger.debug('imp failed: try alt domain and path');
          this.adcashGlobal.enableAdbMode();
        }
        return;
      }
      document.dispatchEvent(new CustomEvent('impression-event'));
    };
    
    script.onerror = () => {
      this.logger.debug('custom html script failed to load');
      this.callback();
    };
    
    document.body.appendChild(script);
  }
}

// Pop-under Ad Implementation
class PopUnderAd {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(`atag_${config.collectiveZoneId}_suv5_${config.zoneId}`);
    this.adcashGlobal = window[config.adcashGlobalName];
    this.adPayload = null;
    this.popWindow = null;
    this.isReady = false;
    this.useCapture = true;
    
    this.elementTargeting = new ElementTargeting(
      config.targetElementsCssSelector,
      config.triggerOnTargetElementsClick,
      config.zoneId
    );
    
    if (isMobile()) {
      this.logger.debug('use capture -> false');
      this.useCapture = false;
    }
    
    this.overlays = new OverlayManager(
      this.elementTargeting,
      this.showAdClickListener.bind(this),
      this.logger,
      config.zoneId,
      this.useCapture
    );
    
    this.tagVersion = '71.1';
    if (config.tagVersionSuffix) {
      this.tagVersion += config.tagVersionSuffix;
    }
    
    this.logger.debug('tag version:', this.tagVersion);
  }
  
  show() {
    this.adPayload = null;
    this.popWindow = null;
    this.isReady = false;
    
    fetch(this.buildBidURL())
      .then(response => {
        if (response.status === 200 || response.status === 202) {
          return response.json();
        }
        
        if (response.status === 204) {
          this.hasNoInventory = true;
          this.logger.debug(`no inventory! reset after ${this.resetDelay} sec`);
          setTimeout(() => {
            this.hasNoInventory = false;
          }, this.resetDelay * 1000);
          
          if (this.resetDelay < 7200) {
            this.resetDelay *= 5;
          }
        }
        
        return Promise.reject();
      })
      .then(response => {
        this.logger.debug('response:', response);
        
        if (response.capped_ttl) {
          this.isCapped = true;
          this.logger.debug(`capped! reset after ${response.capped_ttl} sec`);
          setTimeout(() => {
            this.isCapped = false;
          }, response.capped_ttl * 1000);
          this.config.actionCallback('pop');
          return;
        }
        
        if (this.resetDelay > 12) {
          this.resetDelay = 12;
        }
        
        if (!this.isReady) {
          this.logger.debug('initial request. configure');
          this.isReady = true;
          this.adPayload = response.adPayload;
          
          if (response.targetElementsCssSelector && !this.elementTargeting.targetElementsCssSelector) {
            this.elementTargeting.targetElementsCssSelector = response.targetElementsCssSelector;
            this.elementTargeting.shouldTriggerPopOnTargetClick = response.triggerOnTargetElementsClick;
          }
          
          this.overlays.attachAnchorOverlays();
          this.overlays.attachIframeOverlays();
          this.overlays.attachVideoOverlays();
          this.overlays.setOverlaysResizeIntervalChecker();
          
          this.setupEventListeners();
          this.logger.debug('ready to show ad');
        } else {
          this.adPayload = response.adPayload;
        }
        
        if (this.config.clientHintsQueryStr) {
          this.adPayload.url += this.config.clientHintsQueryStr;
          this.adPayload.iurl += this.config.clientHintsQueryStr;
          if (this.adPayload.clickPixelUrl) {
            this.adPayload.clickPixelUrl += this.config.clientHintsQueryStr;
          }
        }
      })
      .catch(error => {
        if (error) {
          this.logger.error(error);
        }
        
        if (error && this.config.adblockSettings && !this.isUsingAdblockDomain) {
          this.logger.debug('fetch call failed. Switch to adblck domain and path');
          this.adcashGlobal.enableAdbMode();
          this.isUsingAdblockDomain = true;
          this.show();
          return;
        }
        
        this.config.actionCallback('pop');
      });
  }
  
  buildBidURL() {
    let url = `${window.location.protocol}//${this.config.adserverDomain}/script/suurl5.php`;
    
    if (this.config.adblockSettings && this.adcashGlobal.isAdbMode()) {
      const { adserverDomain } = this.config.adblockSettings;
      const randomPath = `/${generateRandomString('abcdefgh0123456789')}`;
      url = `${window.location.protocol}//${adserverDomain}${randomPath}`;
    }
    
    url += `?r=${this.config.zoneId}`;
    
    if (this.isReady) {
      url += '&rbd=1';
    }
    
    if (this.config.targetCountries) {
      const countries = this.config.targetCountries.join(',');
      if (this.config.triggerOnTargetCountries) {
        url += '&allowed_countries=' + encodeURIComponent(countries);
      } else {
        url += '&excluded_countries=' + encodeURIComponent(countries);
      }
    }
    
    url += this.config.clientHintsQueryStr;
    url += '&atag=1';
    url += '&cbur=' + Math.random();
    url += '&cbiframe=' + isInIframe();
    url += '&cbWidth=' + getWindowWidth();
    url += '&cbHeight=' + getWindowHeight();
    url += '&cbtitle=' + encodeURIComponent(getPageTitle());
    url += '&cbpage=' + encodeURIComponent(getCurrentPageURL());
    url += '&cbref=' + encodeURIComponent(getReferrer());
    url += '&cbdescription=' + encodeURIComponent(getMetaTag('description'));
    url += '&cbkeywords=' + encodeURIComponent(getMetaTag('keywords'));
    url += '&cbcdn=' + encodeURIComponent(this.adcashGlobal.getCdnDomain());
    url += '&ts=' + Date.now();
    url += '&atv=' + this.tagVersion;
    url += '&ufp=' + encodeURIComponent(this.config.uniqueFingerprint);
    url += '&srs=' + this.adcashGlobal.getSesionRandomString();
    
    if (this.config.adblockSettings) {
      url += '&abtg=1';
    }
    
    if (this.config.aggressivity) {
      url += `&aggr=${this.config.aggressivity}`;
    }
    
    if (this.config.collectiveZoneId) {
      url += `&czid=${this.config.collectiveZoneId}`;
    }
    
    if (this.config.recordPageView) {
      url += '&ppv=1';
    }
    
    if (this.config.abTest) {
      url += `&ab_test=${this.config.abTest}`;
    }
    
    if (this.config.adsCapping === false) {
      url += '&cap=0';
    }
    
    if (this.config.adblockSettings && this.config.adblockSettings.adbVersion) {
      url += `&adbv=${this.config.adblockSettings.adbVersion}`;
    }
    
    if (this.adcashGlobal.isSandboxed()) {
      url += '&sbx=1';
    }
    
    if (this.config.adblockSettings && this.adcashGlobal.isAdbMode()) {
      url += '&sadbl=2';
      url += '&fmt=suv5';
      this.logger.debug(`bid url: ${url}`);
      return obfuscateURL(url);
    }
    
    this.logger.debug(`bid url: ${url}`);
    return url;
  }
  
  showAdClickListener(event) {
    this.logger.debug(`showAdClickListener triggered by event type ${event.type} on ${event.target.tagName}`);
    
    if (!event.isTrusted) {
      this.logger.debug(`${event.type} on ${event.target.tagName}: pop rejected: event is not trusted`);
      return;
    }
    
    if (!this.adPayload) {
      this.logger.debug(`${event.type} on ${event.target.tagName}: pop rejected: current pop has no ad loaded`);
      return;
    }
    
    if (this.isLocked) {
      this.logger.debug(`${event.type} on ${event.target.tagName}:pop rejected: current pop is locked`);
      return;
    }
    
    if (this.adcashGlobal.isShowingPop) {
      this.logger.debug(`${event.type} on ${event.target.tagName}: pop rejected: another pop is being currently shown`);
      return;
    }
    
    if (!this.elementTargeting.isActionAllowedOnElement(event.target)) {
      this.logger.debug(`${event.type} on ${event.target.tagName}: pop rejected: action not allowed on element`, event.target);
      return;
    }
    
    this.adcashGlobal.isShowingPop = true;
    this.isLocked = true;
    this.logger.debug('triggering pop');
    
    if (this.isTabSwap()) {
      this.doTabSwap();
    } else {
      if (this.iframeWindowOpen) {
        this.popWindow = this.iframeWindowOpen(this.adPayload.url, '_blank', 'noopener,noreferrer');
      } else {
        this.popWindow = window.open(this.adPayload.url, '_blank', 'noopener,noreferrer');
      }
      
      this.sendImpression().finally(() => {
        this.cleanup();
      });
    }
  }
  
  isTabSwap() {
    return 'type' in this.adPayload && this.adPayload.type === 'tabswap';
  }
  
  doTabSwap() {
    this.logger.debug('do tabswap');
    this.config.actionCallback('tabswap');
    
    const adUrl = this.adPayload.url;
    
    if (this.iframeWindowOpen) {
      this.popWindow = this.iframeWindowOpen(window.location.href, '_blank', 'noreferrer');
    } else {
      this.popWindow = window.open(window.location.href, '_blank', 'noreferrer');
    }
    
    this.sendImpression().finally(() => {
      setTimeout(() => {
        const anchor = document.createElement('a');
        anchor.href = adUrl;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }, 50);
    });
  }
  
  async sendImpression(retryAttempt = 0) {
    const windowOpened = this.popWindow ? '1' : '0';
    this.logger.debug('window opened:', windowOpened);
    
    let impressionUrl = this.adPayload.impressionUrl + `&wo=${windowOpened}`;
    
    if (window['utsid-send']) {
      impressionUrl += `&utsid=${window['utsid-send']}`;
    }
    
    if (retryAttempt > 0) {
      this.logger.debug(`retry impression. Attempt ${retryAttempt}`);
      impressionUrl += `&rtry=${retryAttempt}`;
    }
    
    impressionUrl += this.config.clientHintsQueryStr;
    impressionUrl += '&cbpage=' + encodeURIComponent(getCurrentPageURL());
    impressionUrl += '&cbref=' + encodeURIComponent(getReferrer());
    
    this.logger.debug('send impression. url:', impressionUrl);
    
    if (supportsKeepalive()) {
      this.logger.debug('keepalive supported!');
      
      let response = null;
      let failed = false;
      
      try {
        response = await fetch(impressionUrl, { keepalive: true });
      } catch (error) {
        this.logger.error(error);
        
        if (this.config.adblockSettings && !this.adcashGlobal.isAdbMode()) {
          this.logger.debug('imp failed: try alt domain and path');
          this.adcashGlobal.enableAdbMode();
          return;
        }
        
        failed = true;
      }
      
      if ((response && !response.ok) || failed) {
        if (retryAttempt < 2) {
          await this.sendImpression(retryAttempt + 1);
          document.dispatchEvent(new CustomEvent('impression-retry-event'));
        }
        return;
      }
    } else {
      if (navigator.sendBeacon) {
        this.logger.debug('keepalive NOT supported! use sendBeacon');
        navigator.sendBeacon(impressionUrl);
      } else {
        this.logger.debug('keepalive NOT supported! use image.src');
        new Image().src = impressionUrl;
      }
    }
    
    document.dispatchEvent(new CustomEvent('impression-event'));
  }
  
  cleanup() {
    this.overlays.clearOverlaysResizeIntervalChecker();
    this.overlays.clearAnchorOverlays();
    this.overlays.clearIframeOverlays();
    this.overlays.clearVideoOverlays();
    this.adPayload = null;
    this.removeEventListeners();
    this.adcashGlobal.isShowingPop = false;
    this.config.actionCallback('pop');
  }
  
  setupEventListeners() {
    const eventConfig = {
      zoneId: this.config.zoneId,
      callback: this.showAdClickListener.bind(this)
    };
    
    if (isMobile() && isPinterest()) {
      this.logger.debug('subscribe to scroll');
      this.adcashGlobal.subscribe('scroll', eventConfig);
    }
    
    if (!isMobile()) {
      this.logger.debug('subscribe to mousedown');
      this.adcashGlobal.subscribe('mousedown', eventConfig, this.useCapture);
    }
    
    this.logger.debug('subscribe to click');
    this.adcashGlobal.subscribe('click', eventConfig, this.useCapture);
  }
  
  removeEventListeners() {
    if (isMobile() && isPinterest()) {
      this.logger.debug('unsubscribe from scroll');
      this.adcashGlobal.unsubscribe('scroll', this.config.zoneId);
    }
    
    if (!isMobile()) {
      this.logger.debug('unsubscribe from mousedown');
      this.adcashGlobal.unsubscribe('mousedown', this.config.zoneId, this.useCapture);
    }
    
    this.logger.debug('unsubscribe from click');
    this.adcashGlobal.unsubscribe('click', this.config.zoneId, this.useCapture);
  }
}


// ============================================================================
// PART 5: UTILITY FUNCTIONS AND HELPERS
// ============================================================================

// Browser Detection
const isMobile = () => {
  return /android/i.test(navigator.userAgent) ||
         /ipad|ipod|iphone/i.test(navigator.userAgent) ||
         /blackberry/i.test(navigator.userAgent) ||
         /BB10/i.test(navigator.userAgent) ||
         /iemobile/i.test(navigator.userAgent) ||
         /(?=.*\bWindows\b)(?=.*\bARM\b)/i.test(navigator.userAgent) ||
         /Windows Phone/i.test(navigator.userAgent) ||
         /opera mini/i.test(navigator.userAgent) ||
         /opios/i.test(navigator.userAgent) ||
         /^((?!UCWEB).)*UCBrowser.*Mobile.+/i.test(navigator.userAgent) ||
         /(?:Nexus 7|BNTV250|Kindle Fire|Silk|GT-P1000)/i.test(navigator.userAgent) ||
         /(KFOT|KFTT|KFJWI|KFJWA|KFSOWI|KFTHWI|KFTHWA|KFAPWI|KFAPWA|KFARWI|KFASWI|KFSAWI|KFSAWA|JSS15J|Silk|Kindle)/i.test(navigator.userAgent) ||
         /fban\/fbios|fbav|fbios|fb_iab\/fb4a/i.test(navigator.userAgent);
};

const isPinterest = () => {
  return /pinterest\/(ios|android)/i.test(navigator.userAgent);
};

const isChrome = () => {
  return /chrome|crios/i.test(navigator.userAgent);
};

const isFirefox = () => {
  return /firefox/i.test(navigator.userAgent);
};

const isOpera = () => {
  return /opera/i.test(navigator.userAgent);
};

const isIE = () => {
  return /msie/i.test(navigator.userAgent) || /Trident/i.test(navigator.userAgent);
};

// Page Information
const getCurrentPageURL = () => {
  let url = window.location.href;
  if (isInIframe()) {
    url = document.referrer;
  }
  return truncateString(url);
};

const isInIframe = () => {
  try {
    return window.self !== window.top ? 1 : 0;
  } catch (e) {
    return 1;
  }
};

const truncateString = (str) => {
  let maxLength = Math.max(str.indexOf(' ', 256), str.indexOf(',', 256));
  if (maxLength > 384 || maxLength < 20) {
    maxLength = 256;
  }
  return str.substring(0, maxLength);
};

const getWindowWidth = () => {
  return window.innerWidth || document.body.clientWidth;
};

const getWindowHeight = () => {
  return window.innerHeight || document.body.clientHeight;
};

const getPageTitle = () => {
  let title = document.title;
  if (isInIframe()) {
    try {
      title = window.top.document.title;
    } catch (e) {
      title = '';
    }
  }
  return truncateString(title);
};

const getReferrer = () => {
  let referrer = document.referrer;
  if (isInIframe()) {
    try {
      referrer = window.top.document.referrer;
    } catch (e) {
      referrer = '';
    }
  }
  return truncateString(referrer);
};

const getMetaTag = (name, logger = null) => {
  try {
    const metaTags = window.top.document.getElementsByTagName('meta');
    for (let i = 0; i < metaTags.length; i++) {
      if (metaTags[i].hasAttribute('name') && 
          metaTags[i].getAttribute('name').toLowerCase() === name) {
        const content = metaTags[i].getAttribute('content');
        return truncateString(content);
      }
    }
  } catch (e) {
    if (logger) {
      logger.error(e);
    }
  }
  return '';
};

// Random String Generation
const generateRandomString = (charset, minLength = 1, maxLength = 15) => {
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
};

// URL Obfuscation
const obfuscateURL = (url) => {
  const urlObj = new URL(url);
  
  if (urlObj.search) {
    const randomKey = generateRandomString(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      24,
      24
    );
    
    const params = urlObj.searchParams.entries();
    const paramsArray = Array.from(params);
    
    // Shuffle parameters
    for (let i = paramsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [paramsArray[i], paramsArray[j]] = [paramsArray[j], paramsArray[i]];
    }
    
    const queryString = paramsArray
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const encodedQuery = encodeURIComponent(btoa(queryString));
    urlObj.search = `${randomKey}=${encodedQuery}`;
  }
  
  return urlObj.toString();
};

// Fingerprinting
const generateFingerprint = () => {
  const components = [
    navigator.platform,
    navigator.appCodeName,
    navigator.appName,
    navigator.cookieEnabled,
    navigator.javaEnabled(),
    navigator.vendor,
    Math.max(window.screen.width, window.screen.height),
    Math.min(window.screen.width, window.screen.height),
    new Date().getTimezoneOffset(),
    navigator.language,
    navigator.deviceMemory || 'unknown',
    navigator.hardwareConcurrency,
    screen.pixelDepth + ' bits'
  ].join('/');
  
  return components;
};

// Session ID Generation
const generateSessionID = () => {
  if (window.rgxngibqxq === undefined || window.rgxngibqxq === '') {
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
};

// Client Hints (User-Agent Client Hints API)
const getClientHints = async (logger, returnObject = false) => {
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues([
        'model',
        'platform',
        'platformVersion',
        'uaFullVersion'
      ]);
      
      const result = {};
      
      if (hints.hasOwnProperty('brands') && hints.brands.length > 0) {
        const brands = [];
        for (let i = 0; i < hints.brands.length; i++) {
          const brand = hints.brands[i];
          brands.push(`"${brand.brand}";v=${brand.version}`);
        }
        result.chu = encodeURIComponent(brands.join(', '));
      }
      
      if (hints.hasOwnProperty('mobile')) {
        result.chmob = encodeURIComponent(hints.mobile ? '?1' : '?0');
      }
      
      const mappings = {
        model: 'chmod',
        platform: 'chp',
        platformVersion: 'chpv',
        uaFullVersion: 'chuafv'
      };
      
      for (const key in mappings) {
        if (hints.hasOwnProperty(key) && hints[key]) {
          result[mappings[key]] = encodeURIComponent(hints[key]);
        }
      }
      
      if (returnObject) {
        return result;
      }
      
      let queryString = '';
      for (const key in result) {
        queryString += `&${key}=${result[key]}`;
      }
      
      return queryString;
    } catch (error) {
      logger.error('error getting client hints:', error);
      return returnObject ? {} : '';
    }
  }
  
  return returnObject ? {} : '';
};

// Feature Detection
const supportsKeepalive = (() => {
  try {
    return new Request('', { keepalive: true }).keepalive === true;
  } catch (e) {
    return false;
  }
})();

// Validation
const isValidTimeValue = (value) => {
  return Number.isFinite(value) && value >= -2;
};

const isValidURL = (url) => {
  return /^(https?:\/\/|\/\/)/.test(url);
};

// Array Utilities
const flattenArray = (arr) => {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flattenArray(item) : item);
  }, []);
};

// Macro Formatting
const formatMacrosValues = (macros) => {
  if (typeof macros !== 'object') {
    return macros;
  }
  return JSON.stringify(macros);
};

// URL Template Resolution
const resolveURLTemplates = (templates, macros, options = {}) => {
  const urls = [];
  const templateArray = Array.isArray(templates) ? templates : [templates];
  
  if (!macros.ERRORCODE || options.isCustomCode || /^[0-9]{3}$/.test(macros.ERRORCODE)) {
    // Valid error code
  } else {
    macros.ERRORCODE = 900;
  }
  
  macros.CACHEBUSTING = generateCacheBusting(Math.round(Math.random() * 100000000));
  macros.TIMESTAMP = new Date().toISOString();
  macros.RANDOM = macros.random = macros.CACHEBUSTING;
  
  for (const key in macros) {
    macros[key] = encodeURIComponentRFC3986(macros[key]);
  }
  
  for (const key in templateArray) {
    const template = templateArray[key];
    if (typeof template === 'string') {
      urls.push(replaceMacros(template, macros));
    }
  }
  
  return urls;
};

const replaceMacros = (template, macros) => {
  let result = template;
  
  for (const key in macros) {
    const value = macros[key];
    const regex = new RegExp(`(?:\\[|%%)${key}(?:\\]|%%)`, 'g');
    result = result.replace(regex, value);
  }
  
  return result;
};

const encodeURIComponentRFC3986 = (str) => {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16);
  });
};

const generateCacheBusting = (num, length = 8) => {
  return num.toString().padStart(length, '0');
};

// Tracking
const trackURLs = (urlTemplates, macros, options = {}) => {
  const urls = resolveURLTemplates(urlTemplates, macros, options);
  urls.forEach(url => {
    if (typeof window !== 'undefined' && window !== null) {
      new Image().src = url;
    }
  });
};

// Storage Service
class StorageService {
  constructor() {
    this.storage = this.initStorage();
  }
  
  initStorage() {
    let storage = null;
    
    try {
      if (typeof window !== 'undefined' && window !== null) {
        storage = window.localStorage || window.sessionStorage;
      }
    } catch (e) {
      storage = null;
    }
    
    if (storage && !this.isStorageDisabled(storage)) {
      return storage;
    }
    
    // Fallback to in-memory storage
    return {
      data: {},
      length: 0,
      getItem(key) {
        return this.data[key];
      },
      setItem(key, value) {
        this.data[key] = value;
        this.length = Object.keys(this.data).length;
      },
      removeItem(key) {
        delete this.data[key];
        this.length = Object.keys(this.data).length;
      },
      clear() {
        this.data = {};
        this.length = 0;
      }
    };
  }
  
  isStorageDisabled(storage) {
    const testKey = '__VASTStorage__';
    
    try {
      storage.setItem(testKey, testKey);
      if (storage.getItem(testKey) !== testKey) {
        storage.removeItem(testKey);
        return true;
      }
    } catch (e) {
      return true;
    }
    
    storage.removeItem(testKey);
    return false;
  }
  
  getItem(key) {
    return this.storage.getItem(key);
  }
  
  setItem(key, value) {
    return this.storage.setItem(key, value);
  }
  
  removeItem(key) {
    return this.storage.removeItem(key);
  }
  
  clear() {
    return this.storage.clear();
  }
}

// Logger
class Logger {
  constructor(tagName = 'adcsh', isDebugEnabled = false) {
    this.tagName = tagName;
    this.isDebugEnabled = isDebugEnabled;
    
    const debugSetting = localStorage.getItem('adcsh_dbg');
    if (debugSetting) {
      this.isDebugEnabled = JSON.parse(debugSetting);
    }
  }
  
  log(level, ...args) {
    if (this.isDebugEnabled) {
      console.log(`[${this.tagName}][${level}]:`, ...args);
    }
  }
  
  debug(...args) {
    this.log('debug', ...args);
  }
  
  error(...args) {
    this.log('error', ...args);
  }
}

// Event Emitter
class EventEmitter {
  constructor() {
    this.handlers = [];
  }
  
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`The handler argument must be of type Function. Received type ${typeof handler}`);
    }
    
    if (!event) {
      throw new TypeError(`The event argument must be of type String. Received type ${typeof event}`);
    }
    
    this.handlers.push({ event, handler });
    return this;
  }
  
  once(event, handler) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      handler.apply(this, args);
    };
    
    return this.on(event, onceWrapper);
  }
  
  off(event, handler) {
    this.handlers = this.handlers.filter(h => {
      return h.event !== event || h.handler !== handler;
    });
    return this;
  }
  
  emit(event, ...args) {
    let handled = false;
    
    this.handlers.forEach(h => {
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
      this.handlers = this.handlers.filter(h => h.event !== event);
      return this;
    }
    
    this.handlers = [];
    return this;
  }
  
  listenerCount(event) {
    return this.handlers.filter(h => h.event === event).length;
  }
  
  listeners(event) {
    return this.handlers.reduce((listeners, h) => {
      if (h.event === event) {
        listeners.push(h.handler);
      }
      return listeners;
    }, []);
  }
  
  eventNames() {
    return this.handlers.map(h => h.event);
  }
}

// ============================================================================
// PART 6: ELEMENT TARGETING AND OVERLAY MANAGEMENT
// ============================================================================

class ElementTargeting {
  constructor(targetElementsCssSelector, shouldTriggerPopOnTargetClick, zoneId) {
    this.targetElementsCssSelector = targetElementsCssSelector;
    this.shouldTriggerPopOnTargetClick = shouldTriggerPopOnTargetClick;
    this.zoneId = zoneId;
  }
  
  isPresent() {
    return !!this.targetElementsCssSelector;
  }
  
  isActionAllowedOnElement(element) {
    if (!this.isPresent()) {
      return true;
    }
    
    if (element.hasAttribute('znid')) {
      return element.getAttribute('znid') === this.zoneId;
    }
    
    if (element.hasAttribute('doskip')) {
      return false;
    }
    
    const skipElements = Array.from(document.querySelectorAll('[doskip*="1"]'));
    for (const skipElement of skipElements) {
      if (skipElement.contains(element)) {
        return false;
      }
    }
    
    return this.matchesTargetElement(element) ? 
      this.shouldTriggerPopOnTargetClick : 
      !this.shouldTriggerPopOnTargetClick;
  }
  
  matchesTargetElement(element) {
    const targetElements = document.querySelectorAll(this.targetElementsCssSelector);
    
    do {
      for (let i = 0; i < targetElements.length; i++) {
        if (element === targetElements[i]) {
          return true;
        }
      }
    } while (element = element.parentNode);
    
    return false;
  }
}

class OverlayManager {
  constructor(elementTargeting, desktopClickListener, logger, zoneId, useCapture) {
    this.elementTargeting = elementTargeting;
    this.desktopClickListener = desktopClickListener;
    this.logger = logger;
    this.zoneId = zoneId;
    this.useCapture = useCapture;
    
    this.iframesToOverlays = [];
    this.videosToOverlays = [];
    this.anchorsToOverlays = [];
    this.fullOverlay = null;
    this.overlaysResizeIntervalChecker = null;
  }
  
  setOverlaysResizeIntervalChecker() {
    this.overlaysResizeIntervalChecker = setInterval(() => {
      const updatePosition = (overlay, element) => {
        try {
          const rect = element.getBoundingClientRect();
          overlay.style.top = `${rect.top + window.scrollY}px`;
          overlay.style.left = `${rect.left + window.scrollX}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;
        } catch (e) {}
      };
      
      this.iframesToOverlays.forEach(({ overlay, iframe }) => updatePosition(overlay, iframe));
      this.videosToOverlays.forEach(({ overlay, video }) => updatePosition(overlay, video));
      this.anchorsToOverlays.forEach(({ overlay, anchor }) => updatePosition(overlay, anchor));
    }, 500);
  }
  
  clearOverlaysResizeIntervalChecker() {
    try {
      clearInterval(this.overlaysResizeIntervalChecker);
    } catch (e) {}
  }
  
  createOverlay(element) {
    const overlay = document.createElement('div');
    
    overlay.addEventListener('mousedown', (e) => {
      this.logger.debug('mousedown on overlay');
      e.stopPropagation();
      e.preventDefault();
      this.desktopClickListener(e);
    }, this.useCapture);
    
    if (element === document.body) {
      overlay.id = 'dontfoid';
      overlay.style.top = '0px';
      overlay.style.left = '0px';
      overlay.style.width = `${window.innerWidth || document.body.clientWidth}px`;
      overlay.style.height = `${window.innerHeight || document.body.clientHeight}px`;
      overlay.style.position = 'fixed';
    } else {
      const rect = element.getBoundingClientRect();
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.position = 'absolute';
      overlay.setAttribute('donto', '');
    }
    
    overlay.setAttribute('znid', this.zoneId);
    overlay.style.zIndex = '2147483647';
    overlay.style.backgroundColor = 'transparent';
    
    if (element === document.body) {
      document.body.appendChild(overlay);
    } else {
      element.parentNode.appendChild(overlay);
    }
    
    return overlay;
  }
  
  attachVideoOverlays() {
    const videos = document.querySelectorAll('video');
    for (let i = 0; i < videos.length; i++) {
      if (this.elementTargeting.isActionAllowedOnElement(videos[i])) {
        this.videosToOverlays.push({
          video: videos[i],
          overlay: this.createOverlay(videos[i])
        });
      }
    }
  }
  
  attachIframeOverlays() {
    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      if (this.elementTargeting.isActionAllowedOnElement(iframes[i])) {
        this.iframesToOverlays.push({
          iframe: iframes[i],
          overlay: this.createOverlay(iframes[i])
        });
      }
    }
  }
  
  attachAnchorOverlays() {
    const anchors = document.querySelectorAll('a');
    for (let i = 0; i < anchors.length; i++) {
      if (this.elementTargeting.isActionAllowedOnElement(anchors[i])) {
        this.anchorsToOverlays.push({
          anchor: anchors[i],
          overlay: this.createOverlay(anchors[i])
        });
      }
    }
  }
  
  clearVideoOverlays() {
    for (let i = 0; i < this.videosToOverlays.length; i++) {
      this.videosToOverlays[i].overlay.parentNode.removeChild(this.videosToOverlays[i].overlay);
      this.videosToOverlays[i].overlay = null;
    }
    this.videosToOverlays.length = 0;
  }
  
  clearAnchorOverlays() {
    for (let i = 0; i < this.anchorsToOverlays.length; i++) {
      this.anchorsToOverlays[i].overlay.parentNode.removeChild(this.anchorsToOverlays[i].overlay);
      this.anchorsToOverlays[i].overlay = null;
    }
    this.anchorsToOverlays.length = 0;
  }
  
  clearIframeOverlays() {
    for (let i = 0; i < this.iframesToOverlays.length; i++) {
      this.iframesToOverlays[i].overlay.parentNode.removeChild(this.iframesToOverlays[i].overlay);
      this.iframesToOverlays[i].overlay = null;
    }
    this.iframesToOverlays.length = 0;
  }
}

// ============================================================================
// END OF DEOBFUSCATED CODE
// ============================================================================

console.log('VidSrc.cc advertising system fully deobfuscated');
console.log('This code implements VAST ads, pop-unders, interstitials, and tracking');
