#!/usr/bin/env node
/**
 * Test the new exhaustive server+domain search logic
 */

const https = require('https');

const ALL_SERVER_KEYS = ['zeko', 'wind', 'nfs', 'ddy6', 'chevy', 'top1/cdn'];
const CDN_DOMAINS = ['kiko2.ru', 'giokko.ru'];

const TEST_CHANNELS = ['51', '325', '1', '100'];

function constructM3U8UrlWithDomain(serverKey, channelKey, domain) {
  if (serverKey === 'top1/cdn') {
    return `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
  }
  return `https://${serverKey}new.${domain}/${serverKey}/${channelKey}/mono.css`;
}

async function testUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://epicplayplay.cfd/',
      },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isM3U8 = data.includes('#EXTM3U') || data.includes('#EXT-X-');
        resolve({ isM3U8, status: res.statusCode });
      });
    });
    req.on('error', () => resolve({ isM3U8: false, status: 'ERROR' }));
    req.on('timeout', () => { req.destroy(); resolve({ isM3U8: false, status: 'TIMEOUT' }); });
  });
}

async function findWorkingCombination(channel) {
  const channelKey = `premium${channel}`;
  const tried = [];
  
  for (const serverKey of ALL_SERVER_KEYS) {
    for (const domain of CDN_DOMAINS) {
      tried.push(`${serverKey}@${domain}`);
      const url = constructM3U8UrlWithDomain(serverKey, channelKey, domain);
      const result = await testUrl(url);
      
      if (result.isM3U8) {
        return { channel, serverKey, domain, triedCount: tried.length };
      }
    }
  }
  
  return { channel, serverKey: null, domain: null, triedCount: tried.length, failed: true };
}

async function main() {
  console.log('Testing exhaustive server+domain search...\n');
  console.log(`Servers: ${ALL_SERVER_KEYS.join(', ')}`);
  console.log(`Domains: ${CDN_DOMAINS.join(', ')}`);
  console.log(`Total combinations per channel: ${ALL_SERVER_KEYS.length * CDN_DOMAINS.length}`);
  console.log('='.repeat(60));
  
  for (const channel of TEST_CHANNELS) {
    console.log(`\nChannel ${channel}:`);
    const result = await findWorkingCombination(channel);
    
    if (result.serverKey) {
      console.log(`  ✅ Found: ${result.serverKey}@${result.domain} (tried ${result.triedCount} combinations)`);
    } else {
      console.log(`  ❌ No working combination found (tried all ${result.triedCount})`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main().catch(console.error);
