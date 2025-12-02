// Test a segment through the proxy

async function testSegment() {
  // Get fresh extraction
  console.log('Getting fresh stream URL...');
  const extractRes = await fetch('http://localhost:3000/api/stream/extract?tmdbId=1084242&type=movie');
  const extractData = await extractRes.json();
  
  if (!extractData.success) {
    console.log('Extraction failed:', extractData.error);
    return;
  }
  
  const directUrl = extractData.sources[0].directUrl;
  const referer = extractData.sources[0].referer;
  
  console.log('Direct URL:', directUrl);
  
  // Get the playlist
  const playlistRes = await fetch(directUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer
    }
  });
  
  const playlist = await playlistRes.text();
  
  // Find first segment URL
  const lines = playlist.split('\n');
  let segmentUrl = null;
  for (const line of lines) {
    if (line.startsWith('https://')) {
      segmentUrl = line.trim();
      break;
    }
  }
  
  if (!segmentUrl) {
    console.log('No segment URL found');
    return;
  }
  
  console.log('\nFirst segment URL:', segmentUrl);
  
  // Test direct segment access
  console.log('\n--- Testing direct segment access ---');
  try {
    const res = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer
      }
    });
    
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Content-Length:', res.headers.get('content-length'));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test through proxy
  console.log('\n--- Testing segment through proxy ---');
  const proxySegmentUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(segmentUrl)}&source=moviesapi&referer=${encodeURIComponent(referer)}`;
  
  try {
    const res = await fetch(proxySegmentUrl);
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Content-Length:', res.headers.get('content-length'));
    
    if (!res.ok) {
      const text = await res.text();
      console.log('Error response:', text);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testSegment().catch(console.error);
