// Deep dive into vidlink.pro /api/mercury and /api/venus endpoints
const crypto = require('crypto');

const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro',
};

function tryDecrypt(data) {
  // Try base64 first
  try {
    const raw = Buffer.from(data.trim(), 'base64');
    if (raw.length >= 32) {
      const iv = raw.slice(0, 16);
      const ct = raw.slice(16);
      const key = Buffer.from(KEY, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let dec = decipher.update(ct);
      dec = Buffer.concat([dec, decipher.final()]);
      return dec.toString('utf8');
    }
  } catch (e) {}
  
  // Try hex
  try {
    const raw = Buffer.from(data.trim(), 'hex');
    if (raw.length >= 32) {
      const iv = raw.slice(0, 16);
      const ct = raw.slice(16);
      const key = Buffer.from(KEY, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let dec = decipher.update(ct);
      dec = Buffer.concat([dec, decipher.final()]);
      return dec.toString('utf8');
    }
  } catch (e) {}
  
  return null;
}

async function run() {
  // Test mercury endpoint
  console.log('=== /api/mercury ===');
  const mr = await fetch('https://vidlink.pro/api/mercury?tmdbId=550&type=movie', {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const mText = await mr.text();
  console.log('Status:', mr.status, 'Length:', mText.length);
  console.log('Content-Type:', mr.headers.get('content-type'));
  
  // Check if it's a script tag wrapping data
  if (mText.startsWith('<script>')) {
    console.log('Response is wrapped in <script> tag');
    // Extract the variable assignment
    const varMatch = mText.match(/window\['([^']+)'\]\s*=\s*'([^']+)'/);
    if (varMatch) {
      console.log('Variable name:', varMatch[1]);
      console.log('Value length:', varMatch[2].length);
      console.log('Value first 100:', varMatch[2].substring(0, 100));
      console.log('Value last 100:', varMatch[2].substring(varMatch[2].length - 100));
      
      // Try to decrypt the value
      const dec = tryDecrypt(varMatch[2]);
      if (dec) {
        console.log('\nDECRYPTED (first 500):', dec.substring(0, 500));
      } else {
        console.log('\nDecryption failed with AES key');
        // Check if it's base64
        try {
          const decoded = Buffer.from(varMatch[2], 'base64');
          console.log('Base64 decoded length:', decoded.length);
          console.log('First 50 bytes:', Array.from(decoded.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        } catch (e) {
          console.log('Not base64');
        }
        // Check if it's some other encoding
        console.log('Char frequency analysis:');
        const freq = {};
        for (const c of varMatch[2]) freq[c] = (freq[c] || 0) + 1;
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        console.log('Top chars:', sorted.slice(0, 20).map(([c, n]) => `${c}:${n}`).join(' '));
        console.log('Unique chars:', Object.keys(freq).length);
      }
    }
    
    // Check for multiple script tags or other data
    const allVars = [...mText.matchAll(/window\['([^']+)'\]\s*=\s*'([^']{10,})'/g)];
    console.log('\nAll window variables:', allVars.length);
    for (const [, name, val] of allVars) {
      console.log(`  ${name}: ${val.length} chars`);
    }
  }
  
  // Test venus endpoint
  console.log('\n=== /api/venus ===');
  const vr = await fetch('https://vidlink.pro/api/venus?tmdbId=550&type=movie', {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const vText = await vr.text();
  console.log('Status:', vr.status, 'Length:', vText.length);
  console.log('Content-Type:', vr.headers.get('content-type'));
  console.log('Full response:', vText.substring(0, 500));
  
  // Test with TV show
  console.log('\n=== TV Show test ===');
  const tvr = await fetch('https://vidlink.pro/api/mercury?tmdbId=1396&type=tv&season=1&episode=1', {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const tvText = await tvr.text();
  console.log('TV Status:', tvr.status, 'Length:', tvText.length);
  if (tvText.startsWith('<script>')) {
    const tvVar = tvText.match(/window\['([^']+)'\]\s*=\s*'([^']+)'/);
    if (tvVar) {
      console.log('TV Variable:', tvVar[1], 'Value length:', tvVar[2].length);
    }
  }
  
  // Now let's find the JS that reads these window variables and decrypts them
  console.log('\n=== Finding decryption logic ===');
  // Fetch the homepage to get all chunks
  const hr = await fetch('https://vidlink.pro/', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await hr.text();
  const chunks = [...html.matchAll(/src="(\/[^"]+\.js)"/g)].map(m => m[1]);
  
  for (const chunk of chunks) {
    try {
      const cr = await fetch('https://vidlink.pro' + chunk, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const js = await cr.text();
      
      // Look for the window variable access pattern or decrypt logic
      if (js.includes('mercury') || js.includes('venus') || js.includes('ZpQw9XkLmN8c3vR3') || 
          js.includes('c75136c5') || js.includes('aes-256-cbc') || js.includes('createDecipheriv') ||
          js.includes('window[') && js.includes('decrypt')) {
        console.log(`\n${chunk.split('/').pop()} has relevant code (${js.length} bytes)`);
        
        // Find the decrypt/mercury/venus context
        for (const term of ['mercury', 'venus', 'ZpQw9XkLmN8c3vR3', 'c75136c5', 'decrypt', 'decipher']) {
          let idx = js.indexOf(term);
          if (idx > -1) {
            console.log(`  "${term}" at ${idx}:`, js.substring(Math.max(0, idx - 200), Math.min(js.length, idx + 300)).replace(/\n/g, ' '));
          }
        }
      }
    } catch (e) {}
  }
}

run().catch(e => console.log('Fatal:', e));
