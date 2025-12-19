#!/usr/bin/env node
/**
 * Fetch the DLHD player page and extract ALL variables
 */

const https = require('https');

async function main() {
  console.log('Fetching player page...\n');
  
  const html = await new Promise((resolve) => {
    https.get('https://epicplayplay.cfd/premiumtv/daddyhd.php?id=51', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (e) => resolve('ERROR: ' + e.message));
  });
  
  console.log('=== Looking for all variables ===\n');
  
  // Find all variable assignments
  const varMatches = html.matchAll(/(?:var|const|let)?\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']([^"']+)["']/g);
  for (const match of varMatches) {
    console.log(`${match[1]} = "${match[2].substring(0, 60)}${match[2].length > 60 ? '...' : ''}"`);
  }
  
  console.log('\n=== Looking for token/key patterns ===\n');
  
  // Look for specific patterns
  const patterns = [
    /AUTH_TOKEN\s*=\s*["']([^"']+)["']/,
    /CHANNEL_KEY\s*=\s*["']([^"']+)["']/,
    /CLIENT_TOKEN\s*=\s*["']([^"']+)["']/,
    /SESSION_TOKEN\s*=\s*["']([^"']+)["']/,
    /HB_URL\s*=\s*["']([^"']+)["']/,
    /HEARTBEAT\s*=\s*["']([^"']+)["']/,
    /token["']?\s*[:=]\s*["']([^"']+)["']/gi,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      console.log(`Found: ${pattern.source.substring(0, 30)}... = "${match[1].substring(0, 50)}..."`);
    }
  }
  
  console.log('\n=== Script tags ===\n');
  
  // Find script content
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  let scriptNum = 0;
  for (const match of scriptMatches) {
    scriptNum++;
    const content = match[1].trim();
    if (content.length > 0 && content.length < 5000) {
      console.log(`\n--- Script ${scriptNum} (${content.length} chars) ---`);
      console.log(content.substring(0, 1000));
      if (content.length > 1000) console.log('...[truncated]');
    }
  }
  
  console.log('\n=== Looking for heartbeat calls ===\n');
  
  // Look for heartbeat/fetch calls
  const hbPatterns = [
    /heartbeat/gi,
    /fetch\s*\([^)]+\)/gi,
    /XMLHttpRequest/gi,
  ];
  
  for (const pattern of hbPatterns) {
    const matches = html.match(pattern);
    if (matches) {
      console.log(`${pattern.source}: ${matches.length} matches`);
    }
  }
}

main().catch(console.error);
