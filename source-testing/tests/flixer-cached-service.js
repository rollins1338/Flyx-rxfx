/**
 * Flixer Cached Decryption Service
 * 
 * Uses Puppeteer to get the decryption key once, then caches it for reuse.
 * The key is session-based and can be reused for multiple decryption operations.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

class FlixerCachedService {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.apiKey = null;
    this.initialized = false;
    this.options = {
      headless: 'new',
      timeout: 60000,
      ...options,
    };
  }
  
  async initialize() {
    if (this.initialized) return this.apiKey;
    
    console.log('[FlixerCached] Initializing browser...');
    
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
    
    // Get the API key
    this.apiKey = await this.page.evaluate(() => window.wasmImgData.get_img_key());
    
    console.log(`[FlixerCached] Got API key: ${this.apiKey.slice(0, 16)}...`);
    this.initialized = true;
    
    return this.apiKey;
  }
  
  async decrypt(encryptedData) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Use the page to decrypt
    const decrypted = await this.page.evaluate(async (data, key) => {
      try {
        return await window.wasmImgData.process_img_data(data, key);
      } catch (e) {
        return { error: e.message };
      }
    }, encryptedData, this.apiKey);
    
    if (decrypted.error) {
      throw new Error(decrypted.error);
    }
    
    return decrypted;
  }
  
  async fetchAndDecrypt(path, headers = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const result = await this.page.evaluate(async (path, apiKey, extraHeaders) => {
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
          ...extraHeaders,
        },
      });
      
      if (!response.ok) {
        return { error: `HTTP ${response.status}`, body: await response.text() };
      }
      
      const encryptedData = await response.text();
      
      try {
        const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
        return { success: true, data: JSON.parse(decrypted) };
      } catch (e) {
        return { error: e.message };
      }
    }, path, this.apiKey, headers);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.data;
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.initialized = false;
      this.apiKey = null;
      console.log('[FlixerCached] Closed');
    }
  }
}

// Test
async function test() {
  console.log('=== Testing Flixer Cached Service ===\n');
  
  const service = new FlixerCachedService();
  
  try {
    // Initialize and get key
    const key = await service.initialize();
    console.log('API Key:', key);
    
    // Test fetching sources
    console.log('\n--- Fetching TV sources ---');
    const tvData = await service.fetchAndDecrypt('/api/tmdb/tv/106379/season/1/episode/1/images');
    console.log('TV Data:', JSON.stringify(tvData, null, 2).slice(0, 500) + '...');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await service.close();
  }
}

module.exports = { FlixerCachedService };

if (require.main === module) {
  test().catch(console.error);
}
