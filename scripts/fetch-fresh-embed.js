/**
 * Fetch fresh embed page from rapidshare/rapidairmax
 * and analyze the PAGE_DATA and app.js
 */

const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetch(url, referer) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    };
    
    if (referer) {
      options.headers['Referer'] = referer;
    }
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Fetching fresh embed page ===\n');
  
  // Try different embed URLs
  const embedUrls = [
    'https://rapidshare.cc/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ',
    'https://rapidairmax.site/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ',
  ];
  
  for (const url of embedUrls) {
    console.log(`\n=== Fetching ${url} ===\n`);
    
    try {
      const res = await fetch(url);
      console.log(`Status: ${res.status}`);
      
      if (res.status === 200) {
        const html = res.body;
        
        // Extract PAGE_DATA
        const pageDataMatch = html.match(/__PAGE_DATA\s*=\s*["']([^"']+)["']/);
        if (pageDataMatch) {
          console.log(`PAGE_DATA: ${pageDataMatch[1]}`);
          console.log(`Length: ${pageDataMatch[1].length}`);
        } else {
          console.log('PAGE_DATA not found');
        }
        
        // Extract app.js URL
        const appJsMatch = html.match(/src="([^"]*app\.js[^"]*)"/);
        if (appJsMatch) {
          console.log(`\napp.js URL: ${appJsMatch[1]}`);
          
          // Fetch app.js
          let appJsUrl = appJsMatch[1];
          if (appJsUrl.startsWith('/')) {
            const urlObj = new URL(url);
            appJsUrl = `${urlObj.protocol}//${urlObj.host}${appJsUrl}`;
          }
          
          console.log(`Fetching: ${appJsUrl}`);
          const appRes = await fetch(appJsUrl, url);
          
          if (appRes.status === 200) {
            const appJs = appRes.body;
            console.log(`app.js length: ${appJs.length}`);
            
            // Look for key patterns in app.js
            console.log('\n=== Analyzing app.js ===');
            
            // Find the decryption key or algorithm
            const patterns = [
              { name: 'PAGE_DATA access', regex: /__PAGE_DATA|PAGE_DATA/g },
              { name: 'XOR operation', regex: /\^=/g },
              { name: 'charCodeAt', regex: /charCodeAt/g },
              { name: 'fromCharCode', regex: /fromCharCode/g },
              { name: 'atob', regex: /atob/g },
              { name: 'btoa', regex: /btoa/g },
              { name: 'base64', regex: /base64/gi },
              { name: 'decrypt', regex: /decrypt/gi },
              { name: 'jwplayer', regex: /jwplayer/gi },
              { name: 'setup', regex: /\.setup\s*\(/g },
              { name: 'sources', regex: /sources\s*:/g },
              { name: 'file:', regex: /file\s*:/g },
              { name: 'm3u8', regex: /m3u8/gi },
              { name: 'hls', regex: /\.hls/gi },
            ];
            
            for (const { name, regex } of patterns) {
              const matches = appJs.match(regex);
              console.log(`  ${name}: ${matches ? matches.length : 0} matches`);
            }
            
            // Look for the actual decryption function
            // Find where PAGE_DATA is used
            const pageDataUsageIdx = appJs.indexOf('PAGE_DATA');
            if (pageDataUsageIdx !== -1) {
              console.log('\nPAGE_DATA usage context:');
              console.log(appJs.substring(Math.max(0, pageDataUsageIdx - 100), pageDataUsageIdx + 200));
            }
            
            // Look for the string table initialization
            const v2asvlIdx = appJs.indexOf('V2AsvL');
            if (v2asvlIdx !== -1) {
              console.log('\nV2AsvL context:');
              console.log(appJs.substring(Math.max(0, v2asvlIdx - 50), v2asvlIdx + 200));
            }
            
            // Look for the key derivation
            // The key might be derived from location.host
            const hostIdx = appJs.indexOf('location.host');
            if (hostIdx !== -1) {
              console.log('\nlocation.host context:');
              console.log(appJs.substring(Math.max(0, hostIdx - 100), hostIdx + 200));
            }
            
            // Save app.js for further analysis
            require('fs').writeFileSync('rapidshare-app-fresh.js', appJs);
            console.log('\nSaved app.js to rapidshare-app-fresh.js');
          }
        }
        
        // Save HTML for analysis
        require('fs').writeFileSync('rapidshare-embed-fresh.html', html);
        console.log('Saved HTML to rapidshare-embed-fresh.html');
        
      } else if (res.status === 302 || res.status === 301) {
        console.log(`Redirect to: ${res.headers.location}`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
}

main().catch(console.error);
