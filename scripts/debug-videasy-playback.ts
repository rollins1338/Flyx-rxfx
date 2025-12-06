/**
 * Debug Videasy playback issue
 * Tests the full flow from extraction to proxied URL
 */

const TMDB_ID = '1228246'; // FNAF 2
const TYPE = 'movie';

async function debugPlayback() {
  console.log('=== Debugging Videasy Playback ===\n');

  // 1. Test the extraction API
  console.log('1. Testing extraction API...');
  const extractUrl = `http://localhost:3000/api/stream/extract?tmdbId=${TMDB_ID}&type=${TYPE}&provider=videasy`;
  console.log(`   URL: ${extractUrl}`);
  
  try {
    const response = await fetch(extractUrl);
    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Sources count: ${data.sources?.length || 0}`);
    
    if (data.sources && data.sources.length > 0) {
      const firstSource = data.sources[0];
      console.log('\n2. First source details:');
      console.log(`   Title: ${firstSource.title}`);
      console.log(`   Quality: ${firstSource.quality}`);
      console.log(`   URL: ${firstSource.url}`);
      console.log(`   Type: ${firstSource.type}`);
      console.log(`   Referer: ${firstSource.referer}`);
      console.log(`   requiresSegmentProxy: ${firstSource.requiresSegmentProxy}`);
      console.log(`   Status: ${firstSource.status}`);
      
      // 3. Build the proxied URL like VideoPlayer does
      const CF_PROXY = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL || 'https://media-proxy.vynx.workers.dev/stream';
      
      let finalUrl = firstSource.url;
      if (firstSource.requiresSegmentProxy) {
        const isAlreadyProxied = finalUrl.includes('/api/stream-proxy') || finalUrl.includes('/stream/?url=');
        if (!isAlreadyProxied) {
          const targetUrl = firstSource.directUrl || firstSource.url;
          finalUrl = `${CF_PROXY}/?url=${encodeURIComponent(targetUrl)}&source=videasy&referer=${encodeURIComponent(firstSource.referer || '')}`;
        }
      }
      
      console.log('\n3. Final proxied URL:');
      console.log(`   ${finalUrl}`);
      
      // 4. Test if the proxied URL works
      console.log('\n4. Testing proxied URL...');
      try {
        const proxyResponse = await fetch(finalUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        console.log(`   Status: ${proxyResponse.status}`);
        console.log(`   Content-Type: ${proxyResponse.headers.get('content-type')}`);
        
        if (proxyResponse.ok) {
          // Try to get the actual content
          const getResponse = await fetch(finalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const text = await getResponse.text();
          console.log(`   Response length: ${text.length} chars`);
          console.log(`   First 500 chars:\n${text.substring(0, 500)}`);
          
          if (text.includes('#EXTM3U')) {
            console.log('\n   ✓ Valid HLS manifest detected!');
          } else {
            console.log('\n   ✗ NOT a valid HLS manifest');
          }
        }
      } catch (proxyErr) {
        console.log(`   Error: ${proxyErr}`);
      }
      
      // 5. Also test the raw URL directly
      console.log('\n5. Testing raw URL directly (without proxy)...');
      try {
        const rawResponse = await fetch(firstSource.url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': firstSource.referer || 'https://videasy.net/',
          },
        });
        console.log(`   Status: ${rawResponse.status}`);
        console.log(`   Content-Type: ${rawResponse.headers.get('content-type')}`);
      } catch (rawErr) {
        console.log(`   Error (expected - CORS): ${rawErr}`);
      }
    } else {
      console.log('\n   No sources returned!');
      console.log('   Full response:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

debugPlayback();
