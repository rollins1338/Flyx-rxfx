/**
 * Fetch and analyze Videasy's Next.js chunks
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://player.videasy.net/',
};

const BASE_URL = 'https://player.videasy.net';

async function fetchChunk(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`Fetching: ${url}`);
  
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (response.ok) {
      return await response.text();
    }
    console.log(`  Status: ${response.status}`);
    return null;
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

function analyzeChunk(content, name) {
  console.log(`\n=== Analyzing ${name} (${content.length} chars) ===\n`);
  
  // Look for API endpoints
  const apiPatterns = [
    /["'`](https?:\/\/api[^"'`]+)["'`]/g,
    /["'`](\/api\/[^"'`]+)["'`]/g,
    /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g,
  ];
  
  const apis = new Set();
  for (const pattern of apiPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (!match[1].includes('google') && !match[1].includes('facebook')) {
        apis.add(match[1]);
      }
    }
  }
  
  if (apis.size > 0) {
    console.log('API endpoints:');
    apis.forEach(a => console.log(`  ${a}`));
  }
  
  // Look for source/stream related code
  const sourcePatterns = [
    /sources?\s*[:=]/gi,
    /file\s*[:=]/gi,
    /\.m3u8/gi,
    /\.mp4/gi,
    /hls/gi,
    /stream/gi,
  ];
  
  console.log('\nSource-related patterns:');
  for (const pattern of sourcePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`  ${pattern.source}: ${matches.length}`);
    }
  }
  
  // Look for encryption/decryption
  const encPatterns = [
    /decrypt/gi,
    /encrypt/gi,
    /atob/g,
    /btoa/g,
    /CryptoJS/g,
    /AES/gi,
  ];
  
  console.log('\nEncryption patterns:');
  for (const pattern of encPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`  ${pattern.source}: ${matches.length}`);
    }
  }
  
  // Extract code around "sources"
  const sourcesIndex = content.indexOf('sources');
  if (sourcesIndex !== -1) {
    console.log('\nCode around "sources":');
    const context = content.substring(
      Math.max(0, sourcesIndex - 100),
      Math.min(content.length, sourcesIndex + 200)
    );
    console.log(`  ${context.replace(/\s+/g, ' ')}`);
  }
  
  // Look for interesting function names
  const funcPattern = /function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?function|(\w+)\s*[:=]\s*(?:async\s+)?\(/g;
  const funcs = new Set();
  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    const name = match[1] || match[2] || match[3];
    if (name && (name.includes('source') || name.includes('stream') || 
        name.includes('video') || name.includes('player') ||
        name.includes('fetch') || name.includes('load') ||
        name.includes('decrypt') || name.includes('get'))) {
      funcs.add(name);
    }
  }
  
  if (funcs.size > 0) {
    console.log('\nInteresting functions:');
    [...funcs].slice(0, 20).forEach(f => console.log(`  ${f}`));
  }
}

async function main() {
  // Create results directory
  try {
    fs.mkdirSync('source-testing/results', { recursive: true });
  } catch {}
  
  // Chunks to fetch
  const chunks = [
    '/_next/static/chunks/pages/movie/%5B...params%5D-07f4103f80f61858.js',
    '/_next/static/chunks/2679-958b66cfb5b7b07a.js',
    '/_next/static/chunks/1470-d8b2f9ceb2a15121.js',
    '/_next/static/chunks/pages/_app-f339a33ed2f4fdb8.js',
  ];
  
  for (const chunk of chunks) {
    const content = await fetchChunk(chunk);
    if (content) {
      const filename = chunk.split('/').pop().replace(/[^a-zA-Z0-9.-]/g, '_');
      fs.writeFileSync(`source-testing/results/videasy-${filename}`, content);
      console.log(`Saved to: source-testing/results/videasy-${filename}`);
      
      analyzeChunk(content, filename);
    }
  }
  
  console.log('\n=== DONE ===');
}

main().catch(console.error);
