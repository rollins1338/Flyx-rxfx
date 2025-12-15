/**
 * Test the reconstructed Vidora stream URLs
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': '*/*',
  'Referer': 'https://vidora.stream/',
  'Origin': 'https://vidora.stream',
};

const videoId = 'e5ccbb10n1xp';
const token = 'qic5T5iBi6J3t0L6BzKJi5paYylUvpfYH62KZPgT2p4';

const urls = [
  `https://hls2.hdflix.biz/hls/${videoId}_o/master.m3u8?t=${token}`,
  `https://hls.hdflix.biz/${videoId}/master.m3u8?t=${token}`,
  `https://hls2.hdflix.biz/${videoId}/master.m3u8?t=${token}`,
  `https://ab.hdflix.biz/hls/${videoId}_o/master.m3u8?t=${token}`,
  // Try with additional parameters from the word list
  `https://hls2.hdflix.biz/hls/${videoId}_o/master.m3u8?t=${token}&s=45&e=43200&v=49&sp=5000&i=0.3&fr=fr`,
];

async function testUrl(url) {
  console.log(`\nTesting: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow'
    });
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`  Length: ${text.length} chars`);
      
      // Check if it's an m3u8 playlist
      if (text.includes('#EXTM3U')) {
        console.log('  *** VALID M3U8 PLAYLIST! ***');
        console.log(`  Preview:\n${text.substring(0, 500)}`);
        return { url, valid: true, content: text };
      } else {
        console.log(`  Preview: ${text.substring(0, 200)}`);
      }
    }
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
  
  return { url, valid: false };
}

async function main() {
  console.log('=== TESTING VIDORA STREAM URLS ===\n');
  
  const results = [];
  
  for (const url of urls) {
    const result = await testUrl(url);
    results.push(result);
    
    if (result.valid) {
      console.log('\n\n*** FOUND WORKING URL! ***');
      console.log(result.url);
      break;
    }
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  const working = results.filter(r => r.valid);
  if (working.length > 0) {
    console.log('Working URLs:');
    for (const r of working) {
      console.log(`  ${r.url}`);
    }
  } else {
    console.log('No working URLs found');
  }
}

main().catch(console.error);
