#!/usr/bin/env node
/**
 * Debug a specific channel to find what's wrong
 */

const https = require('https');

// Get channel from command line or use default
const CHANNEL = process.argv[2] || '51';
const channelKey = `premium${CHANNEL}`;

console.log(`\nDebugging channel ${CHANNEL} (${channelKey})...\n`);

// ALL known server keys
const ALL_SERVER_KEYS = ['zeko', 'wind', 'nfs', 'ddy6', 'chevy', 'top1/cdn'];

// Both domains to try
const DOMAINS = ['kiko2.ru', 'giokko.ru'];

function constructM3U8Url(serverKey, channelKey, domain) {
  if (serverKey === 'top1/cdn') {
    return `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
  }
  return `https://${serverKey}new.${domain}/${serverKey}/${channelKey}/mono.css`;
}

async function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://epicplayplay.cfd/',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isM3U8 = data.includes('#EXTM3U') || data.includes('#EXT-X-');
        resolve({ status: res.statusCode, isM3U8, size: data.length, preview: data.substring(0, 100) });
      });
    });
    
    req.on('error', (err) => resolve({ status: 'ERROR', error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
  });
}

async function getServerFromLookup() {
  const url = `https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`;
  console.log('1. Checking server lookup...');
  console.log(`   URL: ${url}`);
  
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://epicplayplay.cfd/',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`   Result: ${JSON.stringify(json)}`);
          resolve(json.server_key || null);
        } catch {
          console.log(`   Result: Invalid JSON - ${data.substring(0, 100)}`);
          resolve(null);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`   Error: ${err.message}`);
      resolve(null);
    });
  });
}

async function main() {
  // Step 1: Get server from lookup
  const assignedServer = await getServerFromLookup();
  
  if (assignedServer) {
    console.log(`\n   ✅ Channel ${CHANNEL} is assigned to server: ${assignedServer}`);
  } else {
    console.log(`\n   ⚠️ Could not get server assignment from lookup`);
  }
  
  // Step 2: Try all servers on both domains
  console.log('\n2. Testing all server/domain combinations...\n');
  
  const results = [];
  
  for (const serverKey of ALL_SERVER_KEYS) {
    for (const domain of DOMAINS) {
      const url = constructM3U8Url(serverKey, channelKey, domain);
      const result = await fetchUrl(url);
      
      const icon = result.isM3U8 ? '✅' : '❌';
      const statusStr = result.isM3U8 ? 'VALID M3U8' : `${result.status}`;
      
      console.log(`   ${icon} ${serverKey} @ ${domain}: ${statusStr}`);
      
      if (result.isM3U8) {
        results.push({ serverKey, domain, url });
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  if (results.length > 0) {
    console.log(`\n✅ Found ${results.length} working URL(s):`);
    results.forEach(r => console.log(`   - ${r.serverKey} @ ${r.domain}`));
    console.log(`\nRecommended: Use server "${results[0].serverKey}" with domain "${results[0].domain}"`);
  } else {
    console.log(`\n❌ No working URLs found for channel ${CHANNEL}`);
    console.log('   This channel may be offline or the channel number may be invalid.');
  }
}

main().catch(console.error);
