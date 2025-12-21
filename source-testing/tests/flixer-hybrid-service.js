/**
 * Flixer Hybrid Service
 * 
 * Uses Puppeteer to make requests through a real browser's network stack,
 * but controls the flow programmatically. This bypasses TLS fingerprinting
 * and other network-level bot detection.
 */
const puppeteer = require('puppeteer');

class FlixerHybridService {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.initialized = false;
    this.debug = options.debug || false;
  }

  log(...args) {
    if (this.debug) console.log('[FlixerHybrid]', ...args);
  }

  async initialize() {
    if (this.initialized) return;

    this.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Need visible browser for WASM to load properly
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    
    // Navigate to a real content page to trigger WASM loading
    this.log('Navigating to Flixer...');
    await this.page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    // Wait for WASM to be ready
    this.log('Waiting for WASM...');
    await this.page.waitForFunction(() => {
      return window.wasmImgData && window.wasmImgData.ready && window.wasmImgData.key;
    }, { timeout: 30000 });

    this.initialized = true;
    this.log('Initialized!');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.initialized = false;
    }
  }

  /**
   * Get m3u8 URL for content
   */
  async getSource(type, tmdbId, seasonId = null, episodeId = null) {
    if (!this.initialized) await this.initialize();

    const path = type === 'movie'
      ? `/api/tmdb/movie/${tmdbId}/images`
      : `/api/tmdb/tv/${tmdbId}/season/${seasonId}/episode/${episodeId}/images`;

    this.log('Getting source for:', path);

    // Use the browser to make the request
    const result = await this.page.evaluate(async (path, type, tmdbId, seasonId, episodeId) => {
      const apiKey = window.wasmImgData.key;
      const baseUrl = 'https://plsdontscrapemelove.flixer.sh';
      
      // Helper to generate headers
      const generateHeaders = async (includeServer = false, server = null) => {
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
          .replace(/[/+=]/g, '').substring(0, 22);
        
        const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
        const encoder = new TextEncoder();
        const keyBytes = encoder.encode(apiKey);
        const messageBytes = encoder.encode(message);
        const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
        
        // Generate fingerprint
        const screen = window.screen;
        const nav = navigator;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.fillText('FP', 2, 2);
        const canvasData = canvas.toDataURL().substring(22, 50);
        const fpString = `${screen.width}x${screen.height}:${screen.colorDepth}:${nav.userAgent.substring(0, 50)}:${nav.platform}:${nav.language}:${new Date().getTimezoneOffset()}:${canvasData}`;
        let hash = 0;
        for (let i = 0; i < fpString.length; i++) {
          hash = (hash << 5) - hash + fpString.charCodeAt(i);
          hash &= hash;
        }
        const fingerprint = Math.abs(hash).toString(36);
        
        const headers = {
          'X-Api-Key': apiKey,
          'X-Request-Timestamp': timestamp.toString(),
          'X-Request-Nonce': nonce,
          'X-Request-Signature': signature,
          'X-Client-Fingerprint': fingerprint,
          'bW90aGFmYWth': '1',
          'Accept': 'text/plain'
        };
        
        if (includeServer && server) {
          headers['X-Only-Sources'] = '1';
          headers['X-Server'] = server;
        }
        
        return headers;
      };
      
      // First request to get server list
      const headers1 = await generateHeaders(false);
      const response1 = await fetch(`${baseUrl}${path}`, { headers: headers1 });
      const encrypted1 = await response1.text();
      const decrypted1 = await window.wasmImgData.process_img_data(encrypted1, apiKey);
      const data1 = JSON.parse(decrypted1);
      
      const servers = data1.sources?.map(s => s.server) || [];
      
      // Try each server
      const natoOrder = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
      const sortedServers = natoOrder.filter(s => servers.includes(s));
      
      for (const server of sortedServers) {
        // Make request with X-Server header
        const headers2 = await generateHeaders(true, server);
        const response2 = await fetch(`${baseUrl}${path}`, { headers: headers2 });
        const encrypted2 = await response2.text();
        const decrypted2 = await window.wasmImgData.process_img_data(encrypted2, apiKey);
        const data2 = JSON.parse(decrypted2);
        
        // Check for URL
        const source = data2.sources?.find(s => s.server === server && s.url);
        if (source && source.url) {
          return {
            success: true,
            server,
            url: source.url,
            skipTime: data2.skipTime
          };
        }
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 200));
      }
      
      return {
        success: false,
        servers,
        error: 'No URL found from any server'
      };
    }, path, type, tmdbId, seasonId, episodeId);

    return result;
  }
}

module.exports = { FlixerHybridService };

// Test when run directly
if (require.main === module) {
  (async () => {
    console.log('=== Flixer Hybrid Service Test ===\n');
    
    const service = new FlixerHybridService({ debug: true });
    
    try {
      await service.initialize();
      
      // Test TV show - Arcane S1E1
      console.log('\n--- Testing TV Show (Arcane S1E1) ---');
      const result = await service.getSource('tv', 94605, 1, 1);
      console.log('\nResult:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n✅ SUCCESS! Got m3u8 URL:', result.url);
      } else {
        console.log('\n❌ Failed to get URL');
      }
      
    } catch (e) {
      console.error('\n❌ Error:', e.message);
      if (e.stack) console.error(e.stack);
    } finally {
      await service.close();
    }
  })();
}
