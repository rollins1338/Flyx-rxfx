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
    }
  });
  
  const clubHtml = await clubRes.text();
  console.log('Status:', clubRes.status);
  
  // Find ALL iframes
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  const iframes = [];
  while ((match = iframeRegex.exec(clubHtml)) !== null) {
    iframes.push(match[1]);
  }
  console.log('All iframes found:', iframes);
  
  // Find the video iframe (not google analytics)
  const videoIframe = iframes.find(url => 
    !url.includes('google') && 
    !url.includes('analytics') &&
    (url.includes('moviesapi') || url.includes('vidora') || url.includes('embed') || url.includes('player'))
  );
  
  if (!videoIframe) {
    console.log('No video iframe found!');
    console.log('\n--- HTML ---');
    console.log(clubHtml);
    return;
  }
  
  console.log('\nVideo iframe:', videoIframe);
  
  // Step 2: Fetch the video iframe
  console.log('\nStep 2: Fetching video iframe');
  
  const iframeRes = await fetch(videoIframe, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': clubUrl,
      'Origin': 'https://moviesapi.club',
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
  
  // Look for m3u8 directly
  const m3u8Direct = iframeHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
  if (m3u8Direct) {
    console.log('\n✓ Direct M3U8 found:', m3u8Direct[0]);
  }
  
  // Look for file pattern
  const filePattern = iframeHtml.match(/file:\s*["']([^"']+)["']/);
  if (filePattern) {
    console.log('\n✓ File pattern found:', filePattern[1]);
  }
  
  if (hasPackedScript) {
    const evalStart = iframeHtml.indexOf("eval(function(p,a,c,k,e,d)");
    const dictMatch = iframeHtml.match(/\.split\('\|'\)\)\)/);
    
    if (dictMatch) {
      const dictIndex = iframeHtml.indexOf(dictMatch[0]);
      const packedScript = iframeHtml.substring(evalStart, dictIndex + dictMatch[0].length);
      
      try {
        const unpacked = eval(packedScript.replace(/^eval/, ''));
        const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/);
        if (fileMatch) {
          console.log('\n✓ FOUND M3U8 in packed:', fileMatch[1]);
        } else {
          console.log('\nUnpacked preview:');
          console.log(unpacked.substring(0, 2000));
        }
      } catch (e) {
        console.log('Unpack error:', e.message);
      }
    }
  }
  
  // Check for nested iframes
  const nestedIframes = [];
  const nestedRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  while ((match = nestedRegex.exec(iframeHtml)) !== null) {
    if (!match[1].includes('about:blank')) {
      nestedIframes.push(match[1]);
    }
  }
  
  if (nestedIframes.length > 0) {
    console.log('\nNested iframes:', nestedIframes);
    
    for (const nested of nestedIframes) {
      console.log('\n--- Fetching nested:', nested);
      
      const nestedUrl = nested.startsWith('http') ? nested : 
        (nested.startsWith('//') ? 'https:' + nested : 
        new URL(nested, videoIframe).href);
      
      const nestedRes = await fetch(nestedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': videoIframe,
          'Origin': new URL(videoIframe).origin
        }
      });
      
      const nestedHtml = await nestedRes.text();
      console.log('Status:', nestedRes.status);
      
      const nestedM3u8 = nestedHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
      if (nestedM3u8) {
        console.log('✓ M3U8 in nested:', nestedM3u8[0]);
      }
      
      const nestedPacked = nestedHtml.includes("eval(function(p,a,c,k,e,d)");
      if (nestedPacked) {
        const evalStart = nestedHtml.indexOf("eval(function(p,a,c,k,e,d)");
        const dictMatch = nestedHtml.match(/\.split\('\|'\)\)\)/);
        if (dictMatch) {
          const dictIndex = nestedHtml.indexOf(dictMatch[0]);
          const packedScript = nestedHtml.substring(evalStart, dictIndex + dictMatch[0].length);
          try {
            const unpacked = eval(packedScript.replace(/^eval/, ''));
            const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/);
            if (fileMatch) {
              console.log('✓ M3U8 in nested packed:', fileMatch[1]);
            }
          } catch (e) {}
        }
      }
    }
  }
  
  console.log('\n--- HTML Preview ---');
  console.log(iframeHtml.substring(0, 4000));
}

testProper().catch(console.error);
