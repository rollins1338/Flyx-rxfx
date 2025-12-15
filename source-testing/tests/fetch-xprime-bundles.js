/**
 * Fetch and analyze XPrime Svelte bundles
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': '*/*',
  'Referer': 'https://xprime.tv/',
};

const BUNDLES = [
  '/_app/immutable/entry/start.BMpJnpmV.js',
  '/_app/immutable/entry/app.DTRO2_lZ.js',
];

async function fetchBundle(path) {
  const url = `https://xprime.tv${path}`;
  console.log(`\nFetching: ${url}`);
  
  try {
    const response = await fetch(url, { headers: HEADERS });
    console.log(`Status: ${response.status}`);
    
    if (!response.ok) return null;
    
    const text = await response.text();
    console.log(`Length: ${text.length} chars`);
    
    return text;
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return null;
  }
}

async function analyzeBundle(code, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ANALYZING: ${name}`);
  console.log('='.repeat(60));
  
  // Look for API endpoints
  console.log('\n--- API ENDPOINTS ---');
  const apiPatterns = [
    /["'`](\/api\/[^"'`]+)["'`]/gi,
    /["'`](https?:\/\/[^"'`]*api[^"'`]*)["'`]/gi,
    /["'`](https?:\/\/[^"'`]*backend[^"'`]*)["'`]/gi,
    /["'`](https?:\/\/[^"'`]*source[^"'`]*)["'`]/gi,
  ];
  
  const foundApis = new Set();
  for (const pattern of apiPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      if (!match[1].includes('google') && !match[1].includes('cloudflare')) {
        foundApis.add(match[1]);
      }
    }
  }
  
  for (const api of foundApis) {
    console.log(`  ${api}`);
  }
  
  // Look for fetch calls
  console.log('\n--- FETCH PATTERNS ---');
  const fetchPattern = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  let match;
  while ((match = fetchPattern.exec(code)) !== null) {
    console.log(`  fetch("${match[1]}")`);
  }
  
  // Look for encrypted/decrypt patterns
  console.log('\n--- ENCRYPTION PATTERNS ---');
  if (code.includes('decrypt')) console.log('  Contains "decrypt"');
  if (code.includes('encrypt')) console.log('  Contains "encrypt"');
  if (code.includes('atob')) console.log('  Contains "atob"');
  if (code.includes('btoa')) console.log('  Contains "btoa"');
  if (code.includes('CryptoJS')) console.log('  Contains "CryptoJS"');
  if (code.includes('AES')) console.log('  Contains "AES"');
  
  // Look for source/stream patterns
  console.log('\n--- SOURCE PATTERNS ---');
  const sourcePatterns = [
    /["'`]([^"'`]*\.m3u8[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*source[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*stream[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*embed[^"'`]*)["'`]/gi,
  ];
  
  const foundSources = new Set();
  for (const pattern of sourcePatterns) {
    let m;
    while ((m = pattern.exec(code)) !== null) {
      if (m[1].length > 5 && m[1].length < 100) {
        foundSources.add(m[1]);
      }
    }
  }
  
  for (const src of Array.from(foundSources).slice(0, 20)) {
    console.log(`  ${src}`);
  }
  
  // Save the bundle
  const safeName = name.replace(/[^a-z0-9]/gi, '-');
  fs.writeFileSync(`source-testing/xprime-bundle-${safeName}.js`, code);
  console.log(`\nSaved to: source-testing/xprime-bundle-${safeName}.js`);
}

async function main() {
  console.log('=== FETCHING XPRIME BUNDLES ===');
  
  for (const bundle of BUNDLES) {
    const code = await fetchBundle(bundle);
    if (code) {
      await analyzeBundle(code, bundle);
    }
  }
  
  // Also try to find more bundles from the HTML
  console.log('\n\n=== LOOKING FOR MORE BUNDLES ===');
  const html = fs.readFileSync('source-testing/xprime-response.html', 'utf8');
  
  const bundlePattern = /["'](\/_app\/[^"']+\.js)["']/gi;
  const bundles = new Set();
  let match;
  while ((match = bundlePattern.exec(html)) !== null) {
    bundles.add(match[1]);
  }
  
  console.log(`Found ${bundles.size} bundle references:`);
  for (const b of bundles) {
    console.log(`  ${b}`);
  }
  
  // Fetch the page-specific bundle (likely contains the embed logic)
  const pageBundle = Array.from(bundles).find(b => b.includes('embed') || b.includes('page'));
  if (pageBundle) {
    console.log(`\nFetching page bundle: ${pageBundle}`);
    const code = await fetchBundle(pageBundle);
    if (code) {
      await analyzeBundle(code, pageBundle);
    }
  }
}

main().catch(console.error);
