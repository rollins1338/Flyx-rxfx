/**
 * Test script to reverse engineer Flixer.sh
 * 
 * Flixer.sh is a React SPA that loads video sources dynamically.
 * We need to find their API endpoints for fetching video sources.
 */

const https = require('https');
const http = require('http');

// Test URLs
const TEST_TV_URL = 'https://flixer.sh/watch/tv/106379/1/1';
const TEST_MOVIE_URL = 'https://flixer.sh/watch/movie/550';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://flixer.sh/',
};

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: { ...HEADERS, ...options.headers },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data)),
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function analyzeFlixerPage() {
  console.log('=== Analyzing Flixer.sh ===\n');
  
  // 1. Fetch the main page
  console.log('1. Fetching main page...');
  try {
    const response = await fetch(TEST_TV_URL);
    const html = await response.text();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   HTML length: ${html.length} chars`);
    
    // Look for API endpoints in the HTML
    const apiMatches = html.match(/api\.flixer\.sh[^"'\s]*/g) || [];
    console.log(`   Found API references: ${apiMatches.length}`);
    apiMatches.forEach(m => console.log(`     - ${m}`));
    
    // Look for embed URLs
    const embedMatches = html.match(/https?:\/\/[^"'\s]*(?:embed|vidsrc|vidplay|superembed)[^"'\s]*/gi) || [];
    console.log(`   Found embed URLs: ${embedMatches.length}`);
    embedMatches.slice(0, 5).forEach(m => console.log(`     - ${m}`));
    
    // Look for script sources
    const scriptMatches = html.match(/src="([^"]+\.js[^"]*)"/g) || [];
    console.log(`   Found JS files: ${scriptMatches.length}`);
    scriptMatches.slice(0, 3).forEach(m => console.log(`     - ${m}`));
    
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
  
  // 2. Try common API patterns
  console.log('\n2. Testing common API patterns...');
  
  const apiPatterns = [
    'https://api.flixer.sh/api/sources/tv/106379/1/1',
    'https://api.flixer.sh/sources/tv/106379/1/1',
    'https://flixer.sh/api/sources/tv/106379/1/1',
    'https://flixer.sh/api/embed/tv/106379/1/1',
    'https://api.flixer.sh/api/embed/tv/106379/1/1',
    'https://api.flixer.sh/embed/tv/106379/1/1',
    'https://flixer.sh/api/stream/tv/106379/1/1',
    'https://api.flixer.sh/api/stream/tv/106379/1/1',
  ];
  
  for (const url of apiPatterns) {
    try {
      console.log(`   Testing: ${url}`);
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          'Accept': 'application/json',
        }
      });
      const text = await response.text();
      console.log(`     Status: ${response.status}, Length: ${text.length}`);
      if (response.ok && text.length < 1000) {
        console.log(`     Response: ${text.substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`     Error: ${err.message}`);
    }
  }
  
  // 3. Try vidsrc.to pattern (common for these sites)
  console.log('\n3. Testing VidSrc patterns...');
  
  const vidsrcPatterns = [
    'https://vidsrc.to/embed/tv/106379/1/1',
    'https://vidsrc.cc/v2/embed/tv/106379/1/1',
    'https://vidsrc.me/embed/tv?tmdb=106379&season=1&episode=1',
    'https://vidsrc.xyz/embed/tv?tmdb=106379&season=1&episode=1',
    'https://2embed.cc/embedtv/106379&s=1&e=1',
    'https://www.2embed.cc/embedtv/106379&s=1&e=1',
  ];
  
  for (const url of vidsrcPatterns) {
    try {
      console.log(`   Testing: ${url}`);
      const response = await fetch(url);
      console.log(`     Status: ${response.status}`);
      if (response.ok) {
        const text = await response.text();
        // Look for iframe or video sources
        const iframes = text.match(/iframe[^>]*src=["']([^"']+)["']/gi) || [];
        const m3u8 = text.match(/https?:\/\/[^"'\s]*\.m3u8[^"'\s]*/gi) || [];
        console.log(`     Found ${iframes.length} iframes, ${m3u8.length} m3u8 URLs`);
      }
    } catch (err) {
      console.log(`     Error: ${err.message}`);
    }
  }
  
  console.log('\n=== Analysis Complete ===');
}

analyzeFlixerPage().catch(console.error);
