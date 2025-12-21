/**
 * Test script to reverse engineer Flixer.sh - V2
 * 
 * Found: api.flixer.sh/api/tmdb reference
 * Need to analyze the JS bundle to find actual API endpoints
 */

const https = require('https');
const http = require('http');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://flixer.sh/',
  'Origin': 'https://flixer.sh',
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
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function analyzeJSBundle() {
  console.log('=== Analyzing Flixer.sh JS Bundle ===\n');
  
  // Fetch the main JS bundle
  console.log('1. Fetching JS bundle...');
  try {
    const response = await fetch('https://flixer.sh/assets/js/index-21683734.js');
    const js = await response.text();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   JS length: ${js.length} chars`);
    
    // Look for API endpoints
    console.log('\n2. Searching for API patterns...');
    
    // Find all api.flixer.sh references
    const apiRefs = js.match(/api\.flixer\.sh[^"'\s\`]*/g) || [];
    console.log(`   api.flixer.sh references: ${apiRefs.length}`);
    [...new Set(apiRefs)].forEach(m => console.log(`     - ${m}`));
    
    // Find fetch/axios calls
    const fetchCalls = js.match(/fetch\s*\(\s*["'`][^"'`]+["'`]/g) || [];
    console.log(`\n   fetch() calls: ${fetchCalls.length}`);
    fetchCalls.slice(0, 10).forEach(m => console.log(`     - ${m}`));
    
    // Look for /api/ patterns
    const apiPatterns = js.match(/["'`]\/api\/[^"'`]+["'`]/g) || [];
    console.log(`\n   /api/ patterns: ${apiPatterns.length}`);
    [...new Set(apiPatterns)].slice(0, 20).forEach(m => console.log(`     - ${m}`));
    
    // Look for embed/source patterns
    const embedPatterns = js.match(/["'`][^"'`]*(?:embed|source|stream|video)[^"'`]*["'`]/gi) || [];
    console.log(`\n   embed/source patterns: ${embedPatterns.length}`);
    [...new Set(embedPatterns)].slice(0, 15).forEach(m => console.log(`     - ${m}`));
    
    // Look for vidsrc patterns
    const vidsrcPatterns = js.match(/vidsrc[^"'\s\`]*/gi) || [];
    console.log(`\n   vidsrc patterns: ${vidsrcPatterns.length}`);
    [...new Set(vidsrcPatterns)].forEach(m => console.log(`     - ${m}`));
    
    // Look for superembed patterns
    const superembedPatterns = js.match(/superembed[^"'\s\`]*/gi) || [];
    console.log(`\n   superembed patterns: ${superembedPatterns.length}`);
    [...new Set(superembedPatterns)].forEach(m => console.log(`     - ${m}`));
    
    // Look for 2embed patterns
    const twoembedPatterns = js.match(/2embed[^"'\s\`]*/gi) || [];
    console.log(`\n   2embed patterns: ${twoembedPatterns.length}`);
    [...new Set(twoembedPatterns)].forEach(m => console.log(`     - ${m}`));
    
    // Look for URL construction patterns
    const urlPatterns = js.match(/\$\{[^}]*(?:tmdb|id|season|episode)[^}]*\}/gi) || [];
    console.log(`\n   URL template patterns: ${urlPatterns.length}`);
    [...new Set(urlPatterns)].slice(0, 10).forEach(m => console.log(`     - ${m}`));
    
    // Look for specific endpoint patterns
    console.log('\n3. Looking for specific endpoint patterns...');
    
    // Search for patterns like /tv/ or /movie/
    const contentPatterns = js.match(/["'`][^"'`]*\/(?:tv|movie)\/[^"'`]*["'`]/gi) || [];
    console.log(`   /tv/ or /movie/ patterns: ${contentPatterns.length}`);
    [...new Set(contentPatterns)].slice(0, 15).forEach(m => console.log(`     - ${m}`));
    
    // Look for base URLs
    const baseUrls = js.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    console.log(`\n   Base URLs found: ${[...new Set(baseUrls)].length}`);
    [...new Set(baseUrls)].forEach(m => console.log(`     - ${m}`));
    
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
  
  // 4. Test the TMDB API endpoint
  console.log('\n4. Testing api.flixer.sh/api/tmdb endpoint...');
  
  const tmdbPatterns = [
    'https://api.flixer.sh/api/tmdb/tv/106379',
    'https://api.flixer.sh/api/tmdb/movie/550',
    'https://api.flixer.sh/api/tmdb/tv/106379/season/1',
    'https://api.flixer.sh/api/tmdb/tv/106379/season/1/episode/1',
  ];
  
  for (const url of tmdbPatterns) {
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
      if (response.ok && text.length < 500) {
        console.log(`     Response: ${text.substring(0, 300)}`);
      } else if (response.ok) {
        console.log(`     Response preview: ${text.substring(0, 200)}...`);
      }
    } catch (err) {
      console.log(`     Error: ${err.message}`);
    }
  }
  
  console.log('\n=== Analysis Complete ===');
}

analyzeJSBundle().catch(console.error);
