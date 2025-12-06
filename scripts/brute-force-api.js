/**
 * Brute force try all possible enc-dec.app API endpoints
 */

const API = 'https://enc-dec.app/api';
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';

async function tryEndpoint(endpoint, data) {
  try {
    const res = await fetch(`${API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data })
    });
    const json = await res.json();
    if (json.status !== 404 && json.result && json.result !== data) {
      return { endpoint, result: json.result };
    }
  } catch {}
  return null;
}

async function main() {
  console.log('=== Brute Force enc-dec.app API ===\n');
  
  // Generate all possible endpoint names
  const prefixes = ['dec', 'decrypt', 'decode', 'get', 'parse', 'extract'];
  const names = [
    // Site names
    'rapidshare', 'rapid-share', 'rapidcloud', 'rapid-cloud', 'rapid',
    'rapidairmax', 'rapid-airmax', 'airmax', 'rshare', 'rcloud',
    // Player names
    'jwplayer', 'jw-player', 'jw', 'player', 'video',
    // Generic
    'stream', 'source', 'file', 'hls', 'm3u8', 'embed',
    // Combined
    'rapid-video', 'rapid-stream', 'rapid-source', 'rapid-file',
    'share-video', 'share-stream', 'cloud-video', 'cloud-stream',
    // Variations
    'rp', 'rs', 'rc', 'ra', 'rm',
    // With numbers
    'rapid1', 'rapid2', 'share1', 'share2',
  ];
  
  const endpoints = [];
  
  // Generate combinations
  for (const prefix of prefixes) {
    for (const name of names) {
      endpoints.push(`${prefix}-${name}`);
      endpoints.push(`${prefix}${name}`);
    }
  }
  
  // Also try direct names
  endpoints.push(...names);
  
  // Add some specific guesses
  endpoints.push(
    'dec-page-data',
    'dec-pagedata',
    'decrypt-page',
    'parse-page',
    'dec-jwplayer',
    'dec-jw',
    'dec-video-source',
    'dec-hls-source',
    'dec-m3u8',
    'get-source',
    'get-stream',
    'get-video',
    'extract-source',
    'extract-stream',
  );
  
  console.log(`Testing ${endpoints.length} endpoints...\n`);
  
  let found = false;
  
  for (const endpoint of endpoints) {
    const result = await tryEndpoint(endpoint, PAGE_DATA);
    if (result) {
      console.log(`\n✓ FOUND: ${result.endpoint}`);
      console.log('Result:', JSON.stringify(result.result).substring(0, 500));
      found = true;
    }
  }
  
  if (!found) {
    console.log('\n❌ No working endpoint found');
    console.log('\nThe PAGE_DATA decryption is not available via enc-dec.app');
    console.log('The decryption must be done client-side in the obfuscated app.js');
  }
}

main().catch(console.error);
