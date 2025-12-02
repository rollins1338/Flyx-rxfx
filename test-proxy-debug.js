// Debug the stream proxy issue

async function testProxy() {
  // Test direct access to MoviesAPI stream
  const streamUrl = 'https://9str-m3u8-play-021024.ppzj-youtube.cfd/m3u8/tp1-rdv1/1080/642bce856edd7cab511931a2/69279fc7b5381fe97bbecf67/53616c7465645f5f63c416927dc44f7b70d1ac18a3f9a49413/1764672000/5d4d14ff88600ea8ab1b203498c2df2a';
  const referer = 'https://w1.moviesapi.to/';
  
  console.log('Testing direct stream access...');
  console.log('URL:', streamUrl);
  console.log('Referer:', referer);
  
  try {
    const res = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': referer,
        'Origin': 'https://w1.moviesapi.to'
      }
    });
    
    console.log('\nDirect access:');
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    
    if (res.ok) {
      const text = await res.text();
      console.log('Response length:', text.length);
      console.log('First 500 chars:', text.substring(0, 500));
    } else {
      const text = await res.text();
      console.log('Error response:', text.substring(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test through our proxy
  console.log('\n\nTesting through local proxy...');
  const proxyUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(streamUrl)}&source=moviesapi&referer=${encodeURIComponent(referer)}`;
  
  try {
    const res = await fetch(proxyUrl);
    console.log('Proxy status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    
    if (res.ok) {
      const text = await res.text();
      console.log('Response length:', text.length);
      console.log('First 500 chars:', text.substring(0, 500));
    } else {
      const text = await res.text();
      console.log('Error response:', text);
    }
  } catch (e) {
    console.log('Proxy error:', e.message);
  }
}

testProxy().catch(console.error);
