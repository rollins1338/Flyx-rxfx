/**
 * Test all DLHD server types discovered from server_lookup
 * Server keys found: zeko, nfs, wind, ddy6
 */

const https = require('https');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://epicplayplay.cfd/',
        'Origin': 'https://epicplayplay.cfd',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function getServerKey(channel) {
  const channelKey = `premium${channel}`;
  try {
    const response = await fetch(`https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`);
    if (response.status === 200) {
      const json = JSON.parse(response.data);
      return json.server_key;
    }
  } catch {}
  return null;
}

function constructM3U8Url(serverKey, channelKey) {
  if (serverKey === 'top1/cdn') {
    return `https://top1.kiko2.ru/top1/cdn/${channelKey}/mono.css`;
  }
  return `https://${serverKey}new.kiko2.ru/${serverKey}/${channelKey}/mono.css`;
}

async function testServerForChannel(channel) {
  const channelKey = `premium${channel}`;
  const serverKey = await getServerKey(channel);
  
  if (!serverKey) {
    return { channel, serverKey: null, status: 'no_server_key' };
  }
  
  const m3u8Url = constructM3U8Url(serverKey, channelKey);
  
  try {
    const response = await fetch(m3u8Url);
    const isM3U8 = response.data.includes('#EXTM3U');
    
    let keyUrl = null;
    if (isM3U8) {
      const keyMatch = response.data.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
      if (keyMatch) keyUrl = keyMatch[1];
    }
    
    return {
      channel,
      serverKey,
      m3u8Url,
      status: response.status,
      isM3U8,
      keyUrl,
      size: response.data.length
    };
  } catch (err) {
    return { channel, serverKey, m3u8Url, status: 'error', error: err.message };
  }
}

async function discoverAllServers() {
  console.log('Discovering all DLHD server types...\n');
  
  const serverTypes = new Map();
  const results = [];
  
  // Test a range of channels to find all server types
  const testChannels = [
    // Sports channels
    51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
    // More channels
    100, 101, 102, 103, 104, 105,
    200, 201, 202,
    300, 301, 302,
    400, 401, 402,
    500, 501, 502,
    // High numbers
    600, 700, 800, 900
  ];
  
  for (const channel of testChannels) {
    const result = await testServerForChannel(channel);
    results.push(result);
    
    if (result.serverKey) {
      if (!serverTypes.has(result.serverKey)) {
        serverTypes.set(result.serverKey, []);
      }
      serverTypes.get(result.serverKey).push({
        channel,
        working: result.isM3U8
      });
    }
    
    // Progress indicator
    process.stdout.write(`\rTested channel ${channel}...`);
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('SERVER TYPES DISCOVERED');
  console.log('='.repeat(60));
  
  for (const [serverKey, channels] of serverTypes) {
    const working = channels.filter(c => c.working).length;
    const total = channels.length;
    console.log(`\n${serverKey}:`);
    console.log(`  Working: ${working}/${total}`);
    console.log(`  Channels: ${channels.map(c => c.channel).join(', ')}`);
    
    // Show M3U8 URL pattern
    const m3u8Pattern = constructM3U8Url(serverKey, 'premium{channel}');
    console.log(`  M3U8 Pattern: ${m3u8Pattern}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total server types: ${serverTypes.size}`);
  console.log(`Server keys: ${[...serverTypes.keys()].join(', ')}`);
  
  // Test one channel from each server type
  console.log('\n' + '='.repeat(60));
  console.log('TESTING ONE CHANNEL FROM EACH SERVER');
  console.log('='.repeat(60));
  
  for (const [serverKey, channels] of serverTypes) {
    const workingChannel = channels.find(c => c.working);
    if (workingChannel) {
      console.log(`\n${serverKey} (channel ${workingChannel.channel}):`);
      const result = results.find(r => r.channel === workingChannel.channel);
      console.log(`  M3U8 URL: ${result.m3u8Url}`);
      console.log(`  Key URL: ${result.keyUrl}`);
    }
  }
  
  return { serverTypes, results };
}

async function testAlternativeServersForChannel(channel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing if channel ${channel} works on MULTIPLE servers`);
  console.log('='.repeat(60));
  
  const channelKey = `premium${channel}`;
  const knownServers = ['zeko', 'nfs', 'wind', 'ddy6', 'top1/cdn'];
  
  for (const serverKey of knownServers) {
    const m3u8Url = constructM3U8Url(serverKey, channelKey);
    
    try {
      const response = await fetch(m3u8Url);
      const isM3U8 = response.data.includes('#EXTM3U');
      
      console.log(`\n${serverKey}:`);
      console.log(`  URL: ${m3u8Url}`);
      console.log(`  Status: ${response.status}, Is M3U8: ${isM3U8}`);
      
      if (isM3U8) {
        console.log(`  ✓ WORKS!`);
      }
    } catch (err) {
      console.log(`\n${serverKey}: Error - ${err.message}`);
    }
  }
}

async function main() {
  console.log('DLHD Multi-Server Discovery\n');
  console.log('Goal: Find all 4 server types for DLHD channels\n');
  
  // Discover all servers
  const { serverTypes } = await discoverAllServers();
  
  // Test if a single channel can use multiple servers
  // (This would indicate server redundancy/failover)
  await testAlternativeServersForChannel(51);
  
  console.log('\n\nDone!');
}

main().catch(console.error);
