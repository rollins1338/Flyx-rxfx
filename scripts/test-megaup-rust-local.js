#!/usr/bin/env node
/**
 * Full MegaUpCDN bypass using local rust-fetch binary on Windows.
 * 
 * Flow:
 *   1. rust-fetch.exe hits MegaUp /media/{videoId} with Chrome-like TLS fingerprint
 *   2. Decrypt via enc-dec.app API (keystream is per-video, not static)
 *   3. Extract the HLS stream URL
 */

const { execFileSync } = require('child_process');
const path = require('path');

const RUST_FETCH = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Test embed URLs
const TEST_EMBEDS = [
  { name: 'Gachiakuta', url: 'https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCQ' },
  { name: 'Naruto', url: 'https://megaup22.online/e/k5OoeWapWS2JcOLzF79O5xvpCQ' },
];

function rustFetch(url) {
  const args = ['--url', url, '--timeout', '15', '--headers', JSON.stringify({ 'User-Agent': MEGAUP_UA })];
  try {
    return execFileSync(RUST_FETCH, args, { encoding: 'utf8', timeout: 20000, windowsHide: true }).trim();
  } catch (err) {
    if (err.stdout) return err.stdout.trim();
    throw err;
  }
}

async function decryptViaAPI(encrypted) {
  const resp = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, agent: MEGAUP_UA }),
  });
  const result = await resp.json();
  if (result.status !== 200) throw new Error(`API error: ${JSON.stringify(result)}`);
  return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
}

async function testMegaUpBypass(name, embedUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`Embed:   ${embedUrl}`);
  console.log('='.repeat(60));

  const match = embedUrl.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
  if (!match) { console.log('FAIL: Invalid URL'); return false; }

  const [, host, videoId] = match;
  const mediaUrl = `https://${host}/media/${videoId}`;
  console.log(`\n[1] rust-fetch -> ${mediaUrl}`);

  let rawResponse;
  try { rawResponse = rustFetch(mediaUrl); }
  catch (err) { console.log(`FAIL: rust-fetch error: ${err.message}`); return false; }

  let mediaData;
  try { mediaData = JSON.parse(rawResponse); }
  catch { console.log(`FAIL: Not JSON: ${rawResponse.substring(0, 200)}`); return false; }

  if (mediaData.status !== 200 || !mediaData.result) {
    console.log(`FAIL: MegaUp API error:`, JSON.stringify(mediaData).substring(0, 300));
    return false;
  }
  console.log(`[2] Got encrypted data (${mediaData.result.length} chars)`);

  let decrypted;
  try {
    decrypted = await decryptViaAPI(mediaData.result);
    console.log(`[3] Decrypted: ${decrypted.substring(0, 120)}...`);
  } catch (err) { console.log(`FAIL: Decrypt error: ${err.message}`); return false; }

  let streamData;
  try { streamData = JSON.parse(decrypted); }
  catch { console.log(`FAIL: Invalid JSON after decrypt`); return false; }

  const streamUrl = streamData.sources?.[0]?.file || streamData.file || streamData.url || '';
  const tracks = streamData.tracks || [];

  if (!streamUrl) { console.log(`FAIL: No stream URL`); return false; }

  console.log(`[4] Stream URL: ${streamUrl}`);
  console.log(`    Tracks: ${tracks.length} subtitle(s)`);

  // Verify reachable
  try {
    const resp = await fetch(streamUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    console.log(`[5] Verify: HTTP ${resp.status} - ${resp.headers.get('content-type')}`);
  } catch (err) {
    console.log(`[5] Verify: ${err.message} (may still work in player)`);
  }

  console.log(`\nSUCCESS`);
  return true;
}

async function main() {
  console.log('MegaUpCDN Full Bypass via Local rust-fetch');
  console.log(`Binary: ${RUST_FETCH}\n`);

  let passed = 0, failed = 0;
  for (const test of TEST_EMBEDS) {
    if (await testMegaUpBypass(test.name, test.url)) passed++;
    else failed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${TEST_EMBEDS.length}`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
