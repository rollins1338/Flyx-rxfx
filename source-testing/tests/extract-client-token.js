#!/usr/bin/env node
/**
 * Extract the CLIENT_TOKEN generation logic from DLHD player
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
  
  // Find generateClientToken function
  console.log('=== Looking for generateClientToken function ===\n');
  
  // Look for the function definition
  const funcMatch = html.match(/function\s+generateClientToken\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/);
  if (funcMatch) {
    console.log('Found generateClientToken:');
    console.log(funcMatch[0]);
  }
  
  // Look for CLIENT_TOKEN assignment
  console.log('\n=== Looking for CLIENT_TOKEN assignment ===\n');
  const clientTokenMatch = html.match(/CLIENT_TOKEN\s*=\s*[^;]+;/g);
  if (clientTokenMatch) {
    console.log('CLIENT_TOKEN assignments:', clientTokenMatch);
  }
  
  // Look for the full script block containing generateClientToken
  console.log('\n=== Full script with generateClientToken ===\n');
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    const content = match[1].trim();
    if (content.includes('generateClientToken')) {
      console.log(content);
      console.log('\n=== END ===\n');
    }
  }
  
  // Look for SECRET usage
  console.log('\n=== SECRET usage ===\n');
  const secretUsage = html.match(/SECRET[^;]*;/g);
  if (secretUsage) {
    console.log('SECRET usages:', secretUsage);
  }
  
  // Look for btoa/atob usage (base64)
  console.log('\n=== Base64 encoding patterns ===\n');
  const btoaMatch = html.match(/btoa\s*\([^)]+\)/g);
  if (btoaMatch) {
    console.log('btoa calls:', btoaMatch.slice(0, 5));
  }
}

main().catch(console.error);
