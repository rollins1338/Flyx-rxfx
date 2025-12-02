// Deep dive into scrapify API authentication

async function deepDive() {
  // Fetch the JS bundle and look for how the fetch is made
  const jsUrl = 'https://w1.moviesapi.to/assets/index-BHd4R3tU.js';
  console.log('Fetching JS bundle...');
  
  const res = await fetch(jsUrl);
  const js = await res.text();
  
  // Find the scrapify fetch context
  const scrapifyIdx = js.indexOf('SCRAPIFY_URL');
  console.log('\n=== SCRAPIFY_URL context ===');
  console.log(js.substring(scrapifyIdx - 100, scrapifyIdx + 500));
  
  // Find the fetch call
  const fetchIdx = js.indexOf('fetch(`${fc.SCRAPIFY_URL}');
  if (fetchIdx > -1) {
    console.log('\n=== Fetch call context ===');
    console.log(js.substring(fetchIdx - 500, fetchIdx + 1000));
  }
  
  // Look for headers being set
  const headersPatterns = [
    /headers\s*:\s*\{[^}]+\}/g,
    /Authorization['"]\s*:/g,
    /X-[A-Za-z-]+['"]\s*:/g,
  ];
  
  for (const pattern of headersPatterns) {
    const matches = js.match(pattern);
    if (matches) {
      console.log(`\nPattern ${pattern.source}:`);
      [...new Set(matches)].slice(0, 10).forEach(m => console.log('  ', m));
    }
  }
  
  // Look for token generation
  const tokenPatterns = [
    /token\s*[=:]/gi,
    /generateToken/gi,
    /createToken/gi,
    /getToken/gi,
    /jwt/gi,
    /sign\s*\(/gi,
  ];
  
  for (const pattern of tokenPatterns) {
    const idx = js.search(pattern);
    if (idx > -1) {
      console.log(`\n=== ${pattern.source} context ===`);
      console.log(js.substring(idx - 100, idx + 300));
    }
  }
  
  // Look for crypto/encryption
  const cryptoIdx = js.indexOf('ENCRYPTION_KEY');
  if (cryptoIdx > -1) {
    console.log('\n=== ENCRYPTION_KEY context ===');
    console.log(js.substring(cryptoIdx - 200, cryptoIdx + 500));
  }
  
  // Look for the actual API call implementation
  const v1FetchIdx = js.indexOf('/v1/fetch');
  if (v1FetchIdx > -1) {
    console.log('\n=== /v1/fetch context ===');
    console.log(js.substring(v1FetchIdx - 500, v1FetchIdx + 500));
  }
}

deepDive().catch(console.error);
