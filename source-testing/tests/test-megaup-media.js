/**
 * Investigate MegaUp /media/ request
 * 
 * The enc-dec.app API says the User-Agent must match the /media/ request
 * Let's find out what /media/ request MegaUp makes
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const TEST_EMBED_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function main() {
  console.log('Investigating MegaUp /media/ endpoint...\n');
  
  // Step 1: Fetch the embed page and check for cookies
  console.log('=== Step 1: Fetch embed page ===');
  const pageResponse = await fetch(TEST_EMBED_URL, {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  
  console.log('Status:', pageResponse.status);
  console.log('Set-Cookie:', pageResponse.headers.get('set-cookie'));
  
  const html = await pageResponse.text();
  
  // Extract __PAGE_DATA
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  const pageData = pageDataMatch ? pageDataMatch[1] : null;
  console.log('__PAGE_DATA:', pageData);
  
  // Look for /media/ references in the HTML/JS
  console.log('\n=== Step 2: Search for /media/ in page ===');
  
  if (html.includes('/media/')) {
    console.log('Found /media/ reference in HTML');
    const mediaMatches = html.match(/\/media\/[^"'\s]*/g);
    if (mediaMatches) {
      console.log('Media URLs:', mediaMatches);
    }
  }
  
  // Check the app.js for /media/ endpoint
  const appJsMatch = html.match(/src="([^"]+app\.js[^"]*)"/);
  if (appJsMatch) {
    console.log('\nFetching app.js to search for /media/...');
    const jsResponse = await fetch(appJsMatch[1], { headers: HEADERS });
    const js = await jsResponse.text();
    
    if (js.includes('/media/') || js.includes('media')) {
      console.log('Found media reference in JS');
      
      // Look for the actual endpoint
      const mediaEndpoints = js.match(/["']\/media[^"']*["']/g);
      if (mediaEndpoints) {
        console.log('Media endpoints:', [...new Set(mediaEndpoints)]);
      }
    }
  }
  
  // Step 3: Try to call /media/ endpoint directly
  console.log('\n=== Step 3: Try /media/ endpoints ===');
  
  const videoId = TEST_EMBED_URL.split('/e/')[1];
  const mediaEndpoints = [
    `https://megaup22.online/media/${videoId}`,
    `https://megaup22.online/media?id=${videoId}`,
    `https://megaup22.online/api/media/${videoId}`,
    `https://megaup22.online/ajax/media/${videoId}`,
  ];
  
  for (const url of mediaEndpoints) {
    try {
      const response = await fetch(url, {
        headers: { ...HEADERS, 'Referer': TEST_EMBED_URL },
      });
      
      console.log(`${url}: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log('  Response:', text.substring(0, 200));
      }
    } catch (e) {
      console.log(`${url}: Error - ${e.message}`);
    }
  }
  
  // Step 4: Try POST to /media/
  console.log('\n=== Step 4: POST to /media/ ===');
  
  const postEndpoints = [
    'https://megaup22.online/media',
    'https://megaup22.online/api/media',
  ];
  
  for (const url of postEndpoints) {
    // Try with video ID
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          ...HEADERS, 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': TEST_EMBED_URL,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `id=${videoId}`,
      });
      
      console.log(`POST ${url} (id): ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log('  Response:', text.substring(0, 200));
      }
    } catch (e) {
      console.log(`POST ${url}: Error - ${e.message}`);
    }
    
    // Try with __PAGE_DATA
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          ...HEADERS, 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': TEST_EMBED_URL,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `hash=${encodeURIComponent(pageData)}`,
      });
      
      console.log(`POST ${url} (hash): ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log('  Response:', text.substring(0, 200));
        
        // Check if it's JSON with stream URL
        try {
          const json = JSON.parse(text);
          if (json.file || json.sources) {
            console.log('  ✓ FOUND STREAM DATA!');
            console.log('  ', JSON.stringify(json, null, 2));
          }
        } catch {}
      }
    } catch (e) {
      console.log(`POST ${url} (hash): Error - ${e.message}`);
    }
  }
}

main().catch(console.error);
