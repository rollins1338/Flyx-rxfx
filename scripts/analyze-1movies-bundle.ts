/**
 * 1movies.bz - Fetch and analyze their bundle.js
 */

async function fetchBundle() {
  console.log('=== Fetching 1movies bundle.js ===\n');
  
  const bundleUrl = 'https://1movies.bz/assets/build/675b5c22f2829fc8e3a4034fab/dist/bundle.js?1kgqigv';
  
  const res = await fetch(bundleUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://1movies.bz/'
    }
  });
  
  const js = await res.text();
  console.log('Bundle size:', js.length, 'bytes');
  
  // Save full bundle
  const fs = await import('fs');
  fs.writeFileSync('1movies-bundle.js', js);
  
  // Look for interesting patterns
  const patterns = [
    { name: 'API endpoints', regex: /\/ajax\/[^'"]+/g },
    { name: 'Embed URLs', regex: /embed[^'"]{5,50}/gi },
    { name: 'Player references', regex: /player[^'"]{5,30}/gi },
    { name: 'm3u8 references', regex: /m3u8/gi },
    { name: 'Source/server', regex: /source|server/gi },
    { name: 'Decrypt/decode', regex: /decrypt|decode|cipher/gi },
    { name: 'Base64', regex: /atob|btoa|base64/gi },
    { name: 'Fetch/XHR', regex: /fetch\(|XMLHttpRequest|axios/gi },
  ];
  
  console.log('\n=== Pattern Analysis ===');
  for (const p of patterns) {
    const matches = js.match(p.regex);
    if (matches) {
      const unique = Array.from(new Set(matches));
      console.log(`\n${p.name} (${unique.length} unique):`);
      console.log(unique.slice(0, 10).join(', '));
    }
  }
  
  // Extract API endpoints more carefully
  const apiEndpoints = js.match(/["']\/ajax\/[^"']+["']/g);
  if (apiEndpoints) {
    console.log('\n=== API Endpoints ===');
    const unique = Array.from(new Set(apiEndpoints));
    unique.forEach(e => console.log(e));
  }
  
  // Look for the player initialization code
  const playerInit = js.match(/player[^{]*\{[^}]{100,500}\}/gi);
  if (playerInit) {
    console.log('\n=== Player Init Patterns ===');
    playerInit.slice(0, 3).forEach((p, i) => {
      console.log(`\n--- Pattern ${i + 1} ---`);
      console.log(p.substring(0, 300));
    });
  }
  
  console.log('\n\nSaved bundle to 1movies-bundle.js');
}

fetchBundle();
