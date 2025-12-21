/**
 * Flixer Decryption Service
 * 
 * A production-ready service that uses Puppeteer to decrypt Flixer API responses.
 * This is the practical solution since the exact key derivation algorithm is obfuscated.
 * 
 * Usage:
 *   const service = new FlixerDecryptionService();
 *   await service.initialize();
 *   const sources = await service.getSources('tv', 106379, 1, 1);
 *   await service.close();
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class FlixerDecryptionService {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.sessionKey = null;
    this.initialized = false;
    this.options = {
      headless: 'new',
      timeout: 60000,
      ...options,
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    console.log('[FlixerService] Initializing...');
    
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    this.page = await this.browser.newPage();
    
    // Navigate to Flixer to initialize WASM
    await this.page.goto('https://flixer.sh/watch/tv/106379/1/1', {
      waitUntil: 'networkidle2',
      timeout: this.options.timeout,
    });
    
    // Wait for WASM to be ready
    await this.page.waitForFunction(() => window.wasmImgData?.ready, {
      timeout: 30000,
    });
    
    // Get the session key
    this.sessionKey = await this.page.evaluate(() => window.wasmImgData.get_img_key());
    
    console.log(`[FlixerService] Initialized with key: ${this.sessionKey.slice(0, 16)}...`);
    this.initialized = true;
  }
  
  async getSources(type, tmdbId, seasonId = null, episodeId = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const path = type === 'movie'
      ? `/api/tmdb/movie/${tmdbId}/images`
      : `/api/tmdb/tv/${tmdbId}/season/${seasonId}/episode/${episodeId}/images`;
    
    console.log(`[FlixerService] Fetching sources for ${path}`);
    
    const result = await this.page.evaluate(async (path, type) => {
      const apiKey = window.wasmImgData.get_img_key();
      
      // Generate request authentication
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
        .replace(/[/+=]/g, '').substring(0, 22);
      
      const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      
      // Fetch server list
      const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
        headers: {
          'X-Api-Key': apiKey,
          'X-Request-Timestamp': timestamp.toString(),
          'X-Request-Nonce': nonce,
          'X-Request-Signature': signature,
          'X-Client-Fingerprint': 'service',
          'bW90aGFmYWth': '1',
          'Accept': 'text/plain',
        },
      });
      
      if (!response.ok) {
        return { error: `HTTP ${response.status}`, body: await response.text() };
      }
      
      const encryptedData = await response.text();
      
      try {
        const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
        const parsed = JSON.parse(decrypted);
        
        // Get server list
        const servers = parsed.servers ? Object.keys(parsed.servers) : 
                       parsed.sources ? parsed.sources.map(s => s.server) : [];
        
        return { success: true, servers, raw: parsed };
      } catch (e) {
        return { error: e.message };
      }
    }, path, type);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Fetch sources from each server
    const sources = {};
    
    for (const server of result.servers.slice(0, 5)) { // Limit to first 5 servers
      try {
        const sourceResult = await this.page.evaluate(async (path, server) => {
          const apiKey = window.wasmImgData.get_img_key();
          
          const timestamp = Math.floor(Date.now() / 1000);
          const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
            .replace(/[/+=]/g, '').substring(0, 22);
          
          const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
          
          const encoder = new TextEncoder();
          const keyData = encoder.encode(apiKey);
          const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
          );
          const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
          const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
          
          const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
            headers: {
              'X-Api-Key': apiKey,
              'X-Request-Timestamp': timestamp.toString(),
              'X-Request-Nonce': nonce,
              'X-Request-Signature': signature,
              'X-Client-Fingerprint': 'service',
              'bW90aGFmYWth': '1',
              'Accept': 'text/plain',
              'X-Only-Sources': '1',
              'X-Server': server,
            },
          });
          
          if (!response.ok) {
            return { error: `HTTP ${response.status}` };
          }
          
          const encryptedData = await response.text();
          
          try {
            const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
            const parsed = JSON.parse(decrypted);
            
            // Extract URL
            let url = null;
            if (Array.isArray(parsed.sources)) {
              const source = parsed.sources.find(s => s.server === server || s.server);
              url = source?.url || source?.file;
            } else if (parsed.sources?.file) {
              url = parsed.sources.file;
            } else if (parsed.sources?.url) {
              url = parsed.sources.url;
            }
            
            return { success: true, url };
          } catch (e) {
            return { error: e.message };
          }
        }, path, server);
        
        if (sourceResult.success && sourceResult.url) {
          sources[server] = sourceResult.url;
          console.log(`[FlixerService] Found source from ${server}`);
        }
      } catch (e) {
        console.log(`[FlixerService] Error fetching from ${server}: ${e.message}`);
      }
    }
    
    return sources;
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.initialized = false;
      console.log('[FlixerService] Closed');
    }
  }
}

// Test the service
async function testService() {
  console.log('=== Testing Flixer Decryption Service ===\n');
  
  const service = new FlixerDecryptionService();
  
  try {
    await service.initialize();
    
    // Test TV show
    console.log('\n--- Testing TV Show ---');
    const tvSources = await service.getSources('tv', 106379, 1, 1);
    console.log('TV Sources:', tvSources);
    
    // Test movie
    console.log('\n--- Testing Movie ---');
    const movieSources = await service.getSources('movie', 550);
    console.log('Movie Sources:', movieSources);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await service.close();
  }
}

// Export for use as module
module.exports = { FlixerDecryptionService };

// Run test if executed directly
if (require.main === module) {
  testService().catch(console.error);
}
