// Search for API endpoints in moviesapi.to JS bundle

async function searchApi() {
  const jsUrl = 'https://w1.moviesapi.to/assets/index-BHd4R3tU.js';
  console.log('Fetching JS bundle...');
  
  const res = await fetch(jsUrl);
  const js = await res.text();
  console.log('Bundle size:', js.length);
  
  // Search for fetch calls
  console.log('\n=== Looking for API calls ===');
  
  // Look for fetch patterns
  const fetchPatterns = js.match(/fetch\s*\(\s*[`"'][^`"']+[`"']/g);
  if (fetchPatterns) {
    console.log('\nFetch calls:');
    [...new Set(fetchPatterns)].forEach(p => console.log('  ', p));
  }
  
  // Look for axios/http patterns
  const httpPatterns = js.match(/\.(get|post)\s*\(\s*[`"'][^`"']+[`"']/g);
  if (httpPatterns) {
    console.log('\nHTTP calls:');
    [...new Set(httpPatterns)].forEach(p => console.log('  ', p));
  }
  
  // Look for API URLs
  const apiUrls = js.match(/https?:\/\/[^"'\s`]+api[^"'\s`]*/gi);
  if (apiUrls) {
    console.log('\nAPI URLs:');
    [...new Set(apiUrls)].slice(0, 30).forEach(u => console.log('  ', u));
  }
  
  // Look for scrapify
  const scrapifyIdx = js.indexOf('scrapify');
  if (scrapifyIdx > -1) {
    console.log('\n=== Scrapify context ===');
    console.log(js.substring(scrapifyIdx - 200, scrapifyIdx + 300));
  }
  
  // Look for m3u8 handling
  const m3u8Idx = js.indexOf('.m3u8');
  if (m3u8Idx > -1) {
    console.log('\n=== M3U8 context ===');
    console.log(js.substring(m3u8Idx - 200, m3u8Idx + 200));
  }
  
  // Look for HLS patterns
  const hlsPatterns = js.match(/[a-zA-Z]+\.hls|hls\.[a-zA-Z]+/g);
  if (hlsPatterns) {
    console.log('\nHLS patterns:', [...new Set(hlsPatterns)].slice(0, 20));
  }
  
  // Look for source/stream patterns
  const sourcePatterns = js.match(/sources?\s*[=:]\s*\[/g);
  if (sourcePatterns) {
    console.log('\nSource patterns:', sourcePatterns.length);
  }
  
  // Look for the actual API base URL
  const baseUrlPatterns = js.match(/baseURL\s*[=:]\s*["'`][^"'`]+["'`]/g);
  if (baseUrlPatterns) {
    console.log('\nBase URLs:');
    baseUrlPatterns.forEach(p => console.log('  ', p));
  }
  
  // Look for environment/config
  const envPatterns = js.match(/VITE_[A-Z_]+|import\.meta\.env\.[A-Z_]+/g);
  if (envPatterns) {
    console.log('\nEnv vars:', [...new Set(envPatterns)]);
  }
  
  // Search for specific domain patterns
  const domains = ['vidsrc', 'vidora', 'embed', 'stream', 'hls', 'cdn'];
  for (const domain of domains) {
    const pattern = new RegExp(`https?://[^"'\`\\s]*${domain}[^"'\`\\s]*`, 'gi');
    const matches = js.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`\n${domain} URLs:`);
      [...new Set(matches)].slice(0, 10).forEach(u => console.log('  ', u));
    }
  }
}

searchApi().catch(console.error);
