/**
 * DLHD End-to-End Verification
 * 
 * Tests the FULL pipeline:
 * 1. Fetch auth from lefttoplay.xyz (new primary domain)
 * 2. server_lookup for channel
 * 3. Fetch M3U8 playlist
 * 4. Parse M3U8 → extract key URL + segment URLs
 * 5. Fetch a segment (should work without auth)
 * 6. Fetch the key (needs EPlayerAuth headers)
 */

const https = require('https');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetch(url, headers = {}, timeout = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const opts = {
      headers: { 'User-Agent': UA, ...headers },
      timeout,
      rejectUnauthorized: false,
    };
    const req = https.get(url, opts, (res) => {
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
        });
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message, elapsed: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', elapsed: Date.now() - start }); });
  });
}

/* ---- MD5 (for PoW) ---- */
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/* ---- HMAC-SHA256 ---- */
function hmacSha256(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/* ---- SHA-256 (for fingerprint) ---- */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateFingerprint() {
  const data = UA + '1920x1080' + 'America/New_York' + 'en-US';
  return sha256(data).substring(0, 16);
}

function computePowNonce(channelKey, keyNumber, timestamp, channelSalt) {
  const hmacPrefix = hmacSha256(channelKey, channelSalt);
  const threshold = 0x1000;
  for (let nonce = 0; nonce < 100000; nonce++) {
    const data = hmacPrefix + channelKey + keyNumber + timestamp + nonce;
    const hash = md5(data);
    if (parseInt(hash.substring(0, 4), 16) < threshold) {
      return nonce;
    }
  }
  return 99999;
}

function computeKeyPath(resource, keyNumber, timestamp, fingerprint, channelSalt) {
  const data = `${resource}|${keyNumber}|${timestamp}|${fingerprint}`;
  return hmacSha256(data, channelSalt).substring(0, 16);
}


async function main() {
  const channelId = '51'; // ABC USA
  console.log('='.repeat(70));
  console.log('DLHD END-TO-END VERIFICATION');
  console.log('Channel:', channelId, '(ABC USA)');
  console.log('='.repeat(70));

  // =====================================================================
  // STEP 1: Fetch auth from lefttoplay.xyz
  // =====================================================================
  console.log('\n[STEP 1] Fetching auth from lefttoplay.xyz...');
  const authUrl = `https://lefttoplay.xyz/premiumtv/daddyhd.php?id=${channelId}`;
  const authRes = await fetch(authUrl, { 'Referer': 'https://dlhd.link/' });
  
  if (authRes.status !== 200) {
    console.log(`  FAIL: status=${authRes.status} error=${authRes.error}`);
    return;
  }
  
  const epaMatch = authRes.text.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
  if (!epaMatch) {
    console.log('  FAIL: No EPlayerAuth.init() found in page');
    return;
  }
  
  const initStr = epaMatch[1];
  const authToken = initStr.match(/authToken\s*:\s*'([^']+)'/)?.[1];
  const channelKey = initStr.match(/channelKey\s*:\s*'([^']+)'/)?.[1];
  const channelSalt = initStr.match(/channelSalt\s*:\s*'([^']+)'/)?.[1];
  const timestamp = initStr.match(/timestamp\s*:\s*(\d+)/)?.[1];
  
  if (!authToken || !channelSalt) {
    console.log('  FAIL: Missing authToken or channelSalt');
    console.log('  initStr:', initStr.substring(0, 200));
    return;
  }
  
  console.log(`  OK: authToken=${authToken.substring(0, 40)}...`);
  console.log(`  OK: channelKey=${channelKey}`);
  console.log(`  OK: channelSalt=${channelSalt.substring(0, 20)}...`);
  console.log(`  OK: timestamp=${timestamp}`);
  console.log(`  Time: ${authRes.elapsed}ms`);

  // =====================================================================
  // STEP 2: server_lookup
  // =====================================================================
  console.log('\n[STEP 2] Server lookup...');
  const lookupUrl = `https://chevy.dvalna.ru/server_lookup?channel_id=${channelKey}`;
  const lookupRes = await fetch(lookupUrl, { 'Referer': 'https://lefttoplay.xyz/' });
  
  let server = 'zeko'; // fallback
  if (lookupRes.status === 200) {
    try {
      const data = JSON.parse(lookupRes.text);
      server = data.server_key;
      console.log(`  OK: server=${server} (${lookupRes.elapsed}ms)`);
    } catch {
      console.log(`  WARN: Could not parse server_lookup, using fallback: ${server}`);
    }
  } else {
    console.log(`  WARN: server_lookup failed (${lookupRes.status}), using fallback: ${server}`);
  }

  // =====================================================================
  // STEP 3: Fetch M3U8 playlist
  // =====================================================================
  console.log('\n[STEP 3] Fetching M3U8 playlist...');
  const m3u8Url = `https://${server}new.dvalna.ru/${server}/${channelKey}/mono.css`;
  console.log(`  URL: ${m3u8Url}`);
  
  const m3u8Res = await fetch(m3u8Url, {
    'Referer': 'https://lefttoplay.xyz/',
    'Origin': 'https://lefttoplay.xyz',
    'Authorization': `Bearer ${authToken}`,
  });
  
  if (m3u8Res.status !== 200 || !m3u8Res.text.includes('#EXTM3U')) {
    console.log(`  FAIL: status=${m3u8Res.status} isM3U8=${m3u8Res.text.includes('#EXTM3U')}`);
    console.log(`  Body preview: ${m3u8Res.text.substring(0, 200)}`);
    return;
  }
  
  console.log(`  OK: Valid M3U8 (${m3u8Res.text.length} bytes, ${m3u8Res.elapsed}ms)`);
  
  // Parse M3U8
  const lines = m3u8Res.text.split('\n');
  let keyUrl = null;
  let keyIV = null;
  const segments = [];
  
  for (const line of lines) {
    const keyMatch = line.match(/URI="([^"]+)"/);
    if (keyMatch) keyUrl = keyMatch[1];
    const ivMatch = line.match(/IV=0x([0-9a-fA-F]+)/);
    if (ivMatch) keyIV = ivMatch[1];
    if (line.trim() && !line.startsWith('#')) {
      // Segment URL - could be relative or absolute
      let segUrl = line.trim();
      if (!segUrl.startsWith('http')) {
        // Relative URL - resolve against M3U8 base
        const base = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        segUrl = base + segUrl;
      }
      segments.push(segUrl);
    }
  }
  
  console.log(`  Segments: ${segments.length}`);
  console.log(`  Key URL: ${keyUrl || 'NONE'}`);
  console.log(`  Key IV: ${keyIV ? keyIV.substring(0, 16) + '...' : 'NONE'}`);
  
  if (segments.length > 0) {
    console.log(`  First segment: ${segments[0]}`);
    console.log(`  Last segment: ${segments[segments.length - 1]}`);
  }
  
  // Print full M3U8 for reference
  console.log('\n  --- M3U8 Content ---');
  for (const line of lines) {
    if (line.trim()) console.log('  ' + line);
  }
  console.log('  --- End M3U8 ---');

  // =====================================================================
  // STEP 4: Fetch a segment (should work without special auth)
  // =====================================================================
  if (segments.length > 0) {
    console.log('\n[STEP 4] Fetching first segment...');
    const segUrl = segments[0];
    console.log(`  URL: ${segUrl}`);
    
    const segRes = await fetch(segUrl, {
      'Referer': 'https://lefttoplay.xyz/',
      'Origin': 'https://lefttoplay.xyz',
    });
    
    console.log(`  Status: ${segRes.status}`);
    console.log(`  Size: ${segRes.buffer.length} bytes`);
    console.log(`  Content-Type: ${segRes.headers?.['content-type'] || 'unknown'}`);
    console.log(`  Time: ${segRes.elapsed}ms`);
    
    if (segRes.status === 200 && segRes.buffer.length > 100) {
      // Check if it looks like a TS segment (starts with 0x47 sync byte)
      const firstByte = segRes.buffer[0];
      const isTsSync = firstByte === 0x47;
      // Or it could be encrypted (AES-128-CBC), in which case first bytes are random
      console.log(`  First 16 bytes (hex): ${segRes.buffer.slice(0, 16).toString('hex')}`);
      console.log(`  TS sync byte (0x47): ${isTsSync ? 'YES (unencrypted)' : 'NO (likely encrypted)'}`);
      console.log(`  SEGMENT FETCH: OK`);
    } else {
      console.log(`  SEGMENT FETCH: FAIL`);
      if (segRes.buffer.length < 500) {
        console.log(`  Body: ${segRes.text}`);
      }
    }
  }

  // =====================================================================
  // STEP 5: Fetch the encryption key (needs EPlayerAuth headers)
  // =====================================================================
  if (keyUrl) {
    console.log('\n[STEP 5] Fetching encryption key...');
    console.log(`  Key URL: ${keyUrl}`);
    
    // Extract resource and keyNumber from key URL
    // Format: https://chevy.dvalna.ru/key/premium51/5905161
    const keyParts = keyUrl.match(/\/key\/([^/]+)\/(\d+)/);
    if (!keyParts) {
      console.log('  FAIL: Could not parse key URL');
      return;
    }
    
    const resource = keyParts[1];
    const keyNumber = keyParts[2];
    console.log(`  Resource: ${resource}, KeyNumber: ${keyNumber}`);
    
    // Compute auth headers
    const keyTimestamp = Math.floor(Date.now() / 1000);
    const fingerprint = generateFingerprint();
    const nonce = computePowNonce(resource, keyNumber, keyTimestamp, channelSalt);
    const keyPath = computeKeyPath(resource, keyNumber, keyTimestamp, fingerprint, channelSalt);
    
    console.log(`  Timestamp: ${keyTimestamp}`);
    console.log(`  Fingerprint: ${fingerprint}`);
    console.log(`  PoW Nonce: ${nonce}`);
    console.log(`  Key Path: ${keyPath}`);
    
    const keyHeaders = {
      'Referer': 'https://lefttoplay.xyz/',
      'Origin': 'https://lefttoplay.xyz',
      'Authorization': `Bearer ${authToken}`,
      'X-Key-Timestamp': keyTimestamp.toString(),
      'X-Key-Nonce': nonce.toString(),
      'X-Key-Path': keyPath,
      'X-Fingerprint': fingerprint,
    };
    
    console.log('\n  Fetching key with auth headers...');
    const keyRes = await fetch(keyUrl, keyHeaders);
    
    console.log(`  Status: ${keyRes.status}`);
    console.log(`  Size: ${keyRes.buffer.length} bytes`);
    console.log(`  Content-Type: ${keyRes.headers?.['content-type'] || 'unknown'}`);
    console.log(`  Time: ${keyRes.elapsed}ms`);
    
    if (keyRes.status === 200 && keyRes.buffer.length === 16) {
      const keyHex = keyRes.buffer.toString('hex');
      console.log(`  Key (hex): ${keyHex}`);
      
      // Check for known fake/error patterns
      const isFake = keyHex.startsWith('455806f8') || keyHex.startsWith('45c6497');
      const isError = keyHex.startsWith('6572726f72'); // "error" in hex
      
      if (isFake) {
        console.log('  WARNING: This is a FAKE/DECOY key!');
        console.log('  KEY FETCH: FAKE KEY (auth may be wrong or IP blocked)');
      } else if (isError) {
        console.log(`  WARNING: Error encoded as key: ${keyRes.buffer.toString('utf8')}`);
        console.log('  KEY FETCH: ERROR RESPONSE');
      } else {
        console.log('  KEY FETCH: OK (appears to be a real key)');
      }
    } else if (keyRes.status === 200 && keyRes.buffer.length !== 16) {
      console.log(`  Body: ${keyRes.text.substring(0, 200)}`);
      console.log('  KEY FETCH: WRONG SIZE (expected 16 bytes)');
    } else if (keyRes.status === 429) {
      console.log('  KEY FETCH: RATE LIMITED (429)');
      console.log(`  Body: ${keyRes.text.substring(0, 200)}`);
    } else if (keyRes.status === 403) {
      console.log('  KEY FETCH: FORBIDDEN (403) - auth headers may be wrong');
      console.log(`  Body: ${keyRes.text.substring(0, 200)}`);
    } else {
      console.log(`  Body: ${keyRes.text.substring(0, 200)}`);
      console.log('  KEY FETCH: FAIL');
    }
    
    // Also try WITHOUT auth headers to see what happens
    console.log('\n  Fetching key WITHOUT auth headers (control test)...');
    const keyResNoAuth = await fetch(keyUrl, {
      'Referer': 'https://lefttoplay.xyz/',
      'Origin': 'https://lefttoplay.xyz',
    });
    console.log(`  Status: ${keyResNoAuth.status}`);
    console.log(`  Size: ${keyResNoAuth.buffer.length} bytes`);
    if (keyResNoAuth.buffer.length === 16) {
      const noAuthKeyHex = keyResNoAuth.buffer.toString('hex');
      console.log(`  Key (hex): ${noAuthKeyHex}`);
      const isFake = noAuthKeyHex.startsWith('455806f8') || noAuthKeyHex.startsWith('45c6497');
      console.log(`  Is fake: ${isFake}`);
    } else {
      console.log(`  Body: ${keyResNoAuth.text.substring(0, 200)}`);
    }
  }

  // =====================================================================
  // STEP 6: Try fetching a SECOND segment to confirm consistency
  // =====================================================================
  if (segments.length > 1) {
    console.log('\n[STEP 6] Fetching second segment (consistency check)...');
    const seg2Url = segments[1];
    console.log(`  URL: ${seg2Url}`);
    
    const seg2Res = await fetch(seg2Url, {
      'Referer': 'https://lefttoplay.xyz/',
      'Origin': 'https://lefttoplay.xyz',
    });
    
    console.log(`  Status: ${seg2Res.status}`);
    console.log(`  Size: ${seg2Res.buffer.length} bytes`);
    console.log(`  Time: ${seg2Res.elapsed}ms`);
    
    if (seg2Res.status === 200 && seg2Res.buffer.length > 100) {
      console.log(`  First 16 bytes (hex): ${seg2Res.buffer.slice(0, 16).toString('hex')}`);
      console.log('  SEGMENT 2 FETCH: OK');
    } else {
      console.log('  SEGMENT 2 FETCH: FAIL');
    }
  }

  // =====================================================================
  // SUMMARY
  // =====================================================================
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Auth (lefttoplay.xyz):  ${authRes.status === 200 && authToken ? 'OK' : 'FAIL'} (${authRes.elapsed}ms)`);
  console.log(`Server lookup:          ${lookupRes.status === 200 ? 'OK' : 'FAIL'} (${lookupRes.elapsed}ms) → ${server}`);
  console.log(`M3U8 playlist:          ${m3u8Res.status === 200 ? 'OK' : 'FAIL'} (${m3u8Res.elapsed}ms) → ${segments.length} segments`);
}

main().catch(console.error);
