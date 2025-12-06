/**
 * Try to get video source directly from yflix API
 * Maybe there's an endpoint that returns the m3u8 directly
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const API = 'https://enc-dec.app/api';
const BASE_URL = 'https://yflix.to';

async function encrypt(text: string): Promise<string> {
  const res = await fetch(`${API}/enc-movies-flix?text=${encodeURIComponent(text)}`, { headers: HEADERS });
  const data = await res.json();
  return data.result;
}

async function tryEndpoint(url: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    
    // Check if it contains video-related content
    if (text.includes('m3u8') || text.includes('mp4') || text.includes('source') || text.includes('file')) {
      return { url, status: res.status, hasVideo: true, content: text.substring(0, 500) };
    }
    
    return { url, status: res.status, hasVideo: false, length: text.length };
  } catch (e: any) {
    return { url, error: e.message };
  }
}

async function main() {
  // const contentId = 'd4K68KU'; // Cyberpunk
  const eid = 'doe69aM'; // Episode ID
  const lid = 'cYe--KWj5g'; // Server link ID
  
  console.log('=== Testing yflix API endpoints ===\n');
  
  // Encrypt IDs
  // const encContentId = await encrypt(contentId);
  const encEid = await encrypt(eid);
  const encLid = await encrypt(lid);
  
  // Try various endpoints
  const endpoints = [
    // Standard endpoints
    `${BASE_URL}/ajax/links/view?id=${lid}&_=${encLid}`,
    `${BASE_URL}/ajax/episode/${eid}/sources`,
    `${BASE_URL}/ajax/episode/${eid}/source`,
    `${BASE_URL}/ajax/sources/${eid}`,
    `${BASE_URL}/ajax/source/${eid}`,
    `${BASE_URL}/ajax/video/${eid}`,
    `${BASE_URL}/ajax/stream/${eid}`,
    `${BASE_URL}/ajax/embed/${eid}`,
    // With encryption
    `${BASE_URL}/ajax/episode/${eid}/sources?_=${encEid}`,
    `${BASE_URL}/ajax/sources/${eid}?_=${encEid}`,
    // Direct source endpoints
    `${BASE_URL}/ajax/links/source?id=${lid}&_=${encLid}`,
    `${BASE_URL}/ajax/links/stream?id=${lid}&_=${encLid}`,
    // Episode subtitles (we know this exists)
    `${BASE_URL}/ajax/episode/44055/subtitles`,
  ];
  
  for (const endpoint of endpoints) {
    const result = await tryEndpoint(endpoint);
    if (result.hasVideo) {
      console.log(`\n✓ ${endpoint}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Content: ${result.content}`);
    } else if (!result.error && result.status === 200) {
      console.log(`\n○ ${endpoint} (${result.length} bytes, no video content)`);
    }
  }
  
  // Also check the subtitles endpoint
  console.log('\n\n=== Checking subtitles endpoint ===');
  const subsUrl = `${BASE_URL}/ajax/episode/44055/subtitles`;
  const subsRes = await fetch(subsUrl, { headers: HEADERS });
  const subsText = await subsRes.text();
  console.log('Subtitles response:', subsText.substring(0, 500));
}

main().catch(console.error);
