// Quick test to reverse-engineer vidlink.pro API
const crypto = require('crypto');

const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

function decrypt(encData) {
  try {
    // Try base64
    let raw;
    try { raw = Buffer.from(encData.trim(), 'base64'); } catch {}
    if (!raw || raw.length < 32) {
      // Try hex
      raw = Buffer.from(encData.trim(), 'hex');
    }
    if (raw.length < 32) return null;
    
    const iv = raw.slice(0, 16);
    const ct = raw.slice(16);
    const key = Buffer.from(KEY, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(ct);
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    return 'DECRYPT_ERROR: ' + e.message;
  }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro',
};

async function run() {
  const endpoints = [
    // Simple endpoints
    'https://vidlink.pro/api/b/movie/550',
    'https://vidlink.pro/api/b/movie/157336',
    // Per-server (videasy-style)
    'https://vidlink.pro/api/b/myflixerzupcloud/sources-with-title?title=Fight+Club&mediaType=movie&year=1999&tmdbId=550',
    // Maybe different base
    'https://api.vidlink.pro/movie/550',
    'https://api.vidlink.pro/b/movie/550',
    // TV test
    'https://vidlink.pro/api/b/tv/1396/1/1',
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000), redirect: 'follow' });
      const text = await r.text();
      const short = url.replace('https://vidlink.pro', '').replace('https://api.vidlink.pro', 'api:');
      
      if (text.length === 0) {
        console.log(`${short} → ${r.status} EMPTY`);
      } else if (text.startsWith('<!') || text.startsWith('<html')) {
        console.log(`${short} → ${r.status} HTML (${text.length} bytes)`);
      } else {
        console.log(`${short} → ${r.status} len=${text.length}`);
        // Try to parse as JSON
        try {
          const json = JSON.parse(text);
          console.log('  JSON:', JSON.stringify(json).substring(0, 200));
        } catch {
          // Try to decrypt
          const dec = decrypt(text);
          if (dec && !dec.startsWith('DECRYPT_ERROR')) {
            console.log('  DECRYPTED:', dec.substring(0, 300));
          } else {
            console.log('  RAW:', text.substring(0, 200));
            if (dec) console.log('  ' + dec);
          }
        }
      }
    } catch (e) {
      const short = url.replace('https://vidlink.pro', '').replace('https://api.vidlink.pro', 'api:');
      console.log(`${short} → ERROR: ${e.message}`);
    }
  }

  // Now fetch the player page and find the JS bundle to see real API calls
  console.log('\n--- Checking player page ---');
  try {
    const r = await fetch('https://vidlink.pro/movie/550', { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const html = await r.text();
    console.log('Player page:', r.status, html.length, 'bytes');
    
    // Find Next.js chunks
    const chunks = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]);
    console.log('JS chunks:', chunks.length);
    
    // Find inline scripts with API references
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.length > 50);
    for (const s of scripts) {
      if (s.includes('api') || s.includes('fetch') || s.includes('decrypt')) {
        console.log('Interesting script:', s.substring(0, 300));
      }
    }
    
    // Find any API URLs in the HTML
    const apiUrls = [...html.matchAll(/["'](\/api\/[^"']+)["']/g)].map(m => m[1]);
    if (apiUrls.length > 0) console.log('API URLs in HTML:', [...new Set(apiUrls)]);
    
    // Find buildId for Next.js
    const buildId = html.match(/buildId["':]+\s*["']([^"']+)["']/);
    if (buildId) console.log('Build ID:', buildId[1]);
    
    // Print the first interesting chunk URL
    if (chunks.length > 0) {
      console.log('\nFetching first app chunk to find API patterns...');
      // Find the main app chunk (usually the largest or has 'app' in name)
      const appChunk = chunks.find(c => c.includes('app') || c.includes('page')) || chunks[chunks.length - 1];
      if (appChunk) {
        const cr = await fetch('https://vidlink.pro' + appChunk, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
        const js = await cr.text();
        console.log('Chunk:', appChunk, js.length, 'bytes');
        
        // Find API patterns
        const apiPatterns = [...js.matchAll(/["'`](\/api\/[^"'`\s]{3,80})["'`]/g)].map(m => m[1]);
        if (apiPatterns.length > 0) console.log('API patterns in JS:', [...new Set(apiPatterns)]);
        
        // Find decrypt/key references
        if (js.includes('decrypt') || js.includes('AES') || js.includes('aes')) {
          const idx = js.indexOf('decrypt');
          if (idx > -1) console.log('decrypt context:', js.substring(Math.max(0, idx - 100), idx + 200));
        }
      }
    }
  } catch (e) {
    console.log('Player page error:', e.message);
  }
}

run();
