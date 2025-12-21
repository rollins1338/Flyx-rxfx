/**
 * Test Flixer Cloudflare Proxy Logic
 * 
 * This tests the same WASM loading and API request logic that will run
 * in the Cloudflare Worker, but locally using Node.js.
 * 
 * Tests:
 * 1. WASM loading and key generation
 * 2. Server time synchronization
 * 3. Authenticated API requests
 * 4. Response decryption
 * 5. URL extraction for both movies and TV shows
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FLIXER_API_BASE = 'https://plsdontscrapemelove.flixer.sh';
const WASM_PATH = path.join(__dirname, 'wasm-analysis/client-assets/img_data_bg.wasm');

// Server name mapping
const SERVER_NAMES = {
  alpha: 'Ares',
  bravo: 'Balder', 
  charlie: 'Circe',
  delta: 'Dionysus',
  echo: 'Eros',
  foxtrot: 'Freya',
};

let serverTimeOffset = 0;

/**
 * Sync with Flixer server time
 */
async function syncServerTime() {
  console.log('⏱️  Syncing server time...');
  const localTimeBefore = Date.now();
  const response = await fetch(`${FLIXER_API_BASE}/api/time?t=${localTimeBefore}`);
  const localTimeAfter = Date.now();
  const data = await response.json();
  
  const rtt = localTimeAfter - localTimeBefore;
  const serverTimeMs = data.timestamp * 1000;
  serverTimeOffset = serverTimeMs + (rtt / 2) - localTimeAfter;
  
  console.log(`   Server timestamp: ${data.timestamp}`);
  console.log(`   RTT: ${rtt}ms`);
  console.log(`   Offset: ${serverTimeOffset}ms`);
}

function getServerTimestamp() {
  return Math.floor((Date.now() + serverTimeOffset) / 1000);
}

/**
 * Generate client fingerprint (same as CF proxy)
 */
function generateClientFingerprint() {
  const screenWidth = 2560;
  const screenHeight = 1440;
  const colorDepth = 24;
  const platform = 'Win32';
  const language = 'en-US';
  const timezoneOffset = new Date().getTimezoneOffset();
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
  const canvasSubstr = 'iVBORw0KGgoAAAANSUhEUgAAASwA';
  
  const fpString = `${screenWidth}x${screenHeight}:${colorDepth}:${userAgent.substring(0, 50)}:${platform}:${language}:${timezoneOffset}:${canvasSubstr}`;
  
  let hash = 0;
  for (let i = 0; i < fpString.length; i++) {
    hash = (hash << 5) - hash + fpString.charCodeAt(i);
    hash &= hash;
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Make authenticated API request (same logic as CF proxy)
 */
async function makeFlixerRequest(apiKey, urlPath, extraHeaders = {}) {
  const timestamp = getServerTimestamp();
  const nonce = crypto.randomBytes(16).toString('base64')
    .replace(/[/+=]/g, '').substring(0, 22);
  
  const message = `${apiKey}:${timestamp}:${nonce}:${urlPath}`;
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(message)
    .digest('base64');
  
  const fingerprint = generateClientFingerprint();
  
  const headers = {
    'X-Api-Key': apiKey,
    'X-Request-Timestamp': timestamp.toString(),
    'X-Request-Nonce': nonce,
    'X-Request-Signature': signature,
    'X-Client-Fingerprint': fingerprint,
    'Accept': 'text/plain',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'Referer': 'https://flixer.sh/',
    'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    ...extraHeaders,
  };
  
  // CRITICAL: Do NOT send bW90aGFmYWth, Origin, or sec-fetch-* headers
  
  const response = await fetch(`${FLIXER_API_BASE}${urlPath}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return response.text();
}

/**
 * Load WASM and get API key (using existing Node.js loader)
 */
async function loadWasmAndGetKey() {
  console.log('📦 Loading WASM module...');
  
  // Use the existing working WASM loader
  const { FlixerWasmLoader } = require('./flixer-wasm-node.js');
  
  const loader = new FlixerWasmLoader({
    sessionId: crypto.randomBytes(16).toString('hex'),
    debug: false,
  });
  
  await loader.initialize();
  const apiKey = loader.getImgKey();
  
  console.log(`   Key generated: ${apiKey.slice(0, 16)}...`);
  console.log(`   Key length: ${apiKey.length} chars`);
  
  return { loader, apiKey };
}

/**
 * Get source from a specific server with retries
 */
async function getSourceFromServer(loader, apiKey, type, tmdbId, server, seasonId, episodeId, retries = 5) {
  const path = type === 'movie'
    ? `/api/tmdb/movie/${tmdbId}/images`
    : `/api/tmdb/tv/${tmdbId}/season/${seasonId}/episode/${episodeId}/images`;

  console.log(`\n🔄 Trying server: ${server} (${SERVER_NAMES[server] || server})`);
  
  // Warm-up request
  console.log('   Making warm-up request...');
  try {
    await makeFlixerRequest(apiKey, path, {});
  } catch (e) {
    // Expected
  }
  
  await new Promise(r => setTimeout(r, 100));

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`   Attempt ${attempt}/${retries}...`);
    
    try {
      const encrypted = await makeFlixerRequest(apiKey, path, {
        'X-Only-Sources': '1',
        'X-Server': server,
      });

      const decrypted = await loader.processImgData(encrypted, apiKey);
      const data = JSON.parse(decrypted);

      // Extract URL
      let url = null;
      
      if (Array.isArray(data.sources)) {
        const source = data.sources.find(s => s.server === server) || data.sources[0];
        url = source?.url || source?.file || source?.stream;
        if (!url && source?.sources) {
          url = source.sources[0]?.url || source.sources[0]?.file;
        }
      }
      
      if (!url) {
        url = data.sources?.file || data.sources?.url || data.file || data.url || data.stream;
      }
      
      if (!url && data.servers && data.servers[server]) {
        const serverData = data.servers[server];
        url = serverData.url || serverData.file || serverData.stream;
        if (Array.isArray(serverData)) {
          url = serverData[0]?.url || serverData[0]?.file;
        }
      }

      if (url && url.trim() !== '') {
        console.log(`   ✅ Found URL on attempt ${attempt}`);
        return { url, raw: data };
      }
      
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
      if (attempt === retries) throw e;
    }
  }

  return { url: null, raw: null };
}

/**
 * Main test function
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FLIXER CLOUDFLARE PROXY LOGIC TEST');
  console.log('  Testing the same logic that will run in CF Worker');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = {
    wasmLoad: false,
    serverTimeSync: false,
    movieExtraction: false,
    tvExtraction: false,
  };

  try {
    // Test 1: Server time sync
    console.log('TEST 1: Server Time Synchronization');
    console.log('────────────────────────────────────');
    await syncServerTime();
    results.serverTimeSync = true;
    console.log('✅ Server time sync: PASSED\n');

    // Test 2: WASM loading
    console.log('TEST 2: WASM Loading & Key Generation');
    console.log('──────────────────────────────────────');
    const { loader, apiKey } = await loadWasmAndGetKey();
    results.wasmLoad = true;
    console.log('✅ WASM loading: PASSED\n');

    // Test 3: Movie extraction (Inception - TMDB ID 27205)
    console.log('TEST 3: Movie Extraction (Inception)');
    console.log('────────────────────────────────────');
    const movieResult = await getSourceFromServer(loader, apiKey, 'movie', '27205', 'alpha', null, null, 3);
    
    if (movieResult.url) {
      results.movieExtraction = true;
      console.log(`\n✅ Movie extraction: PASSED`);
      console.log(`   URL: ${movieResult.url.substring(0, 80)}...`);
    } else {
      console.log('\n❌ Movie extraction: FAILED - No URL found');
    }

    // Test 4: TV Show extraction (Arcane S1E1 - TMDB ID 94605)
    console.log('\nTEST 4: TV Show Extraction (Arcane S1E1)');
    console.log('────────────────────────────────────────');
    const tvResult = await getSourceFromServer(loader, apiKey, 'tv', '94605', 'alpha', '1', '1', 3);
    
    if (tvResult.url) {
      results.tvExtraction = true;
      console.log(`\n✅ TV extraction: PASSED`);
      console.log(`   URL: ${tvResult.url.substring(0, 80)}...`);
    } else {
      console.log('\n❌ TV extraction: FAILED - No URL found');
    }

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    if (error.stack) console.error(error.stack);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Server Time Sync:  ${results.serverTimeSync ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  WASM Loading:      ${results.wasmLoad ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Movie Extraction:  ${results.movieExtraction ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  TV Extraction:     ${results.tvExtraction ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED - Ready to deploy!' : '⚠️  Some tests failed - Review before deploying'}\n`);
  
  return allPassed;
}

// Run tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
