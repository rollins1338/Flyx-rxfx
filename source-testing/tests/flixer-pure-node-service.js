/**
 * Flixer Pure Node.js Service
 * 
 * A complete service that extracts m3u8 URLs from Flixer without Puppeteer.
 * Uses the pure Node.js WASM loader for key generation and decryption.
 */
const crypto = require('crypto');
const { FlixerWasmLoader } = require('./flixer-wasm-node.js');

const FLIXER_API_BASE = 'https://plsdontscrapemelove.flixer.sh';

class FlixerPureNodeService {
  constructor(options = {}) {
    this.loader = null;
    this.apiKey = null;
    this.initialized = false;
    this.serverTimeOffset = 0; // Offset between local time and server time
    
    // Browser fingerprint values - must match what WASM uses
    this.screenWidth = options.screenWidth || 2560;
    this.screenHeight = options.screenHeight || 1440;
    this.colorDepth = options.colorDepth || 24;
    this.platform = options.platform || 'Win32';
    this.language = options.language || 'en-US';
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
    this.timezoneOffset = options.timezoneOffset || new Date().getTimezoneOffset();
    
    this.options = {
      sessionId: options.sessionId || crypto.randomBytes(16).toString('hex'),
      debug: options.debug || false,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      colorDepth: this.colorDepth,
      platform: this.platform,
      language: this.language,
      userAgent: this.userAgent,
      timezoneOffset: this.timezoneOffset,
      ...options,
    };
  }

  log(...args) {
    if (this.options.debug) console.log('[FlixerService]', ...args);
  }

  /**
   * Sync with server time to avoid timestamp validation errors
   */
  async syncServerTime() {
    const localTimeBefore = Date.now();
    const response = await fetch(`${FLIXER_API_BASE}/api/time?t=${localTimeBefore}`);
    const localTimeAfter = Date.now();
    const data = await response.json();
    
    // Calculate round-trip time and adjust
    const rtt = localTimeAfter - localTimeBefore;
    const serverTimeMs = data.timestamp * 1000;
    
    // Server time + half RTT = estimated current server time
    this.serverTimeOffset = serverTimeMs + (rtt / 2) - localTimeAfter;
    
    this.log('Server time sync:');
    this.log('  Server timestamp:', data.timestamp);
    this.log('  RTT:', rtt, 'ms');
    this.log('  Offset:', this.serverTimeOffset, 'ms');
    this.log('  Current server time:', this.getServerTimestamp());
  }

  /**
   * Get current timestamp synced with server
   */
  getServerTimestamp() {
    return Math.floor((Date.now() + this.serverTimeOffset) / 1000);
  }

  /**
   * Generate client fingerprint matching the browser implementation
   * This is sent in X-Client-Fingerprint header
   */
  generateClientFingerprint() {
    // Use a realistic canvas fingerprint that matches what a real browser would generate
    // The browser draws "FP" text on a canvas and gets the base64 PNG
    // This is a typical canvas fingerprint substring for Chrome on Windows
    const canvasSubstr = 'iVBORw0KGgoAAAANSUhEUgAAASwA';
    
    // Build fingerprint string exactly like the browser
    const fpString = `${this.screenWidth}x${this.screenHeight}:${this.colorDepth}:${this.userAgent.substring(0, 50)}:${this.platform}:${this.language}:${this.timezoneOffset}:${canvasSubstr}`;
    
    // Hash it to a number (same algorithm as browser)
    let hash = 0;
    for (let i = 0; i < fpString.length; i++) {
      hash = (hash << 5) - hash + fpString.charCodeAt(i);
      hash &= hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  async initialize() {
    if (this.initialized) return;

    this.log('Syncing server time...');
    await this.syncServerTime();

    this.log('Initializing WASM loader...');
    this.loader = new FlixerWasmLoader({
      sessionId: this.options.sessionId,
      debug: this.options.debug,
    });
    
    await this.loader.initialize();
    this.apiKey = this.loader.getImgKey();
    
    this.log('Initialized with key:', this.apiKey.slice(0, 16) + '...');
    this.initialized = true;
  }

  /**
   * Generate request authentication headers
   */
  generateAuthHeaders(path) {
    const timestamp = this.getServerTimestamp();
    const nonce = crypto.randomBytes(16).toString('base64')
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const message = `${this.apiKey}:${timestamp}:${nonce}:${path}`;
    
    const signature = crypto
      .createHmac('sha256', this.apiKey)
      .update(message)
      .digest('base64');
    
    const fingerprint = this.generateClientFingerprint();
    this.log('Client fingerprint:', fingerprint);
    
    return {
      'X-Api-Key': this.apiKey,
      'X-Request-Timestamp': timestamp.toString(),
      'X-Request-Nonce': nonce,
      'X-Request-Signature': signature,
      'X-Client-Fingerprint': fingerprint,
      'Accept': 'text/plain',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': this.userAgent,
      'Referer': 'https://flixer.sh/',
      'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    };
  }

  /**
   * Decrypt API response using WASM
   */
  async decrypt(encryptedData) {
    try {
      this.log('Decrypting data of length:', encryptedData.length);
      const result = await this.loader.processImgData(encryptedData, this.apiKey);
      this.log('Decryption result type:', typeof result);
      return result;
    } catch (e) {
      this.log('Decryption error:', e);
      throw new Error(`Decryption failed: ${e.message || e}`);
    }
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(path, extraHeaders = {}) {
    const headers = {
      ...this.generateAuthHeaders(path),
      ...extraHeaders,
    };

    this.log('Requesting:', path);
    
    const response = await fetch(`${FLIXER_API_BASE}${path}`, { headers });
    
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }
    
    return response.text();
  }

  /**
   * Get available servers for content
   */
  async getServers(type, tmdbId, seasonId = null, episodeId = null) {
    if (!this.initialized) await this.initialize();

    const path = type === 'movie'
      ? `/api/tmdb/movie/${tmdbId}/images`
      : `/api/tmdb/tv/${tmdbId}/season/${seasonId}/episode/${episodeId}/images`;

    const encrypted = await this.apiRequest(path);
    const decrypted = await this.decrypt(encrypted);
    const data = JSON.parse(decrypted);

    // Extract server list
    let servers = [];
    if (data.servers) {
      servers = Object.keys(data.servers);
    } else if (data.sources && Array.isArray(data.sources)) {
      servers = [...new Set(data.sources.map(s => s.server).filter(Boolean))];
    }

    this.log('Available servers:', servers);
    return { servers, raw: data };
  }

  /**
   * Get source URL from a specific server with retries
   * The server sometimes returns empty URLs initially and needs retries
   */
  async getSourceFromServer(type, tmdbId, server, seasonId = null, episodeId = null, retries = 5) {
    if (!this.initialized) await this.initialize();

    const path = type === 'movie'
      ? `/api/tmdb/movie/${tmdbId}/images`
      : `/api/tmdb/tv/${tmdbId}/season/${seasonId}/episode/${episodeId}/images`;

    // First, make a "warm-up" request without X-Server header
    // This seems to be required by the server to establish session state
    this.log('Making warm-up request...');
    try {
      await this.apiRequest(path, {});
    } catch (e) {
      this.log('Warm-up request failed (expected):', e.message);
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 100));

    for (let attempt = 1; attempt <= retries; attempt++) {
      // Use X-Only-Sources and X-Server headers like the browser client
      const encrypted = await this.apiRequest(path, {
        'X-Only-Sources': '1',
        'X-Server': server,
      });

      const decrypted = await this.decrypt(encrypted);
      this.log(`Attempt ${attempt} - Decrypted data from ${server}:`, decrypted.substring(0, 300));
      
      const data = JSON.parse(decrypted);

      // Extract URL - check multiple possible locations
      let url = null;
      
      // Check sources array
      if (Array.isArray(data.sources)) {
        const source = data.sources.find(s => s.server === server) || data.sources[0];
        url = source?.url || source?.file || source?.stream;
        if (!url && source?.sources) {
          // Nested sources
          url = source.sources[0]?.url || source.sources[0]?.file;
        }
      }
      
      // Check direct properties
      if (!url) {
        url = data.sources?.file || data.sources?.url || data.file || data.url || data.stream;
      }
      
      // Check servers object
      if (!url && data.servers && data.servers[server]) {
        const serverData = data.servers[server];
        url = serverData.url || serverData.file || serverData.stream;
        if (Array.isArray(serverData)) {
          url = serverData[0]?.url || serverData[0]?.file;
        }
      }

      if (url && url.trim() !== '') {
        this.log(`✅ Found URL on attempt ${attempt}:`, url.substring(0, 80));
        return { url, raw: data };
      }
      
      // Wait before retry (200ms like the browser client)
      if (attempt < retries) {
        this.log(`Empty URL, retrying in 200ms... (attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return { url: null, raw: null };
  }

  /**
   * Get all available sources (m3u8 URLs)
   */
  async getSources(type, tmdbId, seasonId = null, episodeId = null) {
    if (!this.initialized) await this.initialize();

    const { servers } = await this.getServers(type, tmdbId, seasonId, episodeId);
    const sources = {};

    // NATO phonetic alphabet order for server priority (like the browser client)
    const natoOrder = [
      'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
      'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
      'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
      'xray', 'yankee', 'zulu'
    ];
    
    const sortedServers = natoOrder.filter(s => servers.includes(s))
      .concat(servers.filter(s => !natoOrder.includes(s)));

    for (const server of sortedServers.slice(0, 6)) { // Try first 6 servers
      try {
        const { url } = await this.getSourceFromServer(type, tmdbId, server, seasonId, episodeId);
        if (url) {
          sources[server] = url;
          this.log(`✅ Found source from ${server}:`, url.substring(0, 80) + '...');
          // Found a working source, can stop here or continue for more options
          break; // Stop at first working source like the browser does
        }
      } catch (e) {
        this.log(`Error from ${server}:`, e.message);
      }
    }

    return sources;
  }
}

module.exports = { FlixerPureNodeService };

// Test when run directly
if (require.main === module) {
  (async () => {
    console.log('=== Flixer Pure Node.js Service Test ===\n');
    console.log('This is a PURE FETCH implementation - no Puppeteer!\n');
    
    const service = new FlixerPureNodeService({ debug: false });
    
    try {
      await service.initialize();
      console.log('✅ Service initialized\n');
      
      // Test TV show - Arcane S1E1
      console.log('--- Testing TV Show (Arcane S1E1) ---');
      const tvResult = await service.getSourceFromServer('tv', 94605, 'alpha', 1, 1, 3);
      
      if (tvResult.url) {
        console.log('✅ TV Show SUCCESS!');
        console.log('   M3U8 URL:', tvResult.url.substring(0, 80) + '...');
      } else {
        console.log('❌ TV Show: No URL found');
      }
      
      // Test Movie - Inception
      console.log('\n--- Testing Movie (Inception) ---');
      const movieResult = await service.getSourceFromServer('movie', 27205, 'alpha', null, null, 3);
      
      if (movieResult.url) {
        console.log('✅ Movie SUCCESS!');
        console.log('   M3U8 URL:', movieResult.url.substring(0, 80) + '...');
      } else {
        console.log('❌ Movie: No URL found');
      }
      
      console.log('\n=== PURE FETCH FLIXER CRACK COMPLETE! ===');
      
    } catch (e) {
      console.error('\n❌ Error:', e.message);
      if (e.stack) console.error(e.stack);
    }
  })();
}
