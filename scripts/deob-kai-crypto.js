#!/usr/bin/env node
/**
 * Deobfuscate the AnimeKai crypto by running the bundle in a sandboxed environment
 * and intercepting the encrypt/decrypt functions.
 * 
 * We'll create a fake DOM environment, load the bundle, and extract the functions.
 */
const fs = require('fs');
const vm = require('vm');
const https = require('https');

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

async function main() {
  // First, let's look at the bundle more carefully
  // The crypto is likely in a specific module within the webpack bundle
  const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');
  
  // Search for the AJAX call patterns that include the _ parameter
  // The encrypt function is called before AJAX requests
  // Look for patterns like: url + '&_=' + encrypt(something)
  
  // Search for string concatenation with _= 
  const patterns = [
    /['"]\&_=['"]\s*\+/g,
    /['"]_=['"]\s*\+/g,
    /\+\s*['"]\&_=['"]/g,
    /\+\s*['"]_=['"]/g,
    /['"]&_=['"]|['"]_=['"]/g,
  ];
  
  for (const p of patterns) {
    const matches = [...bundle.matchAll(p)];
    if (matches.length > 0) {
      console.log(`Pattern ${p.source}: ${matches.length} matches`);
      matches.forEach(m => {
        const ctx = bundle.substring(Math.max(0, m.index - 100), Math.min(bundle.length, m.index + 100));
        console.log(`  @${m.index}: ...${ctx}...`);
      });
    }
  }
  
  // Search for the encrypt/decrypt function definitions
  // They likely use btoa/atob and charCodeAt/fromCharCode
  // Let's find the section between atob and charCodeAt
  const atobIdx = bundle.indexOf('atob');
  const btoaIdx = bundle.indexOf('btoa');
  const fcIdx = bundle.indexOf('fromCharCode');
  const ccIdx = bundle.indexOf('charCodeAt');
  
  console.log('\nKey function positions:');
  console.log('  atob:', atobIdx);
  console.log('  btoa:', btoaIdx);
  console.log('  fromCharCode:', fcIdx);
  console.log('  charCodeAt:', ccIdx);
  
  // The crypto module is likely between the min and max of these positions
  const minIdx = Math.min(atobIdx, btoaIdx, fcIdx, ccIdx);
  const maxIdx = Math.max(atobIdx, btoaIdx, fcIdx, ccIdx);
  console.log(`  Crypto region: ${minIdx} - ${maxIdx} (${maxIdx - minIdx} chars)`);
  
  // Let's look at a wider region around these
  const regionStart = Math.max(0, minIdx - 2000);
  const regionEnd = Math.min(bundle.length, maxIdx + 2000);
  const region = bundle.substring(regionStart, regionEnd);
  
  // Save the region for manual inspection
  fs.writeFileSync('scripts/kai-crypto-region.js', region);
  console.log(`\nSaved crypto region to scripts/kai-crypto-region.js (${region.length} chars)`);
  
  // Now let's try to find the actual encrypt function by looking for
  // the pattern where window.__$ is used
  // The key is set on the page: window.__$ = 'ZZYdb...'
  // The bundle likely reads this key and uses it for encryption
  
  // Search for property access patterns that could be reading __$
  const propPatterns = [
    /window\[/g,
    /\["__/g,
    /\['__/g,
    /__\$/g,
  ];
  
  console.log('\nSearching for key access patterns:');
  for (const p of propPatterns) {
    const matches = [...bundle.matchAll(p)];
    if (matches.length > 0) {
      console.log(`  ${p.source}: ${matches.length} matches`);
      matches.slice(0, 3).forEach(m => {
        console.log(`    @${m.index}: ${bundle.substring(m.index - 20, m.index + 60)}`);
      });
    }
  }
  
  // The key might be accessed through a variable alias
  // Let's search for the key value itself (or part of it)
  const keyPart = 'ZZYdbXagj';
  const keyIdx = bundle.indexOf(keyPart);
  if (keyIdx >= 0) {
    console.log(`\nKey value found at ${keyIdx}:`);
    console.log(bundle.substring(keyIdx - 50, keyIdx + 100));
  } else {
    console.log('\nKey value not found in bundle (set dynamically on page)');
  }
  
  // Let's try to find where AJAX requests are made with the _ parameter
  // by searching for the AJAX URL patterns we know
  const ajaxEndpoints = ['episodes/list', 'links/list', 'links/view'];
  for (const ep of ajaxEndpoints) {
    let idx = 0;
    while ((idx = bundle.indexOf(ep, idx)) >= 0) {
      const ctx = bundle.substring(Math.max(0, idx - 200), Math.min(bundle.length, idx + 200));
      console.log(`\n"${ep}" at ${idx}:`);
      console.log(ctx);
      idx += ep.length;
    }
  }
  
  // Also search for the specific URL construction pattern
  // The _ parameter is typically added like: '&_=' + encryptFunction(value)
  // Let's search for '&_=' in the bundle
  let ampIdx = 0;
  const ampMatches = [];
  while ((ampIdx = bundle.indexOf('&_=', ampIdx)) >= 0) {
    ampMatches.push(ampIdx);
    ampIdx += 3;
  }
  console.log(`\n'&_=' found ${ampMatches.length} times`);
  ampMatches.forEach(idx => {
    console.log(`  @${idx}: ${bundle.substring(idx - 50, idx + 80)}`);
  });
  
  // Search for just '_=' with quotes
  const underscorePatterns = ['"_="', "'_='", '"_"', "'_'"];
  for (const p of underscorePatterns) {
    let idx = 0;
    while ((idx = bundle.indexOf(p, idx)) >= 0) {
      console.log(`\n'${p}' at ${idx}: ${bundle.substring(idx - 50, idx + 80)}`);
      idx += p.length;
    }
  }
}

main().catch(e => console.error('Fatal:', e));
