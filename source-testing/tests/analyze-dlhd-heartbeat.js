#!/usr/bin/env node
/**
 * Analyze DLHD player page to find heartbeat implementation
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
  
  // Find the script that contains heartbeat logic
  console.log('=== Looking for heartbeat-related code ===\n');
  
  // Find all script content
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    const content = match[1].trim();
    if (content.includes('heartbeat') || content.includes('hb_url') || content.includes('HB_URL')) {
      console.log('=== HEARTBEAT SCRIPT FOUND ===');
      console.log(content);
      console.log('\n=== END SCRIPT ===\n');
    }
  }
  
  // Look for specific patterns
  console.log('\n=== Searching for token patterns ===\n');
  
  const patterns = [
    /client[_-]?token/gi,
    /session[_-]?token/gi,
    /hb[_-]?url/gi,
    /heartbeat[^a-z]/gi,
    /X-Client-Token/gi,
    /X-Session/gi,
    /Bearer/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      console.log(`${pattern.source}: ${matches.length} matches`);
      // Show context around first match
      const idx = html.search(pattern);
      if (idx >= 0) {
        console.log(`  Context: ...${html.substring(Math.max(0, idx - 30), idx + 100)}...`);
      }
    }
  }
  
  // Look for the obfuscated heartbeat function
  console.log('\n=== Looking for heartbeat URL construction ===\n');
  
  // Find kiko2.ru references
  const kikoMatches = html.match(/[a-z]+\.kiko2\.ru/gi);
  if (kikoMatches) {
    console.log('kiko2.ru domains found:', [...new Set(kikoMatches)]);
  }
  
  // Find giokko.ru references
  const giokkoMatches = html.match(/[a-z]+\.giokko\.ru/gi);
  if (giokkoMatches) {
    console.log('giokko.ru domains found:', [...new Set(giokkoMatches)]);
  }
  
  // Look for fetch calls with heartbeat
  const fetchHeartbeat = html.match(/fetch\s*\([^)]*heartbeat[^)]*\)/gi);
  if (fetchHeartbeat) {
    console.log('\nFetch heartbeat calls:', fetchHeartbeat);
  }
  
  // Look for the var_bacfa3ff20 pattern (obfuscated AUTH_TOKEN)
  console.log('\n=== Obfuscated variable mappings ===\n');
  const varMappings = html.matchAll(/const\s+(var_[a-f0-9]+)\s*=\s*["']([^"']+)["']/g);
  for (const match of varMappings) {
    console.log(`${match[1]} = "${match[2].substring(0, 40)}${match[2].length > 40 ? '...' : ''}"`);
  }
}

main().catch(console.error);
