#!/usr/bin/env node
const fs = require('fs');
const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');

// The bundle uses a K[] array for constants and a switch-case state machine.
// Let's find the K array initialization
const kInit = bundle.indexOf('var K=');
if (kInit >= 0) {
  // Find the K array contents
  let depth = 0, start = -1, end = -1;
  for (let i = kInit; i < bundle.length; i++) {
    if (bundle[i] === '[') { if (depth === 0) start = i; depth++; }
    if (bundle[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (start >= 0 && end >= 0) {
    const kStr = bundle.substring(start, end);
    console.log('K array: starts at', start, 'length', kStr.length);
    // Try to parse it
    try {
      const K = eval(kStr);
      console.log('K has', K.length, 'elements');
      // Look for interesting values
      console.log('First 20:', K.slice(0, 20));
      console.log('Last 20:', K.slice(-20));
      
      // Find strings that look like they could be related to encryption
      const cryptoStrings = K.filter(v => typeof v === 'string' && 
        (v.includes('encrypt') || v.includes('decrypt') || v.includes('base64') || 
         v.includes('atob') || v.includes('btoa') || v.includes('charCode') ||
         v.includes('fromChar') || v.includes('ajax') || v.includes('token') ||
         v.includes('_=') || v.length > 50));
      console.log('\nCrypto-related strings in K:', cryptoStrings.length);
      cryptoStrings.forEach(s => console.log('  ', JSON.stringify(s).substring(0, 100)));
    } catch (e) {
      console.log('Failed to eval K:', e.message);
      console.log('First 500 chars:', kStr.substring(0, 500));
    }
  }
}

// Look for the function that handles AJAX requests with encryption
// Search for patterns like: $.ajax, fetch, XMLHttpRequest
const ajaxPatterns = ['$.ajax', '$.get', '$.post', 'fetch(', 'XMLHttpRequest'];
for (const p of ajaxPatterns) {
  const idx = bundle.indexOf(p);
  if (idx >= 0) {
    console.log(`\n"${p}" at ${idx}:`);
    console.log(bundle.substring(Math.max(0, idx - 100), idx + 200).replace(/\n/g, '\\n'));
  }
}

// Search for the specific AJAX endpoints used for episodes/links
const endpoints = ['episodes/list', 'links/list', 'links/view', 'anime/search'];
for (const ep of endpoints) {
  let idx = 0;
  while ((idx = bundle.indexOf(ep, idx)) >= 0) {
    console.log(`\n"${ep}" at ${idx}:`);
    console.log(bundle.substring(Math.max(0, idx - 80), idx + 120).replace(/\n/g, '\\n'));
    idx += ep.length;
  }
}

// Look for the window.__$ key usage
// It might be referenced indirectly through the K array
const windowPatterns = ['window[', 'window.'];
for (const p of windowPatterns) {
  let idx = 0;
  let count = 0;
  while ((idx = bundle.indexOf(p, idx)) >= 0 && count < 10) {
    const context = bundle.substring(idx, idx + 80);
    if (context.includes('__') || context.includes('key') || context.includes('token')) {
      console.log(`\n"${p}" at ${idx}: ${context}`);
    }
    idx += p.length;
    count++;
  }
}
