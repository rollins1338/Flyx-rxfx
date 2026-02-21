/**
 * Test segment fetching - follow redirects and check different referers/headers
 */
const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetch(url, headers = {}, timeout = 15000, followRedirects = true) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(url, {
      headers: { 'User-Agent': UA, ...headers },
      timeout,
      rejectUnauthorized: false,
    }, (res) => {
      if (followRedirects && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        console.log(`  → Redirect (${res.statusCode}): ${redirectUrl.substring(0, 120)}...`);
        return fetch(redirectUrl, headers, timeout, true).then(resolve);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer: buf,
          text: buf.toString('utf8'),
          elapsed: Date.now() - start,
          finalUrl: url,
        });
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message, elapsed: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', elapsed: Date.now() - start }); });
  });
}

async function main() {
  /* First get a fresh M3U8 to get current segment URLs */
  console.log('Fetching M3U8...');
  const m3u8Res = await fetch('https://zekonew.dvalna.ru/zeko/premium51/mono.css', {
    'Referer': 'https://lefttoplay.xyz/',
    'Origin': 'https://lefttoplay.xyz',
  });
  
  if (!m3u8Res.text.includes('#EXTM3U')) {
    console.log('M3U8 fetch failed:', m3u8Res.status);
    return;
  }
  
  /* Parse segments */
  const lines = m3u8Res.text.split('\n');
  const segments = [];
  let keyUrl = null;
  for (const line of lines) {
    const keyMatch = line.match(/URI="([^"]+)"/);
    if (keyMatch) keyUrl = keyMatch[1];
    if (line.trim() && !line.startsWith('#')) {
      segments.push(line.trim());
    }
  }
  
  console.log(`Got ${segments.length} segments, key: ${keyUrl}`);
  if (segments.length === 0) return;
  
  const testSeg = segments[0];
  console.log(`\nTest segment: ${testSeg.substring(0, 80)}...`);
  
  /* Test 1: Follow redirects with lefttoplay.xyz referer */
  console.log('\n--- Test 1: Follow redirects, Referer: lefttoplay.xyz ---');
  const r1 = await fetch(testSeg, {
    'Referer': 'https://lefttoplay.xyz/',
    'Origin': 'https://lefttoplay.xyz',
  });
  console.log(`  Status: ${r1.status} | Size: ${r1.buffer.length} | Time: ${r1.elapsed}ms`);
  if (r1.buffer.length > 0) {
    console.log(`  First 16 bytes: ${r1.buffer.slice(0, 16).toString('hex')}`);
    console.log(`  Content-Type: ${r1.headers?.['content-type']}`);
  }
  if (r1.error) console.log(`  Error: ${r1.error}`);
  
  /* Test 2: Follow redirects with epaly.fun referer */
  console.log('\n--- Test 2: Follow redirects, Referer: epaly.fun ---');
  const r2 = await fetch(testSeg, {
    'Referer': 'https://epaly.fun/',
    'Origin': 'https://epaly.fun',
  });
  console.log(`  Status: ${r2.status} | Size: ${r2.buffer.length} | Time: ${r2.elapsed}ms`);
  if (r2.buffer.length > 0) console.log(`  First 16 bytes: ${r2.buffer.slice(0, 16).toString('hex')}`);
  
  /* Test 3: No redirect following - see where it redirects to */
  console.log('\n--- Test 3: No redirect following (see redirect target) ---');
  const r3 = await fetch(testSeg, {
    'Referer': 'https://lefttoplay.xyz/',
    'Origin': 'https://lefttoplay.xyz',
  }, 15000, false);
  console.log(`  Status: ${r3.status}`);
  if (r3.headers?.location) {
    console.log(`  Location: ${r3.headers.location}`);
    
    /* Now fetch the redirect target directly */
    console.log('\n--- Test 3b: Fetch redirect target directly ---');
    const r3b = await fetch(r3.headers.location, {
      'Referer': 'https://lefttoplay.xyz/',
      'Origin': 'https://lefttoplay.xyz',
    });
    console.log(`  Status: ${r3b.status} | Size: ${r3b.buffer.length} | Time: ${r3b.elapsed}ms`);
    if (r3b.buffer.length > 0) {
      console.log(`  First 16 bytes: ${r3b.buffer.slice(0, 16).toString('hex')}`);
      console.log(`  Content-Type: ${r3b.headers?.['content-type']}`);
      const isTsSync = r3b.buffer[0] === 0x47;
      console.log(`  TS sync byte: ${isTsSync ? 'YES' : 'NO (encrypted)'}`);
    }
    if (r3b.error) console.log(`  Error: ${r3b.error}`);
  }
  
  /* Test 4: With Authorization header */
  console.log('\n--- Test 4: With Authorization header ---');
  const r4 = await fetch(testSeg, {
    'Referer': 'https://lefttoplay.xyz/',
    'Origin': 'https://lefttoplay.xyz',
    'Accept': '*/*',
  });
  console.log(`  Status: ${r4.status} | Size: ${r4.buffer.length} | Time: ${r4.elapsed}ms`);
  if (r4.buffer.length > 0) console.log(`  First 16 bytes: ${r4.buffer.slice(0, 16).toString('hex')}`);
  
  /* Test 5: Minimal headers */
  console.log('\n--- Test 5: Minimal headers (just UA) ---');
  const r5 = await fetch(testSeg, {});
  console.log(`  Status: ${r5.status} | Size: ${r5.buffer.length} | Time: ${r5.elapsed}ms`);
  if (r5.buffer.length > 0) console.log(`  First 16 bytes: ${r5.buffer.slice(0, 16).toString('hex')}`);
}

main().catch(console.error);
