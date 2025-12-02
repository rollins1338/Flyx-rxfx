// Get fresh stream and test it

async function testFreshStream() {
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
  const proxyUrl = extractData.sources[0].url;
  
  console.log('Direct URL:', directUrl);
  console.log('Referer:', referer);
  console.log('Proxy URL:', proxyUrl);
  
  // Test direct access
  console.log('\n--- Testing direct access ---');
  try {
    const res = await fetch(directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Origin': new URL(referer).origin
      }
    });
    
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    
    const text = await res.text();
    console.log('Response length:', text.length);
    console.log('First 1000 chars:');
    console.log(text.substring(0, 1000));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test through proxy
  console.log('\n--- Testing through proxy ---');
  try {
    const res = await fetch('http://localhost:3000' + proxyUrl);
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    
    const text = await res.text();
    console.log('Response length:', text.length);
    console.log('First 1000 chars:');
    console.log(text.substring(0, 1000));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testFreshStream().catch(console.error);
