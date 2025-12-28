/**
 * PPV.to Integration Tests
 * 
 * Tests the PPV.to live streams API and stream extraction.
 */

import { describe, test, expect } from 'bun:test';

const PPV_API_BASE = 'https://api.ppvs.su/api';
const EMBED_BASE = 'https://pooembed.top';

describe('PPV.to Integration Tests', () => {
  
  describe('PPV Streams API', () => {
    
    test('should fetch streams list from PPV API', async () => {
      const response = await fetch(`${PPV_API_BASE}/streams`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://ppv.to',
          'Referer': 'https://ppv.to/',
        },
      });
      
      console.log('PPV API Status:', response.status);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      console.log('PPV API Response:', JSON.stringify(data, null, 2).substring(0, 1000));
      
      expect(data.success).toBe(true);
      expect(data.streams).toBeDefined();
      expect(Array.isArray(data.streams)).toBe(true);
      
      // Log categories and stream counts
      console.log('\nPPV Categories:');
      for (const cat of data.streams) {
        console.log(`  ${cat.category}: ${cat.streams?.length || 0} streams`);
      }
    });
    
    test('should have valid stream structure', async () => {
      const response = await fetch(`${PPV_API_BASE}/streams`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://ppv.to',
          'Referer': 'https://ppv.to/',
        },
      });
      
      const data = await response.json();
      
      // Find a category with streams
      const categoryWithStreams = data.streams.find((cat: any) => cat.streams?.length > 0);
      expect(categoryWithStreams).toBeDefined();
      
      if (categoryWithStreams) {
        const stream = categoryWithStreams.streams[0];
        console.log('\nSample stream:', JSON.stringify(stream, null, 2));
        
        // Check required fields
        expect(stream.id).toBeDefined();
        expect(stream.name).toBeDefined();
        expect(stream.uri_name).toBeDefined();
        
        console.log(`\nStream: ${stream.name}`);
        console.log(`  URI: ${stream.uri_name}`);
        console.log(`  Always Live: ${stream.always_live}`);
      }
    });
    
    test('should find 24/7 always-live streams', async () => {
      const response = await fetch(`${PPV_API_BASE}/streams`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://ppv.to',
          'Referer': 'https://ppv.to/',
        },
      });
      
      const data = await response.json();
      
      // Find 24/7 category or always_live streams
      const alwaysLiveCategory = data.streams.find((cat: any) => 
        cat.always_live || cat.category === '24/7 Streams'
      );
      
      console.log('\n24/7 Category:', alwaysLiveCategory?.category);
      
      if (alwaysLiveCategory?.streams?.length > 0) {
        console.log('Always-live streams:');
        for (const stream of alwaysLiveCategory.streams.slice(0, 5)) {
          console.log(`  - ${stream.name} (${stream.uri_name})`);
        }
      }
    });
  });
  
  describe('PPV Embed Extraction', () => {
    
    test('should fetch embed page', async () => {
      // First get a valid URI from the API
      const apiResponse = await fetch(`${PPV_API_BASE}/streams`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://ppv.to',
          'Referer': 'https://ppv.to/',
        },
      });
      
      const apiData = await apiResponse.json();
      
      // Find an always-live stream to test
      let testUri: string | null = null;
      for (const cat of apiData.streams) {
        if (cat.always_live && cat.streams?.length > 0) {
          testUri = cat.streams[0].uri_name;
          console.log(`Testing with always-live stream: ${cat.streams[0].name}`);
          break;
        }
      }
      
      if (!testUri) {
        // Fallback to any stream
        for (const cat of apiData.streams) {
          if (cat.streams?.length > 0) {
            testUri = cat.streams[0].uri_name;
            console.log(`Testing with stream: ${cat.streams[0].name}`);
            break;
          }
        }
      }
      
      expect(testUri).toBeDefined();
      
      const embedUrl = `${EMBED_BASE}/embed/${testUri}`;
      console.log(`\nFetching embed: ${embedUrl}`);
      
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': 'https://ppv.to/',
        },
      });
      
      console.log('Embed page status:', response.status);
      expect(response.ok).toBe(true);
      
      const html = await response.text();
      console.log('Embed page length:', html.length);
      console.log('Embed page preview:', html.substring(0, 500));
    });
    
    test('should extract m3u8 URL from embed page', async () => {
      // First get a valid URI from the API
      const apiResponse = await fetch(`${PPV_API_BASE}/streams`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://ppv.to',
          'Referer': 'https://ppv.to/',
        },
      });
      
      const apiData = await apiResponse.json();
      
      // Find an always-live stream to test
      let testUri: string | null = null;
      let testName: string | null = null;
      for (const cat of apiData.streams) {
        if (cat.always_live && cat.streams?.length > 0) {
          testUri = cat.streams[0].uri_name;
          testName = cat.streams[0].name;
          break;
        }
      }
      
      if (!testUri) {
        console.log('No always-live streams found, skipping extraction test');
        return;
      }
      
      console.log(`\nTesting extraction for: ${testName} (${testUri})`);
      
      const embedUrl = `${EMBED_BASE}/embed/${testUri}`;
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': 'https://ppv.to/',
        },
      });
      
      const html = await response.text();
      
      // Try extraction patterns
      let m3u8Url: string | null = null;
      let method: string | null = null;
      
      // Pattern 1: const src = atob("base64_string");
      const atobPattern = /const\s+src\s*=\s*atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/;
      const atobMatch = html.match(atobPattern);
      
      if (atobMatch) {
        const base64 = atobMatch[1];
        m3u8Url = Buffer.from(base64, 'base64').toString('utf-8');
        method = 'atob';
        console.log('Found via atob pattern');
      }
      
      // Pattern 2: Direct file URL in JWPlayer setup
      if (!m3u8Url) {
        const filePattern = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/;
        const fileMatch = html.match(filePattern);
        if (fileMatch) {
          m3u8Url = fileMatch[1];
          method = 'direct';
          console.log('Found via direct file pattern');
        }
      }
      
      // Pattern 3: Any m3u8 URL
      if (!m3u8Url) {
        const m3u8Pattern = /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/;
        const m3u8Match = html.match(m3u8Pattern);
        if (m3u8Match) {
          m3u8Url = m3u8Match[1];
          method = 'regex';
          console.log('Found via regex pattern');
        }
      }
      
      // Check for offline messages
      if (!m3u8Url) {
        if (html.includes('not live') || html.includes('offline') || html.includes('coming soon')) {
          console.log('Stream is not currently live');
          return;
        }
        
        // Log HTML for debugging
        console.log('\nCould not extract m3u8. HTML content:');
        console.log(html.substring(0, 2000));
        
        // Look for any interesting patterns
        const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
        if (scriptMatches) {
          console.log(`\nFound ${scriptMatches.length} script tags`);
          for (const script of scriptMatches.slice(0, 3)) {
            console.log('Script preview:', script.substring(0, 300));
          }
        }
      }
      
      if (m3u8Url) {
        console.log(`\nExtracted m3u8 URL (${method}): ${m3u8Url}`);
        
        // Verify the m3u8 is accessible
        const m3u8Response = await fetch(m3u8Url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://pooembed.top/',
            'Origin': 'https://pooembed.top',
          },
        });
        
        console.log('M3U8 response status:', m3u8Response.status);
        
        if (m3u8Response.ok) {
          const m3u8Content = await m3u8Response.text();
          console.log('M3U8 content preview:', m3u8Content.substring(0, 500));
          expect(m3u8Content).toContain('#EXTM3U');
        }
      }
    });
  });
});
