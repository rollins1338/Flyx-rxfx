/**
 * Try to decrypt rapidshare PAGE_DATA using various methods
 */

const API = 'https://enc-dec.app/api';

// Fetch PAGE_DATA from embed page
async function getPageData(embedId: string): Promise<string | null> {
  const url = `https://rapidshare.cc/e/${embedId}`;
  console.log('Fetching:', url);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  
  const match = html.match(/__PAGE_DATA\s*=\s*['"]([^'"]+)['"]/);
  if (match) {
    return match[1];
  }
  return null;
}

// Try all possible decryption endpoints
async function tryDecrypt(data: string): Promise<any> {
  const endpoints = [
    'dec-movies-flix',
    'dec-rapidshare',
    'dec-rapid',
    'dec-filemoon',
    'dec-vidplay',
    'dec-megacloud',
    'dec-rabbitstream',
    'dec-vidsrc',
    'dec-2embed',
    'decrypt',
    'decode'
  ];
  
  for (const endpoint of endpoints) {
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
  }
  return null;
}

// Try to find a pattern in PAGE_DATA
function analyzePageData(data: string) {
  console.log('\nPAGE_DATA Analysis:');
  console.log(`  Length: ${data.length}`);
  console.log(`  Data: ${data}`);
  
  // Try base64 decode
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    if (decoded.length > 0 && !decoded.includes('\ufffd')) {
      console.log(`  Base64 decoded: ${decoded.substring(0, 100)}`);
    }
  } catch {}
  
  // Try URL-safe base64
  try {
    const urlSafe = data.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    if (decoded.length > 0 && !decoded.includes('\ufffd')) {
      console.log(`  URL-safe base64 decoded: ${decoded.substring(0, 100)}`);
    }
  } catch {}
  
  // Check hex
  try {
    const hex = Buffer.from(data, 'base64').toString('hex');
    console.log(`  As hex: ${hex.substring(0, 50)}...`);
  } catch {}
}

async function main() {
  // Test with Cyberpunk embed
  const embedId = 'kJCuIjiwWSyJcOLzFLpK6xfpCQ';
  
  console.log('=== Getting PAGE_DATA from rapidshare embed ===\n');
  const pageData = await getPageData(embedId);
  
  if (!pageData) {
    console.log('Could not get PAGE_DATA');
    return;
  }
  
  analyzePageData(pageData);
  
  console.log('\n=== Trying decryption endpoints ===');
  const result = await tryDecrypt(pageData);
  
  if (result) {
    console.log(`\n✓ Decrypted with ${result.endpoint}:`);
    console.log(JSON.stringify(result.result, null, 2));
  } else {
    console.log('\n❌ No decryption endpoint worked');
  }
  
  // Also try with the embed ID itself
  console.log('\n=== Trying to decrypt embed ID ===');
  const embedResult = await tryDecrypt(embedId);
  if (embedResult) {
    console.log(`\n✓ Embed ID decrypted with ${embedResult.endpoint}:`);
    console.log(JSON.stringify(embedResult.result, null, 2));
  }
}

main().catch(console.error);
