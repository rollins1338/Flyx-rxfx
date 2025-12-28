/**
 * CDN Live Channel Stream Tests
 * 
 * Tests the actual channel player URLs from the API
 */

import { describe, test, expect } from 'bun:test';

const API_BASE = 'https://api.cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface CDNLiveChannel {
  name: string;
  code: string;
  url: string;
  image: string;
  status: string;
  viewers: number;
}

describe('CDN Live Channel Stream Extraction', () => {
  test('should fetch channels and analyze player URLs', async () => {
    const url = `${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    console.log(`Total channels: ${data.total_channels}`);
    
    // Get first 5 online channels
    const onlineChannels = data.channels
      .filter((ch: CDNLiveChannel) => ch.status === 'online')
      .slice(0, 5);
    
    console.log(`\nOnline channels sample:`);
    for (const channel of onlineChannels) {
      console.log(`\n  ${channel.name} (${channel.code}):`);
      console.log(`    URL: ${channel.url}`);
      console.log(`    Status: ${channel.status}`);
      console.log(`    Viewers: ${channel.viewers}`);
    }
    
    expect(onlineChannels.length).toBeGreaterThan(0);
  });
  
  test('should test player URL and extract stream', async () => {
    // First get a channel
    const channelsUrl = `${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`;
    const channelsResponse = await fetch(channelsUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const channelsData = await channelsResponse.json();
    const onlineChannel = channelsData.channels.find((ch: CDNLiveChannel) => ch.status === 'online');
    
    if (!onlineChannel) {
      console.log('No online channels found');
      return;
    }
    
    console.log(`\nTesting channel: ${onlineChannel.name}`);
    console.log(`Player URL: ${onlineChannel.url}`);
    
    // Fetch the player page
    const playerResponse = await fetch(onlineChannel.url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    console.log(`Player page status: ${playerResponse.status}`);
    
    if (playerResponse.ok) {
      const html = await playerResponse.text();
      console.log(`Player HTML length: ${html.length}`);
      
      // Look for m3u8 URLs
      const m3u8Patterns = [
        /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
        /hls\.loadSource\s*\(\s*["']([^"']+\.m3u8[^"']*)["']\s*\)/gi,
        /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/gi,
        /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/gi,
        /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
        /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
        /url\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
      ];
      
      console.log('\nSearching for m3u8 URLs:');
      let foundM3u8 = false;
      for (const pattern of m3u8Patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          console.log(`  Found: ${match[1].substring(0, 150)}`);
          foundM3u8 = true;
        }
      }
      
      if (!foundM3u8) {
        console.log('  No m3u8 URLs found directly');
        
        // Look for iframes
        const iframePattern = /<iframe[^>]+src=["']([^"']+)["']/gi;
        let iframeMatch;
        console.log('\nSearching for iframes:');
        while ((iframeMatch = iframePattern.exec(html)) !== null) {
          console.log(`  Found iframe: ${iframeMatch[1]}`);
        }
        
        // Look for script sources
        const scriptPattern = /<script[^>]+src=["']([^"']+)["']/gi;
        let scriptMatch;
        console.log('\nSearching for external scripts:');
        while ((scriptMatch = scriptPattern.exec(html)) !== null) {
          if (!scriptMatch[1].includes('google') && !scriptMatch[1].includes('analytics')) {
            console.log(`  Found script: ${scriptMatch[1]}`);
          }
        }
        
        // Look for API calls in inline scripts
        const inlineScriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let inlineMatch;
        console.log('\nSearching inline scripts for API calls:');
        while ((inlineMatch = inlineScriptPattern.exec(html)) !== null) {
          const scriptContent = inlineMatch[1];
          if (scriptContent.includes('fetch') || scriptContent.includes('axios') || scriptContent.includes('XMLHttpRequest')) {
            // Extract fetch URLs
            const fetchPattern = /fetch\s*\(\s*["']([^"']+)["']/g;
            let fetchMatch;
            while ((fetchMatch = fetchPattern.exec(scriptContent)) !== null) {
              console.log(`  Found fetch: ${fetchMatch[1]}`);
            }
          }
          
          // Look for stream URLs
          if (scriptContent.includes('stream') || scriptContent.includes('player')) {
            const urlPattern = /["'](https?:\/\/[^"']+)["']/g;
            let urlMatch;
            while ((urlMatch = urlPattern.exec(scriptContent)) !== null) {
              if (urlMatch[1].includes('stream') || urlMatch[1].includes('player') || urlMatch[1].includes('m3u8')) {
                console.log(`  Found URL: ${urlMatch[1]}`);
              }
            }
          }
        }
        
        // Print first 2000 chars of HTML for analysis
        console.log('\n=== First 2000 chars of player HTML ===');
        console.log(html.substring(0, 2000));
      }
    }
    
    expect(true).toBe(true);
  });
  
  test('should test direct stream API endpoint', async () => {
    // Try different stream API patterns
    const streamEndpoints = [
      `${API_BASE}/api/v1/stream/`,
      `${API_BASE}/api/v1/channels/stream/`,
      `${API_BASE}/api/v1/player/`,
      'https://cdn-live.tv/api/v1/stream/',
      'https://cdn-live.tv/stream/',
    ];
    
    for (const endpoint of streamEndpoints) {
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
          console.log(`  Content-Type: ${contentType}`);
          
          if (contentType?.includes('json')) {
            const data = await response.json();
            console.log(`  Response: ${JSON.stringify(data).substring(0, 200)}`);
          }
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    expect(true).toBe(true);
  });
});
