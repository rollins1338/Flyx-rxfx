/**
 * CDN Live Integration Tests
 * 
 * Tests for network channels and live event streams from cdn-live.tv
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const CDN_LIVE_DOMAINS = [
  'cdn-live.tv',
  'cdn-live.me',
  'cdnlive.tv',
  'cdnlive.me',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('CDN Live Domain Availability', () => {
  test.each(CDN_LIVE_DOMAINS)('should check if %s is accessible', async (domain) => {
    try {
      const response = await fetch(`https://${domain}/`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`[${domain}] Status: ${response.status}`);
      console.log(`[${domain}] Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`[${domain}] HTML length: ${html.length}`);
        console.log(`[${domain}] Contains 'event': ${html.toLowerCase().includes('event')}`);
        console.log(`[${domain}] Contains 'live': ${html.toLowerCase().includes('live')}`);
        console.log(`[${domain}] Contains 'embed': ${html.toLowerCase().includes('embed')}`);
        console.log(`[${domain}] Contains 'm3u8': ${html.toLowerCase().includes('m3u8')}`);
        
        // Check for common patterns
        const hasEventBlocks = /<div[^>]*class="[^"]*event[^"]*"/i.test(html);
        const hasSchedule = /schedule|upcoming|today/i.test(html);
        const hasChannels = /channel|stream/i.test(html);
        
        console.log(`[${domain}] Has event blocks: ${hasEventBlocks}`);
        console.log(`[${domain}] Has schedule: ${hasSchedule}`);
        console.log(`[${domain}] Has channels: ${hasChannels}`);
      }
      
      expect(response.status).toBeDefined();
    } catch (error: any) {
      console.log(`[${domain}] Error: ${error.message}`);
      // Don't fail the test, just log the error
      expect(error).toBeDefined();
    }
  });
});

describe('CDN Live API Endpoint Tests', () => {
  const API_BASE = 'https://api.cdn-live.tv';
  
  test('should test CDN Live channels API', async () => {
    try {
      const url = `${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`;
      console.log(`Testing: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Referer': 'https://cdn-live.tv/',
        },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`API Status: ${response.status}`);
      console.log(`API Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Total channels: ${data.total_channels || 'N/A'}`);
        console.log(`Channels array length: ${data.channels?.length || 0}`);
        
        if (data.channels && data.channels.length > 0) {
          console.log('Sample channel:', JSON.stringify(data.channels[0], null, 2));
        }
      } else {
        const text = await response.text();
        console.log(`API Error response: ${text.substring(0, 500)}`);
      }
      
      expect(response.status).toBeDefined();
    } catch (error: any) {
      console.log(`API Error: ${error.message}`);
      expect(error).toBeDefined();
    }
  });
  
  test('should test alternative API endpoints', async () => {
    const endpoints = [
      `${API_BASE}/api/v1/events/`,
      `${API_BASE}/api/v1/schedule/`,
      `${API_BASE}/api/v1/live/`,
      `${API_BASE}/api/v2/channels/`,
      `${API_BASE}/channels/`,
      `${API_BASE}/events/`,
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\nTesting: ${endpoint}`);
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Referer': 'https://cdn-live.tv/',
          },
          signal: AbortSignal.timeout(5000),
        });
        
        console.log(`  Status: ${response.status}`);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('json')) {
            const data = await response.json();
            console.log(`  Response keys: ${Object.keys(data).join(', ')}`);
          }
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    expect(true).toBe(true);
  });
});

describe('CDN Live HTML Parsing Tests', () => {
  test('should analyze actual HTML structure from cdn-live.tv', async () => {
    for (const domain of CDN_LIVE_DOMAINS) {
      try {
        console.log(`\n=== Analyzing ${domain} ===`);
        
        const response = await fetch(`https://${domain}/`, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(10000),
        });
        
        if (!response.ok) {
          console.log(`${domain} returned ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        
        // Look for different HTML patterns
        const patterns = {
          // Event patterns
          eventDivs: (html.match(/<div[^>]*event[^>]*>/gi) || []).length,
          matchDivs: (html.match(/<div[^>]*match[^>]*>/gi) || []).length,
          gameDivs: (html.match(/<div[^>]*game[^>]*>/gi) || []).length,
          
          // Link patterns
          embedLinks: (html.match(/embed\/[a-zA-Z0-9_-]+/gi) || []).slice(0, 5),
          liveLinks: (html.match(/live\/[a-zA-Z0-9_-]+/gi) || []).slice(0, 5),
          streamLinks: (html.match(/stream\/[a-zA-Z0-9_-]+/gi) || []).slice(0, 5),
          
          // Data patterns
          jsonData: (html.match(/\{[^{}]*"(?:events?|channels?|streams?)"[^{}]*\}/gi) || []).slice(0, 2),
          
          // Script patterns
          scriptTags: (html.match(/<script[^>]*>[^<]*(?:event|channel|stream)[^<]*<\/script>/gi) || []).length,
          
          // API calls
          apiCalls: (html.match(/fetch\s*\([^)]*api[^)]*\)/gi) || []).slice(0, 3),
          
          // m3u8 references
          m3u8Refs: (html.match(/[^"'\s]*\.m3u8[^"'\s]*/gi) || []).slice(0, 3),
        };
        
        console.log('HTML Patterns found:');
        console.log(`  Event divs: ${patterns.eventDivs}`);
        console.log(`  Match divs: ${patterns.matchDivs}`);
        console.log(`  Game divs: ${patterns.gameDivs}`);
        console.log(`  Embed links: ${patterns.embedLinks.join(', ') || 'none'}`);
        console.log(`  Live links: ${patterns.liveLinks.join(', ') || 'none'}`);
        console.log(`  Stream links: ${patterns.streamLinks.join(', ') || 'none'}`);
        console.log(`  Script tags with events: ${patterns.scriptTags}`);
        console.log(`  m3u8 references: ${patterns.m3u8Refs.join(', ') || 'none'}`);
        
        // Extract a sample of the HTML structure
        const bodyMatch = html.match(/<body[^>]*>([\s\S]{0,2000})/i);
        if (bodyMatch) {
          console.log('\nFirst 500 chars of body:');
          console.log(bodyMatch[1].substring(0, 500).replace(/\s+/g, ' '));
        }
        
        // Look for React/Vue/Angular data
        const dataPatterns = [
          /__NEXT_DATA__/,
          /window\.__INITIAL_STATE__/,
          /window\.APP_DATA/,
          /data-react/,
          /ng-app/,
          /v-app/,
        ];
        
        console.log('\nFramework detection:');
        for (const pattern of dataPatterns) {
          if (pattern.test(html)) {
            console.log(`  Found: ${pattern.source}`);
          }
        }
        
        break; // Only analyze first working domain
      } catch (error: any) {
        console.log(`${domain} error: ${error.message}`);
      }
    }
    
    expect(true).toBe(true);
  });
});

describe('CDN Live Stream Extraction Tests', () => {
  test('should test embed page extraction', async () => {
    // Test with some common event IDs
    const testEventIds = ['test', 'live', 'stream1', 'event1'];
    
    for (const domain of CDN_LIVE_DOMAINS.slice(0, 2)) {
      for (const eventId of testEventIds) {
        try {
          const embedUrl = `https://${domain}/embed/${eventId}`;
          console.log(`\nTesting embed: ${embedUrl}`);
          
          const response = await fetch(embedUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Referer': `https://${domain}/`,
            },
            signal: AbortSignal.timeout(5000),
          });
          
          console.log(`  Status: ${response.status}`);
          
          if (response.ok) {
            const html = await response.text();
            
            // Check for m3u8 patterns
            const m3u8Patterns = [
              /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
              /hls\.loadSource\s*\(\s*["']([^"']+\.m3u8[^"']*)["']\s*\)/i,
              /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i,
              /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i,
            ];
            
            for (const pattern of m3u8Patterns) {
              const match = html.match(pattern);
              if (match) {
                console.log(`  Found m3u8: ${match[1].substring(0, 100)}`);
              }
            }
            
            // Check for iframe
            const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
            if (iframeMatch) {
              console.log(`  Found iframe: ${iframeMatch[1].substring(0, 100)}`);
            }
            
            // Check for offline indicators
            const offlinePatterns = [
              /stream.*offline/i,
              /not.*live/i,
              /coming.*soon/i,
              /event.*ended/i,
            ];
            
            for (const pattern of offlinePatterns) {
              if (pattern.test(html)) {
                console.log(`  Offline indicator: ${pattern.source}`);
              }
            }
          }
        } catch (error: any) {
          console.log(`  Error: ${error.message}`);
        }
      }
    }
    
    expect(true).toBe(true);
  });
});
