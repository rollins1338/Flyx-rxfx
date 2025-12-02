// Debug moviesapi.to extraction (TV shows)

async function testMoviesApiTo() {
  const url = 'https://w1.moviesapi.to/tv/1396/1/1';
  const referer = 'https://moviesapi.club/tv/1396-1-1';
  
  console.log('Fetching:', url);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer
    }
  });
  
  const html = await res.text();
  console.log('Status:', res.status);
  console.log('HTML length:', html.length);
  
  // Look for packed script
  const hasPackedScript = html.includes("eval(function(p,a,c,k,e,d)");
  console.log('\nHas packed script:', hasPackedScript);
  
  // Look for m3u8 patterns
  const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
  if (m3u8Match) {
    console.log('\n✓ Direct M3U8 found:', m3u8Match[0]);
  }
  
  // Look for file patterns
  const fileMatch = html.match(/file:\s*["']([^"']+)["']/);
  if (fileMatch) {
    console.log('\n✓ File pattern found:', fileMatch[1]);
  }
  
  // Look for sources
  const sourcesMatch = html.match(/sources:\s*\[([\s\S]*?)\]/);
  if (sourcesMatch) {
    console.log('\n✓ Sources found:', sourcesMatch[0].substring(0, 500));
  }
  
  // Look for any iframes
  const iframeRegex = /iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  console.log('\nIframes found:');
  while ((match = iframeRegex.exec(html)) !== null) {
    console.log('  -', match[1]);
  }
  
  if (hasPackedScript) {
    const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
    const dictMatch = html.match(/\.split\('\|'\)\)\)/);
    
    if (dictMatch) {
      const dictIndex = html.indexOf(dictMatch[0]);
      const packedScript = html.substring(evalStart, dictIndex + dictMatch[0].length);
      
      try {
        const unpackExpression = packedScript.replace(/^eval/, '');
        const unpacked = eval(unpackExpression);
        console.log('\n--- Unpacked Script ---');
        console.log(unpacked.substring(0, 2000));
        
        const unpackedFile = unpacked.match(/file:\s*["']([^"']+)["']/);
        if (unpackedFile) {
          console.log('\n✓ FOUND M3U8 in unpacked:', unpackedFile[1]);
        }
      } catch (e) {
        console.log('Unpack error:', e.message);
      }
    }
  }
  
  // Show HTML preview
  console.log('\n--- HTML Preview (first 3000 chars) ---');
  console.log(html.substring(0, 3000));
}

testMoviesApiTo().catch(console.error);
