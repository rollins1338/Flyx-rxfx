/**
 * Test 111movies API directly
 */

const https = require('https');

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://111movies.com/',
        'Origin': 'https://111movies.com',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/octet-stream',
        ...options.headers
      }
    };
    
    https.get(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== TESTING 111MOVIES API ===\n');
  
  const HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';
  
  // First, get the movie page to extract the data prop
  console.log('Fetching movie page...');
  const pageResponse = await fetchUrl('https://111movies.com/movie/155');
  
  // Extract __NEXT_DATA__
  const nextDataMatch = pageResponse.data.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!nextDataMatch) {
    console.log('Could not find __NEXT_DATA__');
    return;
  }
  
  const nextData = JSON.parse(nextDataMatch[1]);
  const data = nextData.props?.pageProps?.data;
  
  console.log('Data prop:', data?.substring(0, 100) + '...');
  
  // Now call the sources API
  console.log('\n=== CALLING SOURCES API ===\n');
  
  const sourcesUrl = `https://111movies.com/${HASH}/${data}/sr`;
  console.log('URL:', sourcesUrl.substring(0, 100) + '...');
  
  const sourcesResponse = await fetchUrl(sourcesUrl);
  console.log('Status:', sourcesResponse.status);
  console.log('Response:', sourcesResponse.data.substring(0, 500));
  
  if (sourcesResponse.status === 200) {
    const sources = JSON.parse(sourcesResponse.data);
    console.log('\nSources found:', sources.length);
    
    for (const source of sources) {
      console.log(`\n- ${source.name}: ${source.description}`);
      console.log(`  Data: ${source.data.substring(0, 50)}...`);
    }
    
    // Now call the stream API with the first source
    if (sources.length > 0) {
      console.log('\n\n=== CALLING STREAM API ===\n');
      
      const streamUrl = `https://111movies.com/${HASH}/${sources[0].data}`;
      console.log('URL:', streamUrl.substring(0, 100) + '...');
      
      const streamResponse = await fetchUrl(streamUrl);
      console.log('Status:', streamResponse.status);
      console.log('Response:', streamResponse.data.substring(0, 500));
      
      if (streamResponse.status === 200) {
        const streamData = JSON.parse(streamResponse.data);
        console.log('\nStream URL:', streamData.url);
        console.log('Tracks:', streamData.tracks?.length || 0);
        
        // Test if the stream URL works
        console.log('\n\n=== TESTING STREAM URL ===\n');
        
        const m3u8Response = await fetchUrl(streamData.url);
        console.log('M3U8 Status:', m3u8Response.status);
        console.log('M3U8 Content:', m3u8Response.data.substring(0, 500));
      }
    }
  }
}

main().catch(console.error);
