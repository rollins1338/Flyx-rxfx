/**
 * Analyze 111movies component to understand data flow
 */

async function analyzeComponent() {
  // Fetch the page to see what data is passed
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  // Extract __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  
  console.log('=== __NEXT_DATA__ STRUCTURE ===');
  console.log('Build ID:', nextData.buildId);
  console.log('Page:', nextData.page);
  console.log('Props keys:', Object.keys(nextData.props || {}));
  console.log('PageProps keys:', Object.keys(nextData.props?.pageProps || {}));
  
  const pageProps = nextData.props?.pageProps || {};
  console.log('\n=== PAGE PROPS ===');
  for (const [key, value] of Object.entries(pageProps)) {
    if (typeof value === 'string') {
      console.log(`${key}: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''} (${value.length} chars)`);
    } else {
      console.log(`${key}:`, typeof value, JSON.stringify(value).substring(0, 100));
    }
  }
  
  // The 'data' field in pageProps is what gets passed to the component
  // This is likely what n._data refers to
  
  // Let's also check the page-specific bundle
  const pageBundle = html.match(/\/_next\/static\/chunks\/pages\/movie[^"]+\.js/);
  if (pageBundle) {
    console.log('\n=== PAGE BUNDLE ===');
    console.log('URL:', pageBundle[0]);
    
    const bundleRes = await fetch(`https://111movies.com${pageBundle[0]}`);
    const bundleCode = await bundleRes.text();
    
    // Look for how data is used
    const dataUsageIdx = bundleCode.indexOf('.data');
    if (dataUsageIdx >= 0) {
      console.log('\n=== .data USAGE ===');
      console.log(bundleCode.substring(Math.max(0, dataUsageIdx - 100), dataUsageIdx + 200));
    }
    
    // Look for _data
    const _dataIdx = bundleCode.indexOf('_data');
    if (_dataIdx >= 0) {
      console.log('\n=== _data USAGE ===');
      console.log(bundleCode.substring(Math.max(0, _dataIdx - 100), _dataIdx + 200));
    }
  }
  
  // Now let's understand the encoding
  // The page data is: sXQzlGTLrFBXs_1ylG0dmFT6r_SAsGgvsFl6lX1FrFBWm_lGmGmAlblvmbmGlus1sXiysFgzsXYFsG0zm_SAsugLs_1SmMs1sGgv...
  // This looks like URL-safe base64
  
  // Let's decode it to see what's inside
  console.log('\n=== DECODING PAGE DATA ===');
  const pageData = pageProps.data;
  
  // URL-safe base64 decode
  const decoded = Buffer.from(pageData.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  console.log('Decoded length:', decoded.length);
  console.log('Decoded (hex):', decoded.toString('hex'));
  
  // The decoded data is binary - it's likely already encrypted
  // The client-side code decrypts it first, then re-encrypts for the API call
  
  // Let's look at the decryption in the bundle
  const bundle860Res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const bundle860 = await bundle860Res.text();
  
  // Look for decryption (createDecipher)
  const decipherIdx = bundle860.indexOf('createDecip');
  if (decipherIdx >= 0) {
    console.log('\n=== DECIPHER CONTEXT ===');
    console.log(bundle860.substring(Math.max(0, decipherIdx - 200), decipherIdx + 500));
  }
  
  // Look for the custom base64 decoder
  const customB64Idx = bundle860.indexOf('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=');
  if (customB64Idx >= 0) {
    console.log('\n=== CUSTOM BASE64 DECODER ===');
    console.log(bundle860.substring(Math.max(0, customB64Idx - 300), customB64Idx + 400));
  }
}

analyzeComponent().catch(console.error);
