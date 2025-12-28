/**
 * CDN Live Player Analysis Tests
 * 
 * Deep analysis of the player page to find stream URLs
 */

import { describe, test, expect } from 'bun:test';

const API_BASE = 'https://api.cdn-live.tv';
const CDN_LIVE_BASE = 'https://cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('CDN Live Player Deep Analysis', () => {
  test('should analyze full player page HTML', async () => {
    const playerUrl = `${CDN_LIVE_BASE}/api/v1/channels/player/?name=abc&code=us&user=cdnlivetv&plan=free`;
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    expect(response.ok).toBe(true);
    
    const html = await response.text();
    
    // Extract all inline scripts
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptIndex = 0;
    
    console.log('=== Analyzing inline scripts ===\n');
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const scriptContent = match[1].trim();
      if (scriptContent.length > 50) {
        scriptIndex++;
        console.log(`\n--- Script ${scriptIndex} (${scriptContent.length} chars) ---`);
        
        // Look for OPlayer initialization
        if (scriptContent.includes('OPlayer') || scriptContent.includes('oplayer')) {
          console.log('Found OPlayer initialization!');
          console.log(scriptContent);
        }
        
        // Look for stream/source configuration
        if (scriptContent.includes('source') || scriptContent.includes('stream') || scriptContent.includes('hls')) {
          console.log('Found stream-related script!');
          console.log(scriptContent.substring(0, 2000));
        }
        
        // Look for fetch/API calls
        if (scriptContent.includes('fetch') || scriptContent.includes('/api/')) {
          console.log('Found API call script!');
          console.log(scriptContent.substring(0, 1500));
        }
        
        // Look for any URLs
        const urlPattern = /["'](https?:\/\/[^"']+)["']/g;
        let urlMatch;
        const urls: string[] = [];
        while ((urlMatch = urlPattern.exec(scriptContent)) !== null) {
          if (!urlMatch[1].includes('google') && 
              !urlMatch[1].includes('cloudflare') && 
              !urlMatch[1].includes('jsdelivr') &&
              !urlMatch[1].includes('acscdn')) {
            urls.push(urlMatch[1]);
          }
        }
        if (urls.length > 0) {
          console.log('URLs found:', urls);
        }
      }
    }
    
    // Look for data attributes
    console.log('\n=== Looking for data attributes ===');
    const dataAttrPattern = /data-[a-z-]+="([^"]+)"/gi;
    let dataMatch;
    while ((dataMatch = dataAttrPattern.exec(html)) !== null) {
      if (dataMatch[1].includes('http') || dataMatch[1].includes('stream') || dataMatch[1].includes('m3u8')) {
        console.log(`Found data attribute: ${dataMatch[0]}`);
      }
    }
    
    // Look for JSON data in the page
    console.log('\n=== Looking for JSON data ===');
    const jsonPattern = /\{[^{}]*"(?:url|source|stream|src)"[^{}]*\}/gi;
    let jsonMatch;
    while ((jsonMatch = jsonPattern.exec(html)) !== null) {
      console.log(`Found JSON: ${jsonMatch[0]}`);
    }
    
    expect(true).toBe(true);
  });
  
  test('should test stream API with channel parameters', async () => {
    // Based on the player URL pattern, try to find the stream API
    const streamEndpoints = [
      `${API_BASE}/api/v1/channels/stream/?name=abc&code=us&user=cdnlivetv&plan=free`,
      `${API_BASE}/api/v1/stream/?name=abc&code=us&user=cdnlivetv&plan=free`,
      `${API_BASE}/api/v1/channels/hls/?name=abc&code=us&user=cdnlivetv&plan=free`,
      `${CDN_LIVE_BASE}/api/v1/channels/stream/?name=abc&code=us&user=cdnlivetv&plan=free`,
      `${CDN_LIVE_BASE}/api/v1/stream/?name=abc&code=us&user=cdnlivetv&plan=free`,
    ];
    
    for (const endpoint of streamEndpoints) {
      try {
        console.log(`\nTesting: ${endpoint}`);
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://cdn-live.tv/',
          },
          signal: AbortSignal.timeout(5000),
        });
        
        console.log(`  Status: ${response.status}`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`  Response: ${text.substring(0, 500)}`);
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    expect(true).toBe(true);
  });
  
  test('should analyze events page for live sports', async () => {
    // Try to find events/sports page
    const eventPages = [
      `${CDN_LIVE_BASE}/events`,
      `${CDN_LIVE_BASE}/sports`,
      `${CDN_LIVE_BASE}/live`,
      `${CDN_LIVE_BASE}/schedule`,
      `${API_BASE}/api/v1/events/?user=cdnlivetv&plan=free`,
      `${API_BASE}/api/v1/sports/?user=cdnlivetv&plan=free`,
      `${API_BASE}/api/v1/schedule/?user=cdnlivetv&plan=free`,
    ];
    
    for (const url of eventPages) {
      try {
        console.log(`\nTesting: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/json,*/*',
            'Referer': 'https://cdn-live.tv/',
          },
          signal: AbortSignal.timeout(5000),
        });
        
        console.log(`  Status: ${response.status}`);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          console.log(`  Content-Type: ${contentType}`);
          
          const text = await response.text();
          console.log(`  Length: ${text.length}`);
          
          // Check for event-related content
          if (text.includes('event') || text.includes('match') || text.includes('game')) {
            console.log('  Contains event-related content!');
            
            // Look for event links
            const eventLinkPattern = /href=["']([^"']*(?:event|match|game)[^"']*)["']/gi;
            let linkMatch;
            const links: string[] = [];
            while ((linkMatch = eventLinkPattern.exec(text)) !== null) {
              links.push(linkMatch[1]);
            }
            if (links.length > 0) {
              console.log(`  Event links: ${links.slice(0, 5).join(', ')}`);
            }
          }
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    expect(true).toBe(true);
  });
});
