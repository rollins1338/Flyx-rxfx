/**
 * End-to-end test for Videasy and VidSrc extraction
 * Tests the full pipeline: fetch → decrypt → get stream URL → verify stream
 */
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');

const TMDB_API_KEY = 'b89acdd87e12c283f56feb2e016b4964';

// Test cases
const TESTS = [
  { name: 'Fight Club', tmdbId: '550', type: 'movie', title: 'Fight Club', year: '1999' },
  { name: 'Breaking Bad S1E1', tmdbId: '1396', type: 'tv', title: 'Breaking Bad', year: '2008', season: 1, episode: 1 },
  { name: 'Interstellar', tmdbId: '157336', type: 'movie', title: 'Interstellar', year: '2014' },
];

// WASM helpers
let wasmInstance = null;

async function loadWasm() {
  if (wasmInstance) return wasmInstance;
  const wasmPath = path.join(process.cwd(), 'public', 'videasy-module-patched.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  const instance = await WebAssembly.instantiate(wasmModule, {
    env: {
      seed: () => Date.now() * Math.random(),
      abort: (msgPtr) => { throw new Error('WASM abort at ptr ' + msgPtr); }
    }
  });
  wasmInstance = instance;
  return instance;
}

function writeStr(instance, str) {
  const memory = instance.exports.memory;
  const __new = instance.exports.__new;
  const len = str.length;
  const ptr = (__new(len << 1, 2)) >>> 0;
  const arr = new Uint16Array(memory.buffer);
  for (let i = 0; i < len; ++i) arr[(ptr >>> 1) + i] = str.charCodeAt(i);
  return ptr;
}

function readStr(instance, ptr) {
  if (!ptr) return null;
  const memory = instance.exports.memory;
  const end = ptr + (new Uint32Array(memory.buffer)[(ptr - 4) >>> 2] >>> 1);
  const arr = new Uint16Array(memory.buffer);
  let start = ptr >>> 1;
  let result = '';
  while (end - start > 1024) result += String.fromCharCode(...arr.subarray(start, start += 1024));
  return result + String.fromCharCode(...arr.subarray(start, end));
}

// ============================================================================
// TEST 1: Videasy extraction
// ============================================================================
async function testVideasy(test) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VIDEASY TEST: ${test.name} (${test.type} ${test.tmdbId})`);
  console.log('='.repeat(60));
  
  const endpoints = ['myflixerzupcloud', '1movies', 'moviebox'];
  
  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      let url = `https://api.videasy.net/${endpoint}/sources-with-title?title=${encodeURIComponent(test.title)}&mediaType=${test.type}&year=${test.year}&tmdbId=${test.tmdbId}`;
      if (test.type === 'tv') url += `&seasonId=${test.season}&episodeId=${test.episode}`;
      
      const resp = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      });
      const fetchTime = Date.now() - start;
      
      if (!resp.ok) {
        console.log(`  [${endpoint}] HTTP ${resp.status} (${fetchTime}ms)`);
        continue;
      }
      
      const encText = (await resp.text()).trim();
      if (!encText || encText.startsWith('<') || encText.length < 50) {
        console.log(`  [${endpoint}] Invalid response: ${encText.substring(0, 50)} (${fetchTime}ms)`);
        continue;
      }
      
      // Decrypt with WASM
      const instance = await loadWasm();
      const encPtr = writeStr(instance, encText);
      const tmdbIdNum = parseInt(test.tmdbId, 10);
      const resultPtr = (instance.exports.decrypt(encPtr, tmdbIdNum)) >>> 0;
      const wasmResult = readStr(instance, resultPtr);
      
      if (!wasmResult || !wasmResult.startsWith('U2FsdGVk')) {
        console.log(`  [${endpoint}] WASM decrypt failed (${fetchTime}ms)`);
        continue;
      }
      
      // CryptoJS AES decrypt
      const decrypted = CryptoJS.AES.decrypt(wasmResult, '').toString(CryptoJS.enc.Utf8);
      const json = JSON.parse(decrypted);
      const totalTime = Date.now() - start;
      
      const streamUrl = json.sources?.[0]?.url || json.sources?.[0]?.file || '';
      const subCount = (json.subtitles?.length || 0) + (json.tracks?.length || 0);
      
      if (streamUrl) {
        console.log(`  [${endpoint}] ✓ WORKING (${totalTime}ms)`);
        console.log(`    Stream: ${streamUrl.substring(0, 80)}...`);
        console.log(`    Subtitles: ${subCount}`);
        
        // Verify stream is accessible
        try {
          const streamResp = await fetch(streamUrl, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://videasy.net/' },
            signal: AbortSignal.timeout(5000)
          });
          console.log(`    Stream check: HTTP ${streamResp.status} (${streamResp.headers.get('content-type') || 'unknown'})`);
        } catch (e) {
          console.log(`    Stream check: ${e.message}`);
        }
        return { success: true, endpoint, time: totalTime, url: streamUrl };
      } else {
        console.log(`  [${endpoint}] No stream URL in response (${totalTime}ms)`);
      }
    } catch (e) {
      const elapsed = Date.now() - start;
      console.log(`  [${endpoint}] ERROR: ${e.message} (${elapsed}ms)`);
    }
  }
  return { success: false };
}

// ============================================================================
// TEST 2: VidSrc/2embed extraction
// ============================================================================
async function testVidSrc(test) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VIDSRC TEST: ${test.name} (${test.type} ${test.tmdbId})`);
  console.log('='.repeat(60));
  
  // Test 1: Direct 2embed API
  const start = Date.now();
  try {
    const apiPath = test.type === 'tv' 
      ? `/api/m3u8/tv/${test.tmdbId}/${test.season}/${test.episode}`
      : `/api/m3u8/movie/${test.tmdbId}`;
    
    const url = `https://v1.2embed.stream${apiPath}`;
    console.log(`  [2embed API] Fetching: ${url}`);
    
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://v1.2embed.stream/' },
      signal: AbortSignal.timeout(10000)
    });
    const fetchTime = Date.now() - start;
    
    const data = await resp.json();
    console.log(`  [2embed API] Response (${fetchTime}ms):`, JSON.stringify(data).substring(0, 200));
    
    if (data.success && data.m3u8_url && !data.fallback) {
      console.log(`  [2embed API] ✓ Got m3u8 URL`);
      
      // Test the m3u8 URL
      const m3u8Resp = await fetch(data.m3u8_url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://v1.2embed.stream/' },
        signal: AbortSignal.timeout(5000)
      });
      const m3u8Text = await m3u8Resp.text();
      const totalTime = Date.now() - start;
      console.log(`  [2embed API] m3u8 status: ${m3u8Resp.status}, length: ${m3u8Text.length}, is_m3u8: ${m3u8Text.includes('#EXTM3U')} (${totalTime}ms)`);
      
      if (m3u8Text.includes('#EXTM3U')) {
        return { success: true, source: '2embed', time: totalTime, url: data.m3u8_url };
      }
    } else {
      console.log(`  [2embed API] ✗ No direct m3u8 (fallback: ${data.fallback}, message: ${data.message})`);
    }
  } catch (e) {
    console.log(`  [2embed API] ERROR: ${e.message} (${Date.now() - start}ms)`);
  }
  
  // Test 2: CF Worker extraction
  const start2 = Date.now();
  try {
    let cfUrl = `https://media-proxy.vynx.workers.dev/vidsrc/extract?tmdbId=${test.tmdbId}&type=${test.type}`;
    if (test.type === 'tv') cfUrl += `&season=${test.season}&episode=${test.episode}`;
    
    console.log(`  [CF Worker] Fetching: ${cfUrl}`);
    const resp = await fetch(cfUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    const fetchTime = Date.now() - start2;
    
    console.log(`  [CF Worker] Response (${fetchTime}ms): status=${resp.status}, success=${data.success}, error=${data.error || 'none'}`);
    
    if (data.success && data.m3u8_url) {
      console.log(`  [CF Worker] ✓ Got m3u8: ${data.m3u8_url.substring(0, 80)}`);
      return { success: true, source: 'cf-worker', time: fetchTime, url: data.m3u8_url };
    }
  } catch (e) {
    console.log(`  [CF Worker] ERROR: ${e.message} (${Date.now() - start2}ms)`);
  }
  
  return { success: false };
}

// ============================================================================
// TEST 3: RPI proxy bypass test
// ============================================================================
async function testRpiProxy() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('RPI PROXY TEST');
  console.log('='.repeat(60));
  
  const RPI_URL = 'https://rpi-proxy.vynx.cc';
  const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
  
  // Test RPI proxy health
  try {
    const resp = await fetch(`${RPI_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await resp.text();
    console.log(`  [RPI Health] ${resp.status}: ${data.substring(0, 200)}`);
  } catch (e) {
    console.log(`  [RPI Health] ERROR: ${e.message}`);
  }
  
  // Test 2embed through RPI proxy (bypass Cloudflare)
  try {
    const targetUrl = 'https://v1.2embed.stream/api/m3u8/movie/550';
    const proxyUrl = `${RPI_URL}/proxy?url=${encodeURIComponent(targetUrl)}`;
    const start = Date.now();
    const resp = await fetch(proxyUrl, {
      headers: { 'X-API-Key': RPI_KEY },
      signal: AbortSignal.timeout(10000)
    });
    const data = await resp.text();
    const elapsed = Date.now() - start;
    console.log(`  [RPI→2embed] ${resp.status} (${elapsed}ms): ${data.substring(0, 200)}`);
  } catch (e) {
    console.log(`  [RPI→2embed] ERROR: ${e.message}`);
  }
  
  // Test vidsrc-embed.ru through RPI proxy
  try {
    const targetUrl = 'https://vidsrc-embed.ru/embed/movie/550';
    const proxyUrl = `${RPI_URL}/proxy?url=${encodeURIComponent(targetUrl)}`;
    const start = Date.now();
    const resp = await fetch(proxyUrl, {
      headers: { 'X-API-Key': RPI_KEY },
      signal: AbortSignal.timeout(10000)
    });
    const data = await resp.text();
    const elapsed = Date.now() - start;
    console.log(`  [RPI→vidsrc-embed] ${resp.status} (${elapsed}ms), length: ${data.length}`);
    // Check for Cloudflare challenge
    if (data.includes('cf-turnstile') || data.includes('challenge-platform')) {
      console.log(`  [RPI→vidsrc-embed] ⚠ Cloudflare challenge detected`);
    } else if (data.includes('cloudnestra') || data.includes('rcp/')) {
      console.log(`  [RPI→vidsrc-embed] ✓ Got embed page with RCP iframe`);
      const rcpMatch = data.match(/src=["'](https?:\/\/[^"']+\/rcp\/[^"']+)["']/i);
      if (rcpMatch) console.log(`  [RPI→vidsrc-embed] RCP URL: ${rcpMatch[1].substring(0, 80)}`);
    }
  } catch (e) {
    console.log(`  [RPI→vidsrc-embed] ERROR: ${e.message}`);
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function main() {
  console.log('Starting end-to-end extraction tests...\n');
  
  const results = { videasy: [], vidsrc: [] };
  
  for (const test of TESTS) {
    const vResult = await testVideasy(test);
    results.videasy.push({ ...test, ...vResult });
    
    const sResult = await testVidSrc(test);
    results.vidsrc.push({ ...test, ...sResult });
  }
  
  await testRpiProxy();
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nVideasy:');
  for (const r of results.videasy) {
    console.log(`  ${r.name}: ${r.success ? `✓ ${r.endpoint} (${r.time}ms)` : '✗ FAILED'}`);
  }
  
  console.log('\nVidSrc/2embed:');
  for (const r of results.vidsrc) {
    console.log(`  ${r.name}: ${r.success ? `✓ ${r.source} (${r.time}ms)` : '✗ FAILED'}`);
  }
}

main().catch(e => console.error('FATAL:', e));
