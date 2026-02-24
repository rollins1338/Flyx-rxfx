#!/usr/bin/env node
/**
 * Extract AnimeKai's current encryption JS bundle to reverse-engineer the new tables.
 */
const https = require('https');

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

async function main() {
  // 1. Fetch the main page to find JS bundles
  console.log('Fetching animekai.to main page...');
  const page = await fetch('https://animekai.to');
  
  // Find all script sources
  const scripts = [...page.body.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
  console.log('Found scripts:', scripts.length);
  scripts.forEach(s => console.log('  ', s));

  // 2. Fetch the watch page (has more scripts)
  console.log('\nFetching watch page...');
  const watch = await fetch('https://animekai.to/watch/bleach-re3j');
  const watchScripts = [...watch.body.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
  console.log('Watch page scripts:', watchScripts.length);
  watchScripts.forEach(s => console.log('  ', s));

  // 3. Look for inline scripts that might contain crypto
  const inlineScripts = [...watch.body.matchAll(/<script(?:\s[^>]*)?>([^<]{100,})<\/script>/g)];
  console.log('\nInline scripts with >100 chars:', inlineScripts.length);
  for (const [full, content] of inlineScripts) {
    const preview = content.substring(0, 200).replace(/\n/g, ' ');
    console.log(`  [${content.length} chars] ${preview}...`);
    
    // Check for crypto-related keywords
    if (content.includes('encrypt') || content.includes('decrypt') || content.includes('cipher') || 
        content.includes('base64') || content.includes('btoa') || content.includes('atob') ||
        content.includes('fromCharCode') || content.includes('charCodeAt')) {
      console.log('    ^^^ CRYPTO RELATED ^^^');
    }
  }

  // 4. Fetch each JS bundle and search for encryption code
  console.log('\n=== Searching JS bundles for crypto code ===');
  const allScripts = [...new Set([...scripts, ...watchScripts])];
  
  for (const src of allScripts) {
    const url = src.startsWith('http') ? src : `https://animekai.to${src}`;
    try {
      const js = await fetch(url);
      const body = js.body;
      
      // Search for crypto indicators
      const indicators = ['encrypt', 'decrypt', 'cipher', 'base64', 'btoa', 'atob', 
                          'fromCharCode', 'charCodeAt', 'substitut', 'c509bdb4', 'header'];
      const found = indicators.filter(i => body.toLowerCase().includes(i.toLowerCase()));
      
      if (found.length > 0) {
        console.log(`\n${src} (${body.length} bytes)`);
        console.log(`  Contains: ${found.join(', ')}`);
        
        // If it has base64 + charCodeAt, this is likely the crypto bundle
        if (found.includes('charCodeAt') && (found.includes('base64') || found.includes('btoa') || found.includes('atob'))) {
          console.log('  *** LIKELY CRYPTO BUNDLE ***');
          
          // Find the section with the substitution tables
          // Look for large arrays of hex numbers
          const hexArrays = body.match(/\[(?:0x[0-9a-f]+,?\s*){20,}\]/gi);
          if (hexArrays) {
            console.log(`  Found ${hexArrays.length} hex arrays`);
            hexArrays.slice(0, 3).forEach((a, i) => {
              console.log(`    Array ${i}: ${a.substring(0, 100)}... (${a.length} chars)`);
            });
          }
          
          // Look for the header bytes
          if (body.includes('c509bdb4') || body.includes('0xc5,0x09,0xbd')) {
            console.log('  *** CONTAINS HEADER BYTES ***');
          }
          
          // Save this bundle for analysis
          const fs = require('fs');
          const filename = `scripts/animekai-crypto-bundle-${Date.now()}.js`;
          fs.writeFileSync(filename, body);
          console.log(`  Saved to ${filename}`);
        }
      }
    } catch (e) {
      console.log(`  Error fetching ${src}: ${e.message}`);
    }
  }

  // 5. Also check if there's a WASM or separate crypto endpoint
  console.log('\n=== Checking for WASM/crypto endpoints ===');
  const wasmRefs = watch.body.match(/['"](\/[^'"]*\.wasm[^'"]*)['"]/g);
  if (wasmRefs) {
    console.log('WASM references:', wasmRefs);
  } else {
    console.log('No WASM references found');
  }

  // Check for fetch/XHR to crypto endpoints
  const apiRefs = watch.body.match(/['"](\/ajax\/[^'"]+)['"]/g);
  if (apiRefs) {
    console.log('AJAX endpoints:', [...new Set(apiRefs)].join(', '));
  }
}

main().catch(e => console.error('Fatal:', e));
