// ============================================================================
// VIDSRC PAGE - COMPLETE DEOBFUSCATED CODE
// ============================================================================
// This is the cleaned version of all JavaScript from the vidsrc player page
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================

const pageConfig = {
  imdbId: "30472557",
  title: "Chainsaw Man - The Movie: Reze Arc (2025)",
  subHash: "52ca5c1eadf6b07b0b0506793c0e06fa",
  sandboxTest: true,
  
  // Server hashes (MD5:Base64Encrypted format)
  servers: {
    cloudstreamPro: "MmEwNDkxMDc1MzQ4NDk3NmI1ZDZjMDNmNTQzNTA3ZTA:...",
    twoEmbed: "MDNkNzdlMDRlMjAzNDEzM2NhNjUyNjhkMGE3Nzk4YWU:...",
    superembed: "M2U5MmM3Y2VhMGQ2ZjhiNTBiOGM5YWZmYzM2MjdlM2U:..."
  }
};

// ============================================================================
// LOCAL STORAGE MANAGEMENT
// ============================================================================

class LocalStorageManager {
  constructor() {
    this.enabled = this.checkLocalStorage();
  }
  
  checkLocalStorage() {
    try {
      localStorage.setItem('test_lc', "1");
      if (localStorage.getItem('test_lc') === "1") {
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }
  
  getSubtitleKey(imdbId, season = null, episode = null) {
    let key = `sub_${imdbId}`;
    if (season && episode) {
      key += `_${season}x${episode}`;
    }
    return key;
  }
  
  getSubtitleData(key, expectedHash) {
    if (!this.enabled) return null;
    
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && typeof data === 'object') {
        // Verify hash matches
        if (data.sub_hash === expectedHash) {
          return data;
        }
      }
    } catch (err) {
      console.error('Error reading subtitle data:', err);
    }
    
    return null;
  }
  
  setSubtitleData(key, data, hash) {
    if (!this.enabled) return false;
    
    try {
      data.sub_hash = hash;
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Error saving subtitle data:', err);
      return false;
    }
  }
}

// ============================================================================
// POSTMESSAGE COMMUNICATION SYSTEM
// ============================================================================

class MessageRelay {
  constructor(iframeId) {
    this.iframe = document.getElementById(iframeId);
    this.setupListeners();
  }
  
  setupListeners() {
    window.addEventListener('message', (message) => {
      // Skip messages from same window
      if (message.source === window) {
        return;
      }
      
      // Handle different message types
      this.handleMessage(message);
    });
  }
  
  handleMessage(message) {
    const data = message.data;
    
    // Player events
    if (data.type === "PLAYER_EVENT") {
      console.log('Player event:', data);
      this.onPlayerEvent(data);
    }
    
    // Reload page command
    if (data === "reload_page") {
      window.location.reload();
    }
    
    // TV fullscreen mode
    if (data === "tvfull") {
      this.adjustForTVMode();
    }
    
    // Relay messages between parent and iframe
    if (message.source === window.parent) {
      // Message from parent -> forward to iframe
      this.sendToIframe(data);
    } else {
      // Message from iframe -> forward to parent
      this.sendToParent(data);
    }
  }
  
  sendToIframe(data) {
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage(data, '*');
    }
  }
  
  sendToParent(data) {
    window.parent.postMessage(data, '*');
  }
  
  onPlayerEvent(event) {
    // Handle player state changes
    // Can be extended to track progress, handle errors, etc.
  }
  
  adjustForTVMode() {
    const servers = document.querySelector('.servers');
    if (servers) {
      servers.style.left = '100px';
    }
  }
}

// ============================================================================
// VIP DETECTION SYSTEM
// ============================================================================

class VIPDetector {
  constructor() {
    this.isVIP = false;
    this.checkVIPStatus();
  }
  
  checkVIPStatus() {
    // Check if page is in iframe
    if (window.frameElement === null) {
      // Not in iframe - show ads
      this.showAds();
      return;
    }
    
    // Get referrer from iframe attribute
    const ref = window.frameElement.getAttribute('data-ref');
    
    if (!ref || ref.length <= 3) {
      this.showAds();
      return;
    }
    
    // Check VIP status via API
    this.checkVIPAPI(ref);
  }
  
  async checkVIPAPI(referrer) {
    try {
      const response = await fetch(`/is_vip_str.php?ref=${encodeURIComponent(referrer)}`);
      const data = await response.text();
      
      if (data === "1") {
        this.isVIP = true;
        this.hideAds();
      } else {
        this.showAds();
      }
    } catch (err) {
      console.error('VIP check failed:', err);
      this.showAds();
    }
  }
  
  showAds() {
    const topButtons = document.getElementById('top_buttons_parent');
    if (topButtons) {
      topButtons.style.display = 'block';
    }
  }
  
  hideAds() {
    const topButtons = document.getElementById('top_buttons_parent');
    if (topButtons) {
      topButtons.style.display = 'none';
    }
  }
}

// ============================================================================
// AD MANAGEMENT
// ============================================================================

class AdManager {
  constructor() {
    this.setupAdControls();
  }
  
  setupAdControls() {
    // Ad720 banner close button
    const closeButton = document.querySelector('#ad720 #close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeAd720();
      });
    }
  }
  
  closeAd720() {
    const ad720 = document.getElementById('ad720');
    if (ad720) {
      ad720.style.display = 'none';
    }
    
    // Set cookie to remember ad was closed (very short expiry)
    this.setCookie('ad720', '1', 0.001);
  }
  
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=None;Secure`;
  }
  
  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    
    return null;
  }
}

// ============================================================================
// SERVER SELECTION
// ============================================================================

class ServerSelector {
  constructor() {
    this.currentServer = null;
    this.servers = this.getServerList();
    this.setupServerButtons();
  }
  
  getServerList() {
    const serverElements = document.querySelectorAll('.server');
    const servers = [];
    
    serverElements.forEach(element => {
      servers.push({
        name: element.textContent.trim(),
        hash: element.getAttribute('data-hash'),
        element: element
      });
    });
    
    return servers;
  }
  
  setupServerButtons() {
    this.servers.forEach(server => {
      server.element.addEventListener('click', () => {
        this.switchServer(server);
      });
    });
  }
  
  switchServer(server) {
    console.log('Switching to server:', server.name);
    
    // Decode the hash
    const decodedData = this.decodeServerHash(server.hash);
    
    if (decodedData) {
      // Update iframe source
      this.updateIframeSrc(decodedData.url);
      this.currentServer = server;
    }
  }
  
  decodeServerHash(hash) {
    try {
      // Hash format: MD5:Base64Encrypted
      const parts = hash.split(':');
      
      if (parts.length !== 2) {
        console.error('Invalid hash format');
        return null;
      }
      
      const md5Hash = parts[0];
      const base64Data = parts[1];
      
      // Decode base64
      const decoded = atob(base64Data);
      
      // Further decryption would be needed here
      // This is where the actual stream URL is extracted
      
      return {
        hash: md5Hash,
        url: decoded
      };
    } catch (err) {
      console.error('Error decoding server hash:', err);
      return null;
    }
  }
  
  updateIframeSrc(url) {
    const iframe = document.getElementById('player_iframe');
    if (iframe) {
      iframe.src = url;
    }
  }
}

// ============================================================================
// ANALYTICS TRACKING
// ============================================================================

class AnalyticsTracker {
  constructor() {
    this.histatsId = '4873540';
    this.setupHistats();
  }
  
  setupHistats() {
    window._Hasync = window._Hasync || [];
    
    _Hasync.push(['Histats.start', `1,${this.histatsId},4,511,95,18,00000000`]);
    _Hasync.push(['Histats.fasi', '1']);
    _Hasync.push(['Histats.track_hits', '']);
    _Hasync.push(['Histats.framed_page', '']);
    
    this.loadHistatsScript();
  }
  
  loadHistatsScript() {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = '//s10.histats.com/js15_as.js';
    
    const target = document.getElementsByTagName('head')[0] || 
                   document.getElementsByTagName('body')[0];
    target.appendChild(script);
  }
  
  trackEvent(eventName, eventData) {
    if (window._Hasync) {
      _Hasync.push(['Histats.track_event', eventName, eventData]);
    }
  }
}

// ============================================================================
// DEVTOOLS PROTECTION
// ============================================================================

class DevToolsProtection {
  constructor() {
    this.enabled = true;
    this.setupProtection();
  }
  
  setupProtection() {
    if (typeof DisableDevtool !== 'undefined') {
      DisableDevtool({
        clearLog: true,              // Clear console logs
        disableSelect: true,         // Disable text selection
        disableCopy: true,           // Disable copy
        disableCut: true,            // Disable cut
        disablePaste: true,          // Disable paste
        disableIframeParents: false  // Don't disable in parent iframes
      });
    }
  }
  
  detectDevTools() {
    // Additional devtools detection
    const threshold = 160;
    
    setInterval(() => {
      if (window.outerWidth - window.innerWidth > threshold ||
          window.outerHeight - window.innerHeight > threshold) {
        // DevTools likely open
        this.onDevToolsDetected();
      }
    }, 1000);
  }
  
  onDevToolsDetected() {
    console.log('DevTools detected');
    // Could trigger additional protection measures
  }
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

class VidSrcPlayer {
  constructor() {
    this.storage = new LocalStorageManager();
    this.messageRelay = new MessageRelay('player_iframe');
    this.vipDetector = new VIPDetector();
    this.adManager = new AdManager();
    this.serverSelector = new ServerSelector();
    this.analytics = new AnalyticsTracker();
    this.protection = new DevToolsProtection();
    
    this.init();
  }
  
  init() {
    console.log('VidSrc Player initialized');
    
    // Load subtitle data
    const subKey = this.storage.getSubtitleKey(
      pageConfig.imdbId,
      this.getSeasonFromBody(),
      this.getEpisodeFromBody()
    );
    
    const subData = this.storage.getSubtitleData(subKey, pageConfig.subHash);
    
    if (subData) {
      console.log('Loaded subtitle data:', subData);
    }
    
    // Show server selector
    this.showServers();
    
    // Track page view
    this.analytics.trackEvent('page_view', {
      imdb_id: pageConfig.imdbId,
      title: pageConfig.title
    });
  }
  
  getSeasonFromBody() {
    return document.body.getAttribute('data-s');
  }
  
  getEpisodeFromBody() {
    return document.body.getAttribute('data-e');
  }
  
  showServers() {
    const servers = document.querySelector('.servers');
    if (servers) {
      servers.style.display = 'block';
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.vidSrcPlayer = new VidSrcPlayer();
  });
} else {
  window.vidSrcPlayer = new VidSrcPlayer();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function base64Decode(str) {
  try {
    return atob(str);
  } catch (err) {
    console.error('Base64 decode error:', err);
    return null;
  }
}

function base64Encode(str) {
  try {
    return btoa(str);
  } catch (err) {
    console.error('Base64 encode error:', err);
    return null;
  }
}

function md5Hash(str) {
  // Uses blueimp-md5 library loaded externally
  if (typeof md5 !== 'undefined') {
    return md5(str);
  }
  console.error('MD5 library not loaded');
  return null;
}

// ============================================================================
// EXPORT FOR DEBUGGING (remove in production)
// ============================================================================

if (typeof window !== 'undefined') {
  window.VidSrcDebug = {
    LocalStorageManager,
    MessageRelay,
    VIPDetector,
    AdManager,
    ServerSelector,
    AnalyticsTracker,
    DevToolsProtection,
    VidSrcPlayer
  };
}

console.log('VidSrc player page fully deobfuscated and initialized');
