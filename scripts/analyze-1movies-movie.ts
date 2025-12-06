/**
 * 1movies.bz - Analyze specific movie page
 */

const MOVIE_URL = 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp';

async function fetchWithHeaders(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://1movies.bz/'
    }
  });
  return response;
}

async function analyze() {
  console.log('=== 1movies.bz Movie Page Analysis ===\n');
  console.log('URL:', MOVIE_URL);
  
  try {
    const res = await fetchWithHeaders(MOVIE_URL);
    console.log('Status:', res.status);
    
    const html = await res.text();
    console.log('HTML length:', html.length);
    
    // Save full HTML
    const fs = await import('fs');
    fs.writeFileSync('1movies-fnaf2.html', html);
    
    // Look for key patterns
    console.log('\n=== Pattern Analysis ===');
    
    // Iframes
    const iframes = html.match(/<iframe[^>]*>/gi);
    console.log('\nIframes:', iframes);
    
    // Data attributes that might contain video info
    const dataAttrs = html.match(/data-[a-z-]+="[^"]+"/gi);
    console.log('\nData attributes:', dataAttrs?.slice(0, 20));
    
    // Look for embed URLs
    const embedPatterns = html.match(/(?:embed|player|stream)[^"'\s<>]{5,100}/gi);
    console.log('\nEmbed patterns:', embedPatterns?.slice(0, 10));
    
    // Look for API calls in scripts
    const apiCalls = html.match(/fetch\([^)]+\)|axios\.[^)]+\)|ajax\([^)]+\)/gi);
    console.log('\nAPI calls:', apiCalls);
    
    // Look for video IDs or hashes
    const ids = html.match(/[a-f0-9]{32}|[a-zA-Z0-9_-]{10,}/g);
    const uniqueIds = Array.from(new Set(ids || [])).filter(id => id.length > 15 && id.length < 50);
    console.log('\nPotential IDs/hashes:', uniqueIds.slice(0, 10));
    
    // Look for server/source selection
    const serverPatterns = html.match(/server|source|quality|episode/gi);
    console.log('\nServer-related terms found:', serverPatterns?.length || 0);
    
    // Extract inline scripts for analysis
    const inlineScripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
    console.log('\nInline scripts count:', inlineScripts?.length || 0);
    
    // Look for interesting inline script content
    inlineScripts?.forEach((script, i) => {
      if (script.includes('embed') || script.includes('player') || 
          script.includes('video') || script.includes('source') ||
          script.includes('m3u8') || script.includes('stream')) {
        console.log(`\n--- Script ${i} (interesting) ---`);
        console.log(script.substring(0, 500));
      }
    });
    
    console.log('\n\nSaved full HTML to 1movies-fnaf2.html');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyze();
