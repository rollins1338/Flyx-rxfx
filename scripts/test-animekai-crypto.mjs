/**
 * Test if AnimeKai crypto still works
 */

console.log('Testing AnimeKai Search...\n');

async function testAnimeKaiSearch() {
  try {
    // Try searching for Jujutsu Kaisen
    const searchUrl = 'https://animekai.to/ajax/search?keyword=Jujutsu%20Kaisen';
    console.log('Searching:', searchUrl);
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://animekai.to/',
      }
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Results:', data.result?.length || 0);
    
    if (data.result && data.result.length > 0) {
      console.log('\nFirst result:');
      console.log('  ID:', data.result[0].id);
      console.log('  Title:', data.result[0].name);
      console.log('  URL:', data.result[0].url);
      
      // Try to get the anime page
      const animeUrl = `https://animekai.to${data.result[0].url}`;
      console.log('\nFetching anime page:', animeUrl);
      
      const pageRes = await fetch(animeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      const html = await pageRes.text();
      console.log('Page size:', html.length);
      
      // Check for syncData (MAL ID)
      const hasSyncData = html.includes('syncData');
      console.log('Has syncData:', hasSyncData);
      
      if (hasSyncData) {
        const syncMatch = html.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
        if (syncMatch) {
          try {
            const syncData = JSON.parse(syncMatch[1]);
            console.log('MAL ID:', syncData.mal_id);
          } catch (e) {
            console.log('Failed to parse syncData');
          }
        }
      }
      
      // Check for WASM
      const hasWasm = html.includes('.wasm') || html.includes('WebAssembly');
      console.log('Has WASM:', hasWasm);
      
      // Check for encryption patterns
      const hasEncrypt = html.includes('encrypt') || html.includes('crypto');
      console.log('Has encryption:', hasEncrypt);
      
      return true;
    } else {
      console.log('No results found');
      return false;
    }
  } catch (e) {
    console.error('Error:', e.message);
    return false;
  }
}

testAnimeKaiSearch();
