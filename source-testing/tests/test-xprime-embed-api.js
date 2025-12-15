/**
 * Test XPrime embed page and look for API patterns
 * Try to find how the player gets its source
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TMDB_ID = '550'; // Fight Club

async function testXPrimeEmbed() {
  console.log('=== TESTING XPRIME EMBED API PATTERNS ===\n');
  
  // Test various API endpoint patterns
  const apiPatterns = [
    // Direct API patterns
    `https://xprime.tv/api/source/${TMDB_ID}`,
    `https://xprime.tv/api/movie/${TMDB_ID}`,
    `https://xprime.tv/api/embed/${TMDB_ID}`,
    `https://xprime.tv/api/stream/${TMDB_ID}`,
    `https://xprime.tv/api/v1/source/${TMDB_ID}`,
    `https://xprime.tv/api/v1/movie/${TMDB_ID}`,
    
    // Backend patterns (from enc-dec.app hint)
    `https://backend.xprime.tv/source/${TMDB_ID}`,
    `https://backend.xprime.tv/movie/${TMDB_ID}`,
    `https://backend.xprime.tv/embed/${TMDB_ID}`,
    `https://backend.xprime.tv/api/source/${TMDB_ID}`,
    
    // Alternative domains
    `https://xprime.stream/api/source/${TMDB_ID}`,
    `https://xprime.today/api/source/${TMDB_ID}`,
  ];
  
  for (const url of apiPatterns) {
    console.log(`\nTrying: ${url}`);
    try {
      const response = await fetch(url, {
        headers: { ...HEADERS, 'Referer': 'https://xprime.tv/' }
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`  Length: ${text.length} chars`);
        console.log(`  Preview: ${text.substring(0, 200)}`);
        
        // Check if it's JSON
        try {
          const json = JSON.parse(text);
          console.log(`  JSON: ${JSON.stringify(json).substring(0, 300)}`);
        } catch {}
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  // Also try POST requests
  console.log('\n\n=== TRYING POST REQUESTS ===');
  
  const postPatterns = [
    { url: 'https://xprime.tv/api/source', body: { id: TMDB_ID, type: 'movie' } },
    { url: 'https://xprime.tv/api/embed', body: { tmdbId: TMDB_ID, type: 'movie' } },
    { url: 'https://backend.xprime.tv/source', body: { id: TMDB_ID } },
  ];
  
  for (const { url, body } of postPatterns) {
    console.log(`\nPOST: ${url}`);
    console.log(`  Body: ${JSON.stringify(body)}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          ...HEADERS, 
          'Content-Type': 'application/json',
          'Referer': 'https://xprime.tv/' 
        },
        body: JSON.stringify(body)
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`  Length: ${text.length} chars`);
        console.log(`  Preview: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

// Also test the download link we found
async function testDownloadLink() {
  console.log('\n\n=== TESTING DOWNLOAD LINK ===');
  
  const downloadUrl = 'https://xk4l.mzt4pr8wlkxnv0qsha5g.website/download';
  console.log(`URL: ${downloadUrl}`);
  
  try {
    const response = await fetch(downloadUrl, {
      headers: { ...HEADERS, 'Referer': 'https://xprime.tv/' },
      redirect: 'manual'
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Location: ${response.headers.get('location')}`);
    
    const text = await response.text();
    console.log(`Length: ${text.length} chars`);
    console.log(`Preview: ${text.substring(0, 300)}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function main() {
  await testXPrimeEmbed();
  await testDownloadLink();
}

main().catch(console.error);
