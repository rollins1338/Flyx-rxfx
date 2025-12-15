/**
 * Test if the stream URL IP validation can be bypassed
 */

async function main() {
  // First, get our public IP
  console.log('=== CHECKING IP ===\n');
  
  try {
    const ipResp = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResp.json();
    console.log(`Our IP: ${ipData.ip}`);
  } catch (e) {
    console.log(`Could not get IP: ${e.message}`);
  }
  
  // Get fresh stream URL
  console.log('\n=== GETTING FRESH STREAM URL ===\n');
  
  const dudeResp = await fetch('https://embed.smashystream.com/dude.php?imdb=tt0468569', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://smashystream.com/',
    }
  });
  
  const html = await dudeResp.text();
  const fileMatch = html.match(/"file"\s*:\s*"(https?:[^"]+)"/);
  
  if (!fileMatch) {
    console.log('No stream URL found');
    return;
  }
  
  const streamUrl = fileMatch[1].replace(/\\\//g, '/');
  console.log(`Original URL: ${streamUrl}`);
  
  // Parse URL components
  const urlMatch = streamUrl.match(/^(https?:\/\/[^\/]+\/[^:]+):(\d+):([^:]+):([^\/]+)(\/index\.m3u8)$/);
  if (!urlMatch) {
    console.log('Could not parse URL');
    return;
  }
  
  const [, basePath, timestamp, ip, token, suffix] = urlMatch;
  console.log(`\nParsed:`);
  console.log(`  Base: ${basePath}`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  IP: ${ip}`);
  console.log(`  Token: ${token}`);
  
  // Try with different IPs
  console.log('\n=== TESTING IP VARIATIONS ===\n');
  
  // Get our IP
  let ourIp = '0.0.0.0';
  try {
    const ipResp = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResp.json();
    ourIp = ipData.ip;
  } catch (e) {}
  
  const testIps = [
    ip, // Original IP
    ourIp, // Our IP
    '0.0.0.0',
    '127.0.0.1',
  ];
  
  for (const testIp of testIps) {
    const testUrl = `${basePath}:${timestamp}:${testIp}:${token}${suffix}`;
    console.log(`\nTesting IP: ${testIp}`);
    
    try {
      const resp = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://embed.smashystream.com/',
        }
      });
      console.log(`  Status: ${resp.status}`);
      
      if (resp.ok) {
        const text = await resp.text();
        console.log(`  Is M3U8: ${text.includes('#EXTM3U')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Try without the IP/timestamp/token part
  console.log('\n=== TESTING SIMPLIFIED URLS ===\n');
  
  // Extract just the path without the token
  const pathMatch = basePath.match(/^(https?:\/\/[^\/]+)(\/stream2\/[^\/]+\/[^\/]+\/[^:]+)/);
  if (pathMatch) {
    const [, host, path] = pathMatch;
    
    const simplifiedUrls = [
      `${host}${path}/index.m3u8`,
      `${host}/stream2/index.m3u8`,
    ];
    
    for (const url of simplifiedUrls) {
      console.log(`\n${url}`);
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });
        console.log(`  Status: ${resp.status}`);
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }
  }
}

main().catch(console.error);
