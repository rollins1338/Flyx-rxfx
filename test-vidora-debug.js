// Debug Vidora extraction

async function testVidora() {
  const vidoraUrl = 'https://vidora.stream/embed/e5ccbb10n1xp';
  const referer = 'https://moviesapi.club/movie/550';
  
  console.log('Fetching:', vidoraUrl);
  console.log('Referer:', referer);
  
  const res = await fetch(vidoraUrl, {
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
  
  // Look for file patterns
  const filePatterns = [
    /file:\s*["']([^"']+)["']/,
    /sources:\s*\[/,
    /\.m3u8/,
    /\.txt/,
    /hls/i
  ];
  
  console.log('\nPatterns found:');
  for (const pattern of filePatterns) {
    const match = html.match(pattern);
    if (match) {
      console.log('  ✓', pattern.source, match[0].substring(0, 100));
    }
  }
  
  // Try to find and unpack the script
  if (hasPackedScript) {
    const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
    const dictMatch = html.match(/\.split\('\|'\)\)\)/);
    
    if (dictMatch) {
      const dictIndex = html.indexOf(dictMatch[0]);
      const packedScript = html.substring(evalStart, dictIndex + dictMatch[0].length);
      console.log('\nPacked script length:', packedScript.length);
      
      try {
        const unpackExpression = packedScript.replace(/^eval/, '');
        const unpacked = eval(unpackExpression);
        console.log('\nUnpacked script length:', unpacked.length);
        console.log('\n--- Unpacked Preview ---');
        console.log(unpacked.substring(0, 1500));
        
        // Extract file URL
        const fileMatch = unpacked.match(/file:"([^"]+)"/);
        if (fileMatch) {
          console.log('\n✓ FOUND M3U8 URL:', fileMatch[1]);
        } else {
          console.log('\n✗ No file URL found in unpacked script');
        }
        
        // Look for sources array
        const sourcesMatch = unpacked.match(/sources:\s*\[([\s\S]*?)\]/);
        if (sourcesMatch) {
          console.log('\n✓ FOUND sources array:', sourcesMatch[0].substring(0, 500));
        }
      } catch (e) {
        console.log('\nUnpack error:', e.message);
      }
    }
  }
  
  // Show raw HTML if no packed script
  if (!hasPackedScript) {
    console.log('\n--- HTML Preview ---');
    console.log(html.substring(0, 3000));
  }
}

testVidora().catch(console.error);
