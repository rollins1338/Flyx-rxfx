// Debug MoviesAPI TV show extraction

async function testMoviesApiTV() {
  // Test with Breaking Bad S01E01 (1396)
  const clubUrl = 'https://moviesapi.club/tv/1396-1-1';
  console.log('Fetching:', clubUrl);
  
  const res = await fetch(clubUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await res.text();
  console.log('Status:', res.status);
  console.log('HTML length:', html.length);
  
  // Find all iframes
  const iframeRegex = /iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  console.log('\nIframes found:');
  while ((match = iframeRegex.exec(html)) !== null) {
    console.log('  -', match[1]);
  }
  
  // Find vidora specifically
  const vidoraMatch = html.match(/src=["'](https:\/\/vidora\.stream\/embed\/[^"']+)["']/);
  console.log('\nVidora match:', vidoraMatch ? vidoraMatch[1] : 'NOT FOUND');
  
  if (vidoraMatch) {
    // Now fetch vidora
    const vidoraUrl = vidoraMatch[1];
    console.log('\n--- Fetching Vidora ---');
    
    const vidoraRes = await fetch(vidoraUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': clubUrl
      }
    });
    
    const vidoraHtml = await vidoraRes.text();
    console.log('Vidora status:', vidoraRes.status);
    console.log('Vidora HTML length:', vidoraHtml.length);
    
    // Look for packed script
    const hasPackedScript = vidoraHtml.includes("eval(function(p,a,c,k,e,d)");
    console.log('Has packed script:', hasPackedScript);
    
    if (hasPackedScript) {
      const evalStart = vidoraHtml.indexOf("eval(function(p,a,c,k,e,d)");
      const dictMatch = vidoraHtml.match(/\.split\('\|'\)\)\)/);
      
      if (dictMatch) {
        const dictIndex = vidoraHtml.indexOf(dictMatch[0]);
        const packedScript = vidoraHtml.substring(evalStart, dictIndex + dictMatch[0].length);
        
        try {
          const unpackExpression = packedScript.replace(/^eval/, '');
          const unpacked = eval(unpackExpression);
          
          // Extract file URL
          const fileMatch = unpacked.match(/file:"([^"]+)"/);
          if (fileMatch) {
            console.log('\n✓ FOUND M3U8 URL:', fileMatch[1]);
          } else {
            console.log('\n✗ No file URL found');
            console.log('Unpacked preview:', unpacked.substring(0, 1000));
          }
        } catch (e) {
          console.log('Unpack error:', e.message);
        }
      }
    } else {
      console.log('\n--- Vidora HTML Preview ---');
      console.log(vidoraHtml.substring(0, 2000));
    }
  } else {
    console.log('\n--- HTML Preview ---');
    console.log(html.substring(0, 2000));
  }
}

testMoviesApiTV().catch(console.error);
