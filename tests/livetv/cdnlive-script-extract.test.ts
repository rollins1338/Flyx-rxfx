/**
 * CDN Live Script Extraction Test
 * 
 * Extract and analyze the main player script
 */

import { describe, test, expect } from 'bun:test';

const CDN_LIVE_BASE = 'https://cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('CDN Live Script Extraction', () => {
  test('should extract and analyze main player script', async () => {
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
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const scriptContent = match[1].trim();
      
      // Find the large script (the player initialization)
      if (scriptContent.length > 10000) {
        console.log(`\n=== Large script found (${scriptContent.length} chars) ===\n`);
        
        // Look for specific patterns
        const patterns = [
          { name: 'OPlayer', pattern: /OPlayer/gi },
          { name: 'Player', pattern: /Player\s*\(/gi },
          { name: 'source', pattern: /source\s*[:=]/gi },
          { name: 'src', pattern: /src\s*[:=]/gi },
          { name: 'hls', pattern: /hls/gi },
          { name: 'm3u8', pattern: /m3u8/gi },
          { name: 'fetch', pattern: /fetch\s*\(/gi },
          { name: 'api', pattern: /\/api\//gi },
          { name: 'stream', pattern: /stream/gi },
          { name: 'url', pattern: /url\s*[:=]/gi },
        ];
        
        console.log('Pattern occurrences:');
        for (const { name, pattern } of patterns) {
          const matches = scriptContent.match(pattern);
          console.log(`  ${name}: ${matches?.length || 0}`);
        }
        
        // Extract function definitions
        const funcPattern = /function\s+(\w+)\s*\(/g;
        let funcMatch;
        const functions: string[] = [];
        while ((funcMatch = funcPattern.exec(scriptContent)) !== null) {
          functions.push(funcMatch[1]);
        }
        console.log(`\nFunctions defined: ${functions.join(', ')}`);
        
        // Look for the player initialization code
        const playerInitPattern = /(?:new\s+)?(?:OPlayer|Player)\s*\([^)]*\)/gi;
        const playerInits = scriptContent.match(playerInitPattern);
        if (playerInits) {
          console.log('\nPlayer initializations:');
          playerInits.forEach(init => console.log(`  ${init.substring(0, 200)}`));
        }
        
        // Look for source/stream configuration
        const sourceConfigPattern = /(?:source|src|stream)\s*[:=]\s*["']?([^"'\s,;]+)/gi;
        let sourceMatch;
        console.log('\nSource configurations:');
        while ((sourceMatch = sourceConfigPattern.exec(scriptContent)) !== null) {
          console.log(`  ${sourceMatch[0]}`);
        }
        
        // Look for API endpoints
        const apiPattern = /["']([^"']*\/api\/[^"']*)["']/gi;
        let apiMatch;
        console.log('\nAPI endpoints:');
        while ((apiMatch = apiPattern.exec(scriptContent)) !== null) {
          console.log(`  ${apiMatch[1]}`);
        }
        
        // Look for fetch calls
        const fetchPattern = /fetch\s*\(\s*["']([^"']+)["']/gi;
        let fetchMatch;
        console.log('\nFetch calls:');
        while ((fetchMatch = fetchPattern.exec(scriptContent)) !== null) {
          console.log(`  ${fetchMatch[1]}`);
        }
        
        // Look for variable assignments with URLs
        const urlVarPattern = /(?:const|let|var)\s+(\w+)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
        let urlVarMatch;
        console.log('\nURL variables:');
        while ((urlVarMatch = urlVarPattern.exec(scriptContent)) !== null) {
          console.log(`  ${urlVarMatch[1]} = ${urlVarMatch[2]}`);
        }
        
        // Print sections of the script that contain 'source' or 'stream'
        console.log('\n=== Script sections with "source" or "stream" ===');
        const lines = scriptContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes('source') || lines[i].toLowerCase().includes('stream')) {
            // Print context (2 lines before and after)
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            console.log(`\n--- Line ${i + 1} ---`);
            for (let j = start; j < end; j++) {
              console.log(`${j === i ? '>>>' : '   '} ${lines[j].substring(0, 150)}`);
            }
          }
        }
        
        // Print the first 3000 chars of the script
        console.log('\n=== First 3000 chars of script ===');
        console.log(scriptContent.substring(0, 3000));
        
        break;
      }
    }
    
    expect(true).toBe(true);
  });
});
