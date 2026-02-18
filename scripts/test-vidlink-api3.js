// Fetch the actual vidlink.pro player page for a real movie and extract JS chunks
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function run() {
  // Fetch the embed page (this is how vidlink is typically used)
  const r = await fetch('https://vidlink.pro/movie/550', { 
    headers: HEADERS, 
    signal: AbortSignal.timeout(10000),
    redirect: 'follow'
  });
  const html = await r.text();
  console.log('Page status:', r.status, 'length:', html.length);
  console.log('Final URL:', r.url);
  
  if (html.includes('404') && html.includes('not be found')) {
    console.log('Got 404 page for /movie/550');
    
    // Try alternate URL patterns
    const alts = [
      'https://vidlink.pro/embed/movie/550',
      'https://vidlink.pro/v/movie/550',
      'https://vidlink.pro/watch/movie/550',
      'https://vidlink.pro/player/movie/550',
    ];
    for (const alt of alts) {
      try {
        const ar = await fetch(alt, { headers: HEADERS, signal: AbortSignal.timeout(5000), redirect: 'follow' });
        const at = await ar.text();
        const is404 = at.includes('404') && at.includes('not be found');
        console.log(`${alt.replace('https://vidlink.pro','')} → ${ar.status} ${is404 ? '404' : 'OK'} (${at.length} bytes)`);
        if (!is404 && at.length > 1000) {
          // Found a working page - extract chunks
          const chunks = [...at.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
          console.log('  Chunks:', chunks.length);
          
          // Find page-specific chunks
          const pageChunks = chunks.filter(c => c.includes('page-'));
          console.log('  Page chunks:', pageChunks);
          
          // Look for API patterns in inline scripts
          const inlineScripts = [...at.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
            .map(m => m[1])
            .filter(s => s.includes('api') || s.includes('mercury') || s.includes('venus'));
          for (const s of inlineScripts) {
            console.log('  Inline script with API:', s.substring(0, 500));
          }
        }
      } catch (e) {
        console.log(`${alt.replace('https://vidlink.pro','')} → ERROR: ${e.message}`);
      }
    }
  }
  
  // Also try fetching the actual page chunks we found earlier
  console.log('\n--- Fetching known chunks with API references ---');
  
  // The page chunk that had /api/mercury, /api/venus, /api/b/movie/
  // It was at: page-fcddd0507354c058.js but we need the right path
  // Let's try fetching the layout chunk which loads the player
  const layoutChunk = '/_next/static/chunks/app/layout-0b392c34f0de0228.js';
  try {
    const lr = await fetch('https://vidlink.pro' + layoutChunk, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const ljs = await lr.text();
    console.log('Layout chunk:', ljs.length, 'bytes');
    if (ljs.includes('api')) {
      const apis = [...ljs.matchAll(/["'`](\/api\/[^"'`\s]{2,120})["'`]/g)].map(m => m[1]);
      console.log('APIs:', [...new Set(apis)]);
    }
    // Find any references to other chunks
    const refs = [...ljs.matchAll(/["'](\d+)["']/g)].map(m => m[1]).filter(n => parseInt(n) > 100);
    console.log('Chunk refs:', [...new Set(refs)].slice(0, 20));
  } catch (e) {
    console.log('Layout error:', e.message);
  }
  
  // Try numbered chunks that might contain the player logic
  const interestingChunks = ['380', '482', '304'];
  for (const num of interestingChunks) {
    // We already know these exist from the first scan
    const chunkUrl = `/_next/static/chunks/${num}-`;
    // We need the full hash - let's get it from the HTML
    const chunkMatch = html.match(new RegExp(`src="(/_next/static/chunks/${num}-[^"]+)"`));
    if (chunkMatch) {
      try {
        const cr = await fetch('https://vidlink.pro' + chunkMatch[1], { headers: HEADERS, signal: AbortSignal.timeout(8000) });
        const cjs = await cr.text();
        
        // Search for API patterns more aggressively
        const apiPatterns = [...cjs.matchAll(/["'`]((?:\/api\/|https?:\/\/[^"'`]*\/api\/)[^"'`\s]{2,120})["'`]/g)].map(m => m[1]);
        const fetchCalls = [...cjs.matchAll(/fetch\s*\(\s*["'`]([^"'`]+)["'`]/g)].map(m => m[1]);
        const concatApis = [...cjs.matchAll(/["'`]\/api\/["'`]\s*\+|concat\s*\(\s*["'`]\/api\//g)];
        
        if (apiPatterns.length > 0 || fetchCalls.length > 0 || concatApis.length > 0) {
          console.log(`\nChunk ${num} (${cjs.length} bytes):`);
          if (apiPatterns.length > 0) console.log('  APIs:', [...new Set(apiPatterns)]);
          if (fetchCalls.length > 0) console.log('  Fetch URLs:', [...new Set(fetchCalls)]);
          if (concatApis.length > 0) console.log('  Concat APIs found');
          
          // Find the context around /api/ references
          let idx = 0;
          while ((idx = cjs.indexOf('/api/', idx)) !== -1) {
            const context = cjs.substring(Math.max(0, idx - 150), Math.min(cjs.length, idx + 200));
            console.log('  Context:', context.replace(/\n/g, ' '));
            idx += 5;
            if (idx > cjs.length - 5) break;
          }
        }
      } catch (e) {
        console.log(`Chunk ${num} error:`, e.message);
      }
    }
  }
}

run().catch(e => console.log('Fatal:', e));
