/**
 * Test the deployed DLHD worker end-to-end
 * 
 * 1. Hit /play/51 to get the rewritten M3U8
 * 2. Parse the M3U8 to get proxied key + segment URLs
 * 3. Fetch a segment through the worker's /dlhdprivate proxy
 * 4. Fetch the key through the worker's /dlhdprivate proxy
 * 5. Verify we get valid data
 */

const https = require('https');

const WORKER_URL = 'https://dlhd.vynx.workers.dev';
const API_KEY = 'vynx';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetch(url, headers = {}, timeout = 30000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsedUrl = new URL(url);
    const opts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { 'User-Agent': UA, ...headers },
      timeout,
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
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
    req.end();
  });
}

async function main() {
  const channelId = '51';
  console.log('='.repeat(70));
  console.log('DLHD DEPLOYED WORKER E2E TEST');
  console.log('Worker:', WORKER_URL);
  console.log('Channel:', channelId);
  console.log('='.repeat(70));

  /* STEP 1: Fetch /play/:channelId */
  console.log('\n[STEP 1] Fetching /play/' + channelId + '...');
  const playUrl = `${WORKER_URL}/play/${channelId}?key=${API_KEY}`;
  const playRes = await fetch(playUrl, {
    'Accept': 'application/vnd.apple.mpegurl',
  });
  
  console.log(`  Status: ${playRes.status}`);
  console.log(`  Size: ${playRes.buffer.length} bytes`);
  console.log(`  Content-Type: ${playRes.headers?.['content-type']}`);
  console.log(`  X-DLHD-Server: ${playRes.headers?.['x-dlhd-server'] || 'N/A'}`);
  console.log(`  Time: ${playRes.elapsed}ms`);
  
  if (playRes.status !== 200) {
    console.log(`  FAIL: ${playRes.text.substring(0, 300)}`);
    return;
  }
  
  const isM3U8 = playRes.text.includes('#EXTM3U');
  if (!isM3U8) {
    console.log('  FAIL: Response is not a valid M3U8');
    console.log('  Body:', playRes.text.substring(0, 500));
    return;
  }
  
  console.log('  OK: Valid M3U8 received');
  
  /* Parse the rewritten M3U8 */
  const lines = playRes.text.split('\n');
  let keyLine = null;
  const segments = [];
  
  for (const line of lines) {
    if (line.includes('#EXT-X-KEY')) keyLine = line;
    if (line.trim() && !line.startsWith('#') && line.includes('dlhdprivate')) {
      segments.push(line.trim());
    }
  }
  
  console.log(`\n  Parsed M3U8:`);
  console.log(`  Segments: ${segments.length}`);
  console.log(`  Has key line: ${!!keyLine}`);
  
  /* Print full M3U8 */
  console.log('\n  --- Rewritten M3U8 ---');
  for (const line of lines) {
    if (line.trim()) {
      const display = line.length > 150 ? line.substring(0, 150) + '...' : line;
      console.log('  ' + display);
    }
  }
  console.log('  --- End M3U8 ---');

  /* STEP 2: Fetch a segment through /dlhdprivate */
  if (segments.length > 0) {
    console.log('\n[STEP 2] Fetching segment through /dlhdprivate...');
    const segUrl = segments[0];
    console.log(`  URL: ${segUrl.substring(0, 120)}...`);
    
    const segRes = await fetch(segUrl);
    console.log(`  Status: ${segRes.status}`);
    console.log(`  Size: ${segRes.buffer.length} bytes`);
    console.log(`  Content-Type: ${segRes.headers?.['content-type']}`);
    console.log(`  Time: ${segRes.elapsed}ms`);
    
    if (segRes.status === 200 && segRes.buffer.length > 100) {
      console.log(`  First 16 bytes: ${segRes.buffer.slice(0, 16).toString('hex')}`);
      const isTsSync = segRes.buffer[0] === 0x47;
      console.log(`  TS sync: ${isTsSync ? 'YES (unencrypted)' : 'NO (encrypted - expected for AES-128)'}`);
      console.log('  SEGMENT: OK');
    } else {
      console.log('  SEGMENT: FAIL');
      if (segRes.buffer.length < 1000) console.log(`  Body: ${segRes.text}`);
    }
    
    /* Also test second segment */
    if (segments.length > 1) {
      console.log('\n[STEP 2b] Fetching second segment...');
      const seg2Res = await fetch(segments[1]);
      console.log(`  Status: ${seg2Res.status} | Size: ${seg2Res.buffer.length} | Time: ${seg2Res.elapsed}ms`);
      if (seg2Res.status === 200 && seg2Res.buffer.length > 100) {
        console.log('  SEGMENT 2: OK');
      } else {
        console.log('  SEGMENT 2: FAIL');
        if (seg2Res.buffer.length < 1000) console.log(`  Body: ${seg2Res.text}`);
      }
    }
  }

  /* STEP 3: Fetch the key through /dlhdprivate */
  if (keyLine) {
    console.log('\n[STEP 3] Fetching key through /dlhdprivate...');
    const uriMatch = keyLine.match(/URI="([^"]+)"/);
    if (uriMatch) {
      const keyUrl = uriMatch[1];
      console.log(`  URL: ${keyUrl.substring(0, 120)}...`);
      
      const keyRes = await fetch(keyUrl);
      console.log(`  Status: ${keyRes.status}`);
      console.log(`  Size: ${keyRes.buffer.length} bytes`);
      console.log(`  Content-Type: ${keyRes.headers?.['content-type']}`);
      console.log(`  X-Fetched-By: ${keyRes.headers?.['x-fetched-by'] || 'N/A'}`);
      console.log(`  Time: ${keyRes.elapsed}ms`);
      
      if (keyRes.status === 200 && keyRes.buffer.length === 16) {
        const keyHex = keyRes.buffer.toString('hex');
        console.log(`  Key (hex): ${keyHex}`);
        const isFake = keyHex.startsWith('455806f8') || keyHex.startsWith('45c6497');
        const isError = keyHex.startsWith('6572726f72');
        if (isFake) {
          console.log('  KEY: FAKE/DECOY');
        } else if (isError) {
          console.log('  KEY: ERROR ENCODED');
        } else {
          console.log('  KEY: OK (real key)');
        }
      } else {
        console.log('  KEY: FAIL');
        if (keyRes.buffer.length < 500) console.log(`  Body: ${keyRes.text}`);
      }
    }
  }

  /* SUMMARY */
  console.log('\n' + '='.repeat(70));
  console.log('E2E TEST COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
