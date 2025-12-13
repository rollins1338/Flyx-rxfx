/**
 * Try to find MegaUp API endpoints
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const VIDEO_ID = '18ryYD7yWS2JcOLzFLxK6hXpCQ';
const BASE_URL = 'https://megaup22.online';

async function tryEndpoint(name, url, options = {}) {
  console.log(`\n--- ${name} ---`);
  console.log('URL:', url);
  
  try {
    const response = await fetch(url, {
      headers: { ...HEADERS, ...options.headers },
      ...options,
    });
    
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    
    // Check for m3u8
    if (text.includes('.m3u8')) {
      console.log('✓ FOUND M3U8!');
      const match = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
      if (match) console.log('URL:', match[0]);
    }
    
    return text;
  } catch (error) {
    console.log('Error:', error.message);
    return null;
  }
}

async function main() {
  console.log('Testing MegaUp API endpoints...');
  console.log('Video ID:', VIDEO_ID);
  
  // Try various API patterns
  await tryEndpoint('Direct /e/ embed', `${BASE_URL}/e/${VIDEO_ID}`);
  
  await tryEndpoint('API /api/source', `${BASE_URL}/api/source/${VIDEO_ID}`, {
    headers: { 'Referer': `${BASE_URL}/e/${VIDEO_ID}` }
  });
  
  await tryEndpoint('API /api/video', `${BASE_URL}/api/video/${VIDEO_ID}`);
  
  await tryEndpoint('AJAX /ajax/embed', `${BASE_URL}/ajax/embed/${VIDEO_ID}`);
  
  await tryEndpoint('POST /api/source', `${BASE_URL}/api/source`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Referer': `${BASE_URL}/e/${VIDEO_ID}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ id: VIDEO_ID }),
  });
  
  await tryEndpoint('POST /media', `${BASE_URL}/media`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `${BASE_URL}/e/${VIDEO_ID}`,
    },
    body: `id=${VIDEO_ID}`,
  });
  
  // Try with the encrypted page data
  const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZQDTypKLMDMT4A0mzCCgb6yyhTIuEFpOeciU9-isScEP94g4uw4';
  
  await tryEndpoint('POST /media with PAGE_DATA', `${BASE_URL}/media`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `${BASE_URL}/e/${VIDEO_ID}`,
    },
    body: `hash=${PAGE_DATA}`,
  });
}

main().catch(console.error);
