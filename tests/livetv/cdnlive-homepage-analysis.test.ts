/**
 * CDN Live Homepage Analysis
 * 
 * Analyze the main homepage to find events and streams
 */

import { describe, test, expect } from 'bun:test';

const CDN_LIVE_BASE = 'https://cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('CDN Live Homepage Analysis', () => {
  test('should analyze homepage structure', async () => {
    const response = await fetch(CDN_LIVE_BASE, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    expect(response.ok).toBe(true);
    
    const html = await response.text();
    console.log(`Homepage HTML length: ${html.length}`);
    
    // Look for channel cards/links
    const channelLinkPattern = /href=["']([^"']*(?:channel|player|watch|live)[^"']*)["']/gi;
    let linkMatch;
    const channelLinks: string[] = [];
    while ((linkMatch = channelLinkPattern.exec(html)) !== null) {
      if (!channelLinks.includes(linkMatch[1])) {
        channelLinks.push(linkMatch[1]);
      }
    }
    console.log(`\nChannel-related links found: ${channelLinks.length}`);
    channelLinks.slice(0, 10).forEach(link => console.log(`  ${link}`));
    
    // Look for onclick handlers
    const onclickPattern = /onclick=["']([^"']+)["']/gi;
    let onclickMatch;
    const onclicks: string[] = [];
    while ((onclickMatch = onclickPattern.exec(html)) !== null) {
      if (onclickMatch[1].includes('channel') || onclickMatch[1].includes('play') || onclickMatch[1].includes('stream')) {
        onclicks.push(onclickMatch[1]);
      }
    }
    console.log(`\nOnclick handlers: ${onclicks.length}`);
    onclicks.slice(0, 5).forEach(handler => console.log(`  ${handler}`));
    
    // Look for data attributes
    const dataAttrPattern = /data-([a-z-]+)=["']([^"']+)["']/gi;
    let dataMatch;
    const dataAttrs: string[] = [];
    while ((dataMatch = dataAttrPattern.exec(html)) !== null) {
      if (dataMatch[1].includes('channel') || dataMatch[1].includes('stream') || 
          dataMatch[1].includes('url') || dataMatch[1].includes('src')) {
        dataAttrs.push(`${dataMatch[1]}="${dataMatch[2]}"`);
      }
    }
    console.log(`\nData attributes: ${dataAttrs.length}`);
    dataAttrs.slice(0, 10).forEach(attr => console.log(`  ${attr}`));
    
    // Look for JavaScript variables with channel data
    const jsVarPattern = /(?:var|let|const)\s+(\w+)\s*=\s*(\[[^\]]+\]|\{[^}]+\})/gi;
    let jsMatch;
    console.log('\nJavaScript variables:');
    while ((jsMatch = jsVarPattern.exec(html)) !== null) {
      if (jsMatch[2].includes('channel') || jsMatch[2].includes('stream') || jsMatch[2].includes('url')) {
        console.log(`  ${jsMatch[1]} = ${jsMatch[2].substring(0, 200)}`);
      }
    }
    
    // Look for API calls in scripts
    const apiCallPattern = /fetch\s*\(\s*["']([^"']+)["']/gi;
    let apiMatch;
    console.log('\nAPI calls in scripts:');
    while ((apiMatch = apiCallPattern.exec(html)) !== null) {
      console.log(`  ${apiMatch[1]}`);
    }
    
    // Look for channel grid/list structure
    const gridPattern = /<div[^>]*class="[^"]*(?:channel|grid|card|item)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let gridMatch;
    let gridCount = 0;
    console.log('\nChannel grid items:');
    while ((gridMatch = gridPattern.exec(html)) !== null && gridCount < 3) {
      gridCount++;
      console.log(`\n  Item ${gridCount}:`);
      console.log(`  ${gridMatch[0].substring(0, 300)}`);
    }
    
    // Extract the main content area
    const mainPattern = /<main[^>]*>([\s\S]*?)<\/main>/i;
    const mainMatch = html.match(mainPattern);
    if (mainMatch) {
      console.log('\n=== Main content structure ===');
      console.log(mainMatch[1].substring(0, 2000));
    }
    
    // Look for channel images and their associated data
    const imgPattern = /<img[^>]*src=["']([^"']*channel[^"']*)["'][^>]*>/gi;
    let imgMatch;
    console.log('\nChannel images:');
    while ((imgMatch = imgPattern.exec(html)) !== null) {
      console.log(`  ${imgMatch[1]}`);
    }
    
    expect(true).toBe(true);
  });
  
  test('should try to decode obfuscated script', async () => {
    const playerUrl = `${CDN_LIVE_BASE}/api/v1/channels/player/?name=abc&code=us&user=cdnlivetv&plan=free`;
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const html = await response.text();
    
    // Extract the obfuscated script
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const scriptContent = match[1].trim();
      
      if (scriptContent.includes('_0xc69e') || scriptContent.includes('eval(function')) {
        console.log('Found obfuscated script');
        
        // Try to extract the encoded data
        const encodedPattern = /"([A-Z]+)"/g;
        let encodedMatch;
        const encodedStrings: string[] = [];
        while ((encodedMatch = encodedPattern.exec(scriptContent)) !== null) {
          if (encodedMatch[1].length > 100) {
            encodedStrings.push(encodedMatch[1]);
          }
        }
        
        console.log(`Found ${encodedStrings.length} encoded strings`);
        
        // The script uses a custom base conversion
        // Let's try to understand the pattern
        const decoderPattern = /function\s+_0xe66c[^}]+}/;
        const decoderMatch = scriptContent.match(decoderPattern);
        if (decoderMatch) {
          console.log('\nDecoder function:');
          console.log(decoderMatch[0]);
        }
        
        // Look for the eval call
        const evalPattern = /eval\(function\([^)]+\)\{[^}]+\}\([^)]+\)\)/;
        const evalMatch = scriptContent.match(evalPattern);
        if (evalMatch) {
          console.log('\nEval call structure:');
          console.log(evalMatch[0].substring(0, 500));
        }
        
        break;
      }
    }
    
    expect(true).toBe(true);
  });
  
  test('should check for alternative stream sources', async () => {
    // Check if there's a direct stream endpoint we can use
    const testUrls = [
      'https://edge.cdn-live-tv.ru/',
      'https://edge.cdn-live-tv.cfd/',
      'https://stream.cdn-live.tv/',
      'https://live.cdn-live.tv/',
    ];
    
    for (const testUrl of testUrls) {
      try {
        console.log(`\nTesting: ${testUrl}`);
        const response = await fetch(testUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://cdn-live.tv/',
          },
          signal: AbortSignal.timeout(5000),
        });
        
        console.log(`  Status: ${response.status}`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`  Response length: ${text.length}`);
          console.log(`  First 200 chars: ${text.substring(0, 200)}`);
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    expect(true).toBe(true);
  });
});
