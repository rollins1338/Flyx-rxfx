/**
 * Test all SmashyStream API endpoints to find one that works
 */

const https = require('https');
const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = options.timeout || 10000;
    
    const req = protocol.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://player.smashystream.com/',
        'Origin': 'https://player.smashystream.com',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 500)
        });
      });
    });
    
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'timeout' });
    });
  });
}

async function main() {
  console.log('=== TESTING ALL API ENDPOINTS ===\n');
  
  // Generate a mock token
  const timestamp = Math.floor(Date.now() / 1000);
  const token = `7f6_Uvi5w9kiubAtfgbkk3aa5xZzHL5YgY7a.IBxPrs2bvwbVcXbMU0eL9Q.${timestamp}`;
  const userId = '8E4A4253_00c7fb9880a5db8c353db5c26423bcb3';
  
  // Test various endpoints
  const endpoints = [
    // Main API
    `https://api.smashystream.top/`,
    `https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`,
    
    // Alternative domains
    `https://smashystream.top/`,
    `https://smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`,
    
    // Embed domain
    `https://embed.smashystream.com/`,
    `https://embed.smashystream.com/dude.php?imdb=tt0468569`,
    
    // Player domain
    `https://player.smashystream.com/`,
    
    // Try different API paths from the bundle
    `https://api.smashystream.top/api/v1/videosmashyi/tt0468569/155?token=${token}&user_id=${userId}`,
    `https://api.smashystream.top/api/v1/videozoan/tt0468569/155?token=${token}&user_id=${userId}`,
    `https://api.smashystream.top/api/v1/videogoan/tt0468569/155?token=${token}&user_id=${userId}`,
    
    // Try without token
    `https://api.smashystream.top/api/v1/data?tmdb=155`,
    
    // Try health/status endpoints
    `https://api.smashystream.top/health`,
    `https://api.smashystream.top/status`,
    `https://api.smashystream.top/api/health`,
  ];
  
  for (const url of endpoints) {
    console.log(`\nTesting: ${url.substring(0, 80)}...`);
    const result = await makeRequest(url);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    } else {
      console.log(`  Status: ${result.status}`);
      if (result.body) {
        console.log(`  Body: ${result.body.substring(0, 200)}`);
      }
    }
  }
  
  // Test DNS resolution
  console.log('\n\n=== DNS RESOLUTION ===\n');
  
  const dns = require('dns').promises;
  const domains = ['api.smashystream.top', 'smashystream.top', 'embed.smashystream.com', 'player.smashystream.com'];
  
  for (const domain of domains) {
    try {
      const addresses = await dns.resolve4(domain);
      console.log(`${domain}: ${addresses.join(', ')}`);
    } catch (e) {
      console.log(`${domain}: ${e.message}`);
    }
  }
  
  // Test with curl-like approach (different TLS settings)
  console.log('\n\n=== TESTING WITH DIFFERENT TLS ===\n');
  
  const tls = require('tls');
  
  // Try connecting directly to see if it's a TLS issue
  const testTLS = (host, port = 443) => {
    return new Promise((resolve) => {
      const socket = tls.connect({
        host,
        port,
        servername: host,
        timeout: 10000
      }, () => {
        resolve({ connected: true, protocol: socket.getProtocol() });
        socket.destroy();
      });
      
      socket.on('error', (e) => resolve({ error: e.message }));
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ error: 'timeout' });
      });
    });
  };
  
  for (const domain of domains) {
    console.log(`TLS test ${domain}:`);
    const result = await testTLS(domain);
    console.log(`  ${JSON.stringify(result)}`);
  }
}

main().catch(console.error);
