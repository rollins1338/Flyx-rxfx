/**
 * 1movies.bz Simple Analysis - No browser, just HTTP requests
 */

const BASE_URL = 'https://1movies.bz';

async function fetchWithHeaders(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': BASE_URL
    }
  });
  return response;
}

async function analyze() {
  console.log('=== 1movies.bz Simple Analysis ===\n');
  
  try {
    // 1. Fetch homepage
    console.log('1. Fetching homepage...');
    const homeRes = await fetchWithHeaders(BASE_URL);
    console.log('Status:', homeRes.status);
    
    if (!homeRes.ok) {
      console.log('Homepage blocked or unavailable');
      return;
    }
    
    const homeHtml = await homeRes.text();
    console.log('HTML length:', homeHtml.length);
    
    // Look for patterns in the HTML
    const patterns = {
      movieLinks: homeHtml.match(/href="[^"]*(?:movie|watch|film)[^"]*"/gi)?.slice(0, 5),
      embedUrls: homeHtml.match(/(?:embed|player)[^"'\s]*/gi)?.slice(0, 5),
      apiEndpoints: homeHtml.match(/api[^"'\s]*/gi)?.slice(0, 5),
      scripts: homeHtml.match(/<script[^>]*src="([^"]+)"/gi)?.slice(0, 10)
    };
    
    console.log('\nPatterns found:');
    console.log('Movie links:', patterns.movieLinks);
    console.log('Embed URLs:', patterns.embedUrls);
    console.log('API endpoints:', patterns.apiEndpoints);
    console.log('Scripts:', patterns.scripts);
    
    // Extract first movie link if found
    const movieMatch = homeHtml.match(/href="([^"]*(?:movie|watch)[^"]*)"/i);
    if (movieMatch) {
      const movieUrl = movieMatch[1].startsWith('http') 
        ? movieMatch[1] 
        : new URL(movieMatch[1], BASE_URL).href;
      
      console.log('\n2. Fetching movie page:', movieUrl);
      const movieRes = await fetchWithHeaders(movieUrl);
      console.log('Status:', movieRes.status);
      
      if (movieRes.ok) {
        const movieHtml = await movieRes.text();
        
        // Look for embed/iframe sources
        const iframeSrcs = movieHtml.match(/iframe[^>]*src="([^"]+)"/gi);
        console.log('\nIframe sources:', iframeSrcs?.slice(0, 5));
        
        // Look for video sources
        const videoSrcs = movieHtml.match(/(?:video|source)[^>]*src="([^"]+)"/gi);
        console.log('Video sources:', videoSrcs?.slice(0, 5));
        
        // Look for m3u8 references
        const m3u8Refs = movieHtml.match(/[^"'\s]*\.m3u8[^"'\s]*/gi);
        console.log('M3U8 references:', m3u8Refs);
        
        // Look for player configuration
        const playerConfig = movieHtml.match(/player[^{]*\{[^}]+\}/gi);
        console.log('Player configs:', playerConfig?.slice(0, 2));
        
        // Save for analysis
        const fs = await import('fs');
        fs.writeFileSync('1movies-home.html', homeHtml);
        fs.writeFileSync('1movies-movie.html', movieHtml);
        console.log('\nSaved HTML files for analysis');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyze();
