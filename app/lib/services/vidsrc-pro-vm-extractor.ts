/**
 * VidSrc Pro Stream Extractor - VM-Based (No Puppeteer)
 * 
 * This extractor uses Node.js VM to execute the decoder script,
 * eliminating the need for browser automation in most cases.
 * 
 * Falls back to Puppeteer only if VM execution fails.
 */

import * as cheerio from 'cheerio';
import * as vm from 'vm';
import * as https from 'https';
import * as http from 'http';

interface ExtractResult {
  success: boolean;
  url: string;
  divId: string;
  proRcpUrl: string;
  method: 'vm' | 'puppeteer';
}

interface FetchOptions {
  referer?: string;
  headers?: Record<string, string>;
}

export class VidsrcProVMExtractor {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private debug: boolean;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug || false;
  }

  private log(...args: any[]): void {
    if (this.debug) console.log('[VidsrcProVM]', ...args);
  }

  private async fetch(url: string, options: FetchOptions = {}): Promise<{ data: string; statusCode: number }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const lib = urlObj.protocol === 'https:' ? https : http;

      const req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': options.referer || '',
          ...options.headers
        }
      }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
          return this.fetch(redirectUrl, options).then(resolve).catch(reject);
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, statusCode: res.statusCode || 200 }));
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  private buildEmbedUrl(type: 'movie' | 'tv', tmdbId: string | number, season?: number, episode?: number): string {
    let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      url += `/${season}/${episode}`;
    }
    return url;
  }

  private extractDataHash(html: string): string | null {
    const $ = cheerio.load(html);
    
    // Try data-hash attribute
    const hashElement = $('[data-hash]').first();
    if (hashElement.length) {
      const hash = hashElement.attr('data-hash');
      if (hash) return hash;
    }

    // Try to find in scripts
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (content) {
        const match = content.match(/data-hash=["']([^"']+)["']/);
        if (match) return match[1];
      }
    }
    
    return null;
  }

  private extractHiddenDiv(html: string): { id: string; content: string } | null {
    const $ = cheerio.load(html);
    let result: { id: string; content: string } | null = null;
    
    $('div').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style');
      const id = $elem.attr('id');
      const content = $elem.html();
      
      // Look for hidden div with substantial content
      if (style && style.includes('display:none') && id && content && content.length > 500) {
        result = { id, content };
        return false; // break
      }
    });
    
    return result;
  }

  private extractDecoderScriptUrl(html: string): string | null {
    const $ = cheerio.load(html);
    let decoderUrl: string | null = null;
    
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (!src) return;
      
      // Pattern 1: /[randomString]/[md5Hash].js
      if (src.match(/^\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js$/)) {
        decoderUrl = src;
        return false; // break
      }
      
      // Pattern 2: Any relative path with MD5 hash
      if (src.startsWith('/') && !src.startsWith('//') && src.match(/[a-f0-9]{32}/)) {
        decoderUrl = src;
        return false; // break
      }
      
      // Pattern 3: Suspicious relative JS (not common libraries)
      if (src.startsWith('/') && !src.startsWith('//') && src.endsWith('.js') && 
          !src.includes('jquery') && !src.includes('playerjs') && !src.includes('player') &&
          !src.includes('hls') && !src.includes('dash')) {
        decoderUrl = src;
        // Don't break, keep looking for better matches
      }
    });
    
    return decoderUrl;
  }

  private decodeInVM(decoderScript: string, divId: string, divContent: string): string | null {
    this.log('🔧 Executing decoder in VM...');
    
    try {
      // Create sandbox environment that mimics browser
      const sandbox: any = {
        window: {},
        document: {
          getElementById: (id: string) => {
            if (id === divId) {
              return {
                textContent: divContent,
                innerHTML: divContent,
                innerText: divContent
              };
            }
            return null;
          },
          querySelector: () => null,
          querySelectorAll: () => [],
          createElement: () => ({}),
          body: { dataset: {} }
        },
        console: this.debug ? console : { log: () => {}, error: () => {}, warn: () => {} },
        atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
        setTimeout: () => {},
        setInterval: () => {},
        clearTimeout: () => {},
        clearInterval: () => {},
        $: () => ({ data: () => null, attr: () => null })
      };
      
      // Make window properties accessible
      sandbox.window = new Proxy(sandbox.window, {
        get: (target: any, prop: string) => {
          if (prop in target) return target[prop];
          if (prop in sandbox) return sandbox[prop];
          return undefined;
        },
        set: (target: any, prop: string, value: any) => {
          target[prop] = value;
          return true;
        }
      });

      // Create VM context
      const context = vm.createContext(sandbox);
      
      // Execute the decoder script
      vm.runInContext(decoderScript, context, {
        timeout: 5000,
        displayErrors: true
      });
      
      // Check if the variable was created
      if (sandbox.window[divId]) {
        this.log('✅ Decoder executed successfully (window)');
        return sandbox.window[divId];
      }
      
      // Sometimes the variable is set directly in the sandbox
      if (sandbox[divId]) {
        this.log('✅ Decoder executed successfully (direct)');
        return sandbox[divId];
      }
      
      this.log('⚠️  Variable not found after execution');
      if (this.debug) {
        this.log('Available in window:', Object.keys(sandbox.window).slice(0, 10));
        this.log('Available in sandbox:', Object.keys(sandbox).slice(0, 10));
      }
      
      return null;
    } catch (error) {
      this.log('❌ VM execution error:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async extract(type: 'movie' | 'tv', tmdbId: string | number, season?: number, episode?: number): Promise<ExtractResult> {
    this.log('\n🚀 Starting VM-based extraction...\n');

    try {
      // Step 1: Get data-hash from embed page
      this.log('📡 Step 1: Fetching embed page...');
      const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
      const embedResp = await this.fetch(embedUrl);
      const dataHash = this.extractDataHash(embedResp.data);
      
      if (!dataHash) throw new Error('data-hash not found');
      this.log('✅ Data hash extracted');

      // Step 2: Get ProRCP URL from RCP page
      this.log('\n📡 Step 2: Fetching RCP page...');
      const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
      const rcpResp = await this.fetch(rcpUrl, { 
        referer: 'https://vidsrc-embed.ru/',
        headers: { 'Origin': 'https://vidsrc-embed.ru' }
      });
      
      const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
      if (!iframeSrcMatch) throw new Error('ProRCP iframe not found');
      
      const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
      this.log('✅ ProRCP URL obtained');

      // Step 3: Get hidden div and decoder script from ProRCP page
      this.log('\n📡 Step 3: Fetching ProRCP page...');
      const proRcpResp = await this.fetch(proRcpUrl, { 
        referer: 'https://vidsrc-embed.ru/',
        headers: { 'Origin': 'https://vidsrc-embed.ru' }
      });
      
      const divInfo = this.extractHiddenDiv(proRcpResp.data);
      if (!divInfo) throw new Error('Hidden div not found');
      this.log('✅ Div ID:', divInfo.id);
      this.log('✅ Div content length:', divInfo.content.length);
      
      const decoderScriptPath = this.extractDecoderScriptUrl(proRcpResp.data);
      if (!decoderScriptPath) throw new Error('Decoder script not found');
      this.log('✅ Decoder script path:', decoderScriptPath);

      // Step 4: Download decoder script
      this.log('\n📡 Step 4: Downloading decoder script...');
      const decoderUrl = `https://cloudnestra.com${decoderScriptPath}`;
      const decoderResp = await this.fetch(decoderUrl, {
        referer: proRcpUrl,
        headers: { 'Origin': 'https://cloudnestra.com' }
      });
      this.log('✅ Decoder script downloaded:', decoderResp.data.length, 'bytes');

      // Step 5: Execute decoder in VM
      this.log('\n🔧 Step 5: Executing decoder in VM...');
      const m3u8Url = this.decodeInVM(decoderResp.data, divInfo.id, divInfo.content);
      
      if (!m3u8Url) {
        throw new Error('Failed to decode M3U8 URL in VM');
      }

      this.log('✅ M3U8 URL extracted successfully\n');

      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        proRcpUrl: proRcpUrl,
        method: 'vm'
      };

    } catch (error) {
      this.log('❌ VM extraction failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async extractMovie(tmdbId: string | number): Promise<ExtractResult> {
    return await this.extract('movie', tmdbId);
  }

  async extractTvEpisode(tmdbId: string | number, season: number, episode: number): Promise<ExtractResult> {
    return await this.extract('tv', tmdbId, season, episode);
  }
}
