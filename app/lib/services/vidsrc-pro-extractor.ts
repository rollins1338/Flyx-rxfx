/**
 * VidSrc Pro.RCP Stream Extractor
 * Production-ready extractor for VidSrc Pro streams
 */

import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

interface ExtractResult {
  success: boolean;
  url: string;
  divId: string;
  proRcpUrl: string;
}

export class VidsrcProExtractor {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private headless: boolean;

  constructor(options: { headless?: boolean } = {}) {
    this.headless = options.headless !== false;
  }

  private async fetch(url: string, options: { referer?: string; headers?: Record<string, string> } = {}): Promise<{ data: string; statusCode: number }> {
    const urlObj = new URL(url);
    const https = await import('https');
    const http = await import('http');
    const lib = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': options.referer || '',
          ...options.headers
        }
      }, (res) => {
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
    const hashElement = $('[data-hash]').first();
    if (hashElement.length) return hashElement.attr('data-hash') || null;

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
      
      if (style && style.includes('display:none') && id && content && content.length > 500) {
        result = { id, content };
        return false;
      }
    });
    
    return result;
  }

  private async getProRcpInfo(type: 'movie' | 'tv', tmdbId: string | number, season?: number, episode?: number): Promise<{ proRcpUrl: string; divId: string }> {
    const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
    
    const embedResp = await this.fetch(embedUrl);
    const dataHash = this.extractDataHash(embedResp.data);
    if (!dataHash) throw new Error('data-hash not found');

    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    const rcpResp = await this.fetch(rcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
    if (!iframeSrcMatch) throw new Error('ProRCP iframe not found');

    const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
    const proRcpResp = await this.fetch(proRcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const divInfo = this.extractHiddenDiv(proRcpResp.data);
    if (!divInfo) throw new Error('Hidden div not found');

    return { proRcpUrl, divId: divInfo.id };
  }

  private async extractM3U8WithPuppeteer(proRcpUrl: string, divId: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      
      await page.setExtraHTTPHeaders({
        'Referer': 'https://vidsrc-embed.ru/',
        'Origin': 'https://vidsrc-embed.ru'
      });

      await page.goto(proRcpUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      try {
        await page.waitForFunction(
          (divId) => window[divId] !== undefined,
          { timeout: 30000 },
          divId
        );
      } catch (e) {
        // Timeout, try to get value anyway
      }

      const m3u8Url = await page.evaluate((divId) => window[divId], divId);
      
      if (!m3u8Url) {
        throw new Error('M3U8 URL not found');
      }

      return m3u8Url;
    } finally {
      await browser.close();
    }
  }

  async extract(type: 'movie' | 'tv', tmdbId: string | number, season?: number, episode?: number): Promise<ExtractResult> {
    const { proRcpUrl, divId } = await this.getProRcpInfo(type, tmdbId, season, episode);
    const m3u8Url = await this.extractM3U8WithPuppeteer(proRcpUrl, divId);

    return {
      success: true,
      url: m3u8Url,
      divId,
      proRcpUrl
    };
  }

  async extractMovie(tmdbId: string | number): Promise<ExtractResult> {
    return await this.extract('movie', tmdbId);
  }

  async extractTvEpisode(tmdbId: string | number, season: number, episode: number): Promise<ExtractResult> {
    return await this.extract('tv', tmdbId, season, episode);
  }
}
