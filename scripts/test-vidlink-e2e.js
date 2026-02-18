// End-to-end test of the new VidLink extractor flow
// Tests: mercury → sodium → WASM → token → API → parse response

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro',
};

async function initWasm() {
  // Browser-like globals
  globalThis.window = globalThis;
  globalThis.self = globalThis;
  globalThis.document = {
    createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, innerHTML: '' },
    getElementById: () => null,
    domain: 'vidlink.pro',
  };
  globalThis.location = { href: 'https://vidlink.pro/', hostname: 'vidlink.pro', origin: 'https://vidlink.pro' };

  // Mercury
  const mercResp = await fetch('https://vidlink.pro/api/mercury?tmdbId=0&type=movie', {
    headers: HEADERS, signal: AbortSignal.timeout(15000)
  });
  const mercText = await mercResp.text();
  const varMatch = mercText.match(/window\['([^']+)'\]\s*=\s*'([^']+)'/);
  if (!varMatch) throw new Error('No mercury variable');
  globalThis[varMatch[1]] = varMatch[2];
  console.log(`✓ Mercury: ${varMatch[1]}`);

  // Sodium
  const sodium = require('libsodium-wrappers');
  await sodium.ready;
  globalThis.sodium = sodium;
  console.log('✓ Sodium loaded');

  // WASM
  eval(fs.readFileSync('scripts/vidlink-script.js', 'utf8'));
  const wasmResp = await fetch('https://vidlink.pro/fu.wasm', {
    headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000)
  });
  const wasmBuf = await wasmResp.arrayBuffer();
  const go = new globalThis.Dm();
  const wasmModule = await WebAssembly.compile(wasmBuf);
  const instance = await WebAssembly.instantiate(wasmModule, go.importObject);
  go.run(instance).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  if (typeof globalThis.getAdv !== 'function') throw new Error('getAdv not available');
  console.log('✓ WASM initialized');
}

async function testExtraction(tmdbId, type, season, episode, label) {
  console.log(`\n=== ${label} (${type} ${tmdbId}) ===`);
  
  const token = globalThis.getAdv(tmdbId);
  if (!token) { console.log('✗ Token generation failed'); return false; }
  
  const encodedToken = encodeURIComponent(token);
  const url = type === 'movie'
    ? `https://vidlink.pro/api/b/movie/${encodedToken}?multiLang=1`
    : `https://vidlink.pro/api/b/tv/${encodedToken}/${season}/${episode}?multiLang=1`;
  
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const text = await resp.text();
  
  if (resp.status !== 200 || text.length === 0) {
    console.log(`✗ API: status=${resp.status} len=${text.length}`);
    return false;
  }
  
  const data = JSON.parse(text);
  
  if (data.stream?.playlist) {
    console.log(`✓ sourceId: ${data.sourceId}`);
    console.log(`✓ playlist: ${data.stream.playlist.substring(0, 80)}...`);
    console.log(`✓ captions: ${data.stream.captions?.length || 0}`);
    console.log(`✓ type: ${data.stream.type}`);
    return true;
  } else if (data.sources?.length > 0) {
    console.log(`✓ Legacy format: ${data.sources.length} sources`);
    return true;
  } else {
    console.log('✗ No stream data in response');
    console.log('  Response:', JSON.stringify(data).substring(0, 300));
    return false;
  }
}

async function run() {
  await initWasm();
  
  let passed = 0;
  let total = 0;
  
  const tests = [
    ['550', 'movie', null, null, 'Fight Club'],
    ['507089', 'movie', null, null, 'Five Nights at Freddys'],
    ['1396', 'tv', 1, 1, 'Breaking Bad S1E1'],
    ['94997', 'tv', 1, 1, 'House of the Dragon S1E1'],
    ['299536', 'movie', null, null, 'Avengers: Infinity War'],
  ];
  
  for (const [id, type, s, e, label] of tests) {
    total++;
    try {
      if (await testExtraction(id, type, s, e, label)) passed++;
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
    }
  }
  
  console.log(`\n=== Results: ${passed}/${total} passed ===`);
  process.exit(passed === total ? 0 : 1);
}

run().catch(e => { console.log('Fatal:', e.message); process.exit(1); });
