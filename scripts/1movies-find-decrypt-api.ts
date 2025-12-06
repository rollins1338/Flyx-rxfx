/**
 * Find the correct enc-dec.app endpoint for rapidshare PAGE_DATA decryption
 * Try all possible endpoint naming patterns
 */

const API = 'https://enc-dec.app/api';
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';

async function tryEndpoint(endpoint: string, data: string): Promise<any> {
  // Try POST
  try {
    const res = await fetch(`${API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data })
    });
    const json = await res.json();
    if (json.status !== 404 && json.result) {
      return { endpoint, method: 'POST', result: json.result };
    }
  } catch {}
  
  // Try GET
  try {
    const res = await fetch(`${API}/${endpoint}?text=${encodeURIComponent(data)}`);
    const json = await res.json();
    if (json.status !== 404 && json.result) {
      return { endpoint, method: 'GET', result: json.result };
    }
  } catch {}
  
  return null;
}

async function main() {
  console.log('=== Finding rapidshare decryption endpoint ===\n');
  console.log('PAGE_DATA:', PAGE_DATA);
  console.log('');

  // Try many possible endpoint names
  const prefixes = ['dec', 'decrypt', 'decode', 'get', 'extract'];
  const names = [
    'rapidshare', 'rapid-share', 'rapidcloud', 'rapid-cloud', 'rapid',
    'rapidairmax', 'rapid-airmax', 'airmax',
    'filemoon', 'file-moon', 'moon',
    'vidplay', 'vid-play', 'play',
    'megacloud', 'mega-cloud', 'mega',
    'rabbitstream', 'rabbit-stream', 'rabbit',
    'movies-flix', 'moviesflix', 'flix',
    'yflix', 'y-flix',
    '1movies', 'onemovies',
    'jwplayer', 'jw-player', 'jw',
    'hls', 'm3u8', 'stream', 'video', 'source', 'embed'
  ];

  const endpoints: string[] = [];
  
  // Generate all combinations
  for (const prefix of prefixes) {
    for (const name of names) {
      endpoints.push(`${prefix}-${name}`);
      endpoints.push(`${prefix}${name}`);
    }
  }
  
  // Also try direct names
  endpoints.push(...names);
  
  // Try each endpoint
  console.log(`Testing ${endpoints.length} endpoints...\n`);
  
  for (const endpoint of endpoints) {
    const result = await tryEndpoint(endpoint, PAGE_DATA);
    if (result) {
      console.log(`\n✓ FOUND: ${result.endpoint} (${result.method})`);
      console.log('Result:', JSON.stringify(result.result).substring(0, 500));
    }
  }
  
  // Also try the known working endpoint with different data formats
  console.log('\n=== Trying dec-movies-flix with different formats ===');
  
  const formats = [
    PAGE_DATA,
    PAGE_DATA.replace(/-/g, '+').replace(/_/g, '/'), // URL-safe to standard base64
    Buffer.from(PAGE_DATA).toString('base64'),
    encodeURIComponent(PAGE_DATA),
  ];
  
  for (const format of formats) {
    const result = await tryEndpoint('dec-movies-flix', format);
    if (result) {
      console.log(`\n✓ Format worked:`, format.substring(0, 50));
      console.log('Result:', JSON.stringify(result.result).substring(0, 500));
    }
  }
}

main().catch(console.error);
