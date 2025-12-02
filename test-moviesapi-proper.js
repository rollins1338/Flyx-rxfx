// Debug moviesapi.to with PROPER headers - simulating browser behavior

async function testProper() {
  // Step 1: First hit moviesapi.club to get the iframe URL
  const clubUrl = 'https://moviesapi.club/tv/1396-1-1';
  console.log('Step 1: Fetching moviesapi.club');
  console.log('URL:', clubUrl);
  
  const clubRes = await fetch(clubUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  const clubHtml = await clubRes.text();
  console.log('Status:', clubRes.status);
  
  // Extract iframe URL
  const iframeMatch = clubHtml.match(/src=["']([^"']+)["']/);
  if (!iframeMatch) {
    console.log('No iframe found!');
    console.log(clubHtml.substring(0, 2000));
    return;
  }
  
  const iframeUrl = iframeMatch[1];
  console.log('Found iframe:', iframeUrl);
  
  // Step 2: Fetch the iframe with proper referer
  console.log('\nStep 2: Fetching iframe');
  console.log('URL:', iframeUrl);
  console.log('Referer:', clubUrl);
  console.log('Origin:', 'https://moviesapi.club');
  
  const iframeRes = await fetch(iframeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': clubUrl,
      'Origin': 'https://moviesapi.club',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site'
    }
  });
  
  const iframeHtml = await iframeRes.text();
  console.log('Status:', iframeRes.status);
  console.log('HTML length:', iframeHtml.length);
  
  // Check for packed script
  const hasPackedScript = iframeHtml.includes("eval(function(p,a,c,k,e,d)");
  console.log('Has packed script:', hasPackedScript);
  
  if (hasPackedScript) {
    // Unpack it
    const evalStart = iframeHtml.indexOf("eval(function(p,a,c,k,e,d)");
    const dictMatch = iframeHtml.match(/\.split\('\|'\)\)\)/);
    
    if (dictMatch) {
      const dictIndex = iframeHtml.indexOf(dictMatch[0]);
      const packedScript = iframeHtml.substring(evalStart, dictIndex + dictMatch[0].length);
      
      try {
        const unpackExpression = packedScript.replace(/^eval/, '');
        const unpacked = eval(unpackExpression);
        
        const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/);
        if (fileMatch) {
          console.log('\n✓ FOUND M3U8:', fileMatch[1]);
        } else {
          console.log('\nNo file found in unpacked. Preview:');
          console.log(unpacked.substring(0, 1500));
        }
      } catch (e) {
        console.log('Unpack error:', e.message);
      }
    }
  } else {
    // Check for nested iframes or other patterns
    const nestedIframe = iframeHtml.match(/iframe[^>]+src=["']([^"']+)["']/i);
    if (nestedIframe) {
      console.log('\nFound nested iframe:', nestedIframe[1]);
      
      // Fetch nested iframe
      const nestedUrl = nestedIframe[1].startsWith('http') ? nestedIframe[1] : 
        (nestedIframe[1].startsWith('//') ? 'https:' + nestedIframe[1] : 
        new URL(nestedIframe[1], iframeUrl).href);
      
      console.log('\nStep 3: Fetching nested iframe');
      console.log('URL:', nestedUrl);
      
      const nestedRes = await fetch(nestedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': iframeUrl,
          'Origin': new URL(iframeUrl).origin
        }
      });
      
      const nestedHtml = await nestedRes.text();
      console.log('Status:', nestedRes.status);
      console.log('HTML length:', nestedHtml.length);
      
      // Check for m3u8 or packed script
      const m3u8Match = nestedHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
      if (m3u8Match) {
        console.log('\n✓ FOUND M3U8:', m3u8Match[0]);
      }
      
      const nestedPacked = nestedHtml.includes("eval(function(p,a,c,k,e,d)");
      if (nestedPacked) {
        console.log('Has packed script in nested iframe');
        // Unpack...
        const evalStart = nestedHtml.indexOf("eval(function(p,a,c,k,e,d)");
        const dictMatch = nestedHtml.match(/\.split\('\|'\)\)\)/);
        if (dictMatch) {
          const dictIndex = nestedHtml.indexOf(dictMatch[0]);
          const packedScript = nestedHtml.substring(evalStart, dictIndex + dictMatch[0].length);
          try {
            const unpacked = eval(packedScript.replace(/^eval/, ''));
            const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/);
            if (fileMatch) {
              console.log('\n✓ FOUND M3U8 in nested:', fileMatch[1]);
            }
          } catch (e) {
            console.log('Nested unpack error:', e.message);
          }
        }
      }
      
      console.log('\n--- Nested HTML Preview ---');
      console.log(nestedHtml.substring(0, 3000));
    } else {
      console.log('\n--- HTML Preview ---');
      console.log(iframeHtml.substring(0, 3000));
    }
  }
}

testProper().catch(console.error);
