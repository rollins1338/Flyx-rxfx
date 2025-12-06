/**
 * Try to find direct API endpoints on rapidshare/rapidairmax
 * The embed URL is: https://rapidshare.cc/e/{id}
 * We need to find how to get the m3u8 from rrr.rapidshare.cc
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Sample embed IDs from yflix
const EMBED_ID = 'kJCuIjiwWSyJcOLzFLpK6xfpCQ';
const BASE_URLS = [
  'https://rapidshare.cc',
  'https://rapidairmax.site',
  'https://rrr.rapidshare.cc'
];

async function tryEndpoint(url: string, referer?: string): Promise<{ url: string; status: number; body: string }> {
  try {
    const headers: any = { ...HEADERS };
    if (referer) headers['Referer'] = referer;
    
    const res = await fetch(url, { headers });
    const body = await res.text();
    return { url, status: res.status, body: body.substring(0, 500) };
  } catch (e: any) {
    return { url, status: -1, body: e.message };
  }
}

async function main() {
  console.log('=== Testing rapidshare/rapidairmax API endpoints ===\n');
  console.log(`Embed ID: ${EMBED_ID}\n`);

  // Try various API patterns
  const endpoints = [
    // Direct embed
    `/e/${EMBED_ID}`,
    // API patterns
    `/api/source/${EMBED_ID}`,
    `/api/video/${EMBED_ID}`,
    `/ajax/embed/${EMBED_ID}`,
    `/ajax/source/${EMBED_ID}`,
    `/ajax/video/${EMBED_ID}`,
    `/source/${EMBED_ID}`,
    `/video/${EMBED_ID}`,
    `/stream/${EMBED_ID}`,
    `/play/${EMBED_ID}`,
    // With different extensions
    `/e/${EMBED_ID}.json`,
    `/api/e/${EMBED_ID}`,
    // Try pmjz pattern (from the m3u8 URL)
    `/pmjz/v5/${EMBED_ID}`,
  ];

  for (const base of BASE_URLS) {
    console.log(`\n=== Testing ${base} ===`);
    
    for (const endpoint of endpoints) {
      const result = await tryEndpoint(`${base}${endpoint}`, base);
      const hasM3u8 = result.body.includes('.m3u8') || result.body.includes('m3u8');
      const hasFile = result.body.includes('file') || result.body.includes('source');
      
      if (result.status === 200 || hasM3u8 || hasFile) {
        console.log(`\n✓ ${endpoint}`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Body: ${result.body.substring(0, 300)}`);
        if (hasM3u8) console.log('  🎯 Contains m3u8 reference!');
      }
    }
  }

  // Also try to decode the embed ID
  console.log('\n=== Trying to decode embed ID ===');
  
  // Try base64
  try {
    const decoded = Buffer.from(EMBED_ID, 'base64').toString('utf8');
    console.log('Base64:', decoded);
  } catch { console.log('Not base64'); }
  
  // Try URL-safe base64
  try {
    const urlSafe = EMBED_ID.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    console.log('URL-safe base64:', decoded);
  } catch { console.log('Not URL-safe base64'); }
  
  // Check if it's hex
  if (/^[0-9a-fA-F]+$/.test(EMBED_ID)) {
    const decoded = Buffer.from(EMBED_ID, 'hex').toString('utf8');
    console.log('Hex:', decoded);
  }
}

main().catch(console.error);
