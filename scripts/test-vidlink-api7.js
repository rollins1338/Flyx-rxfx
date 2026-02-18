// The player page chunks are loaded dynamically when navigating to a movie
// We need to find the page chunk for the player route
// From earlier scan: page-fcddd0507354c058.js had /api/mercury, /api/venus, /api/b/movie/
// But it was served as 404 HTML when fetched directly
// Let's try fetching it with the right Next.js build ID

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function run() {
  // Get the homepage to find the build ID
  const hr = await fetch('https://vidlink.pro/', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await hr.text();
  
  // Extract build ID from RSC data
  const buildIdMatch = html.match(/buildId["':]+\s*["']([^"']+)["']/);
  const buildId = buildIdMatch ? buildIdMatch[1] : null;
  console.log('Build ID:', buildId);
  
  // Find all chunk references in the RSC data
  const chunkRefs = [...html.matchAll(/static\/chunks\/([^"'\s]+\.js)/g)].map(m => m[1]);
  console.log('Chunk refs:', [...new Set(chunkRefs)]);
  
  // The page chunk for movie/[id] should be loadable via Next.js RSC
  // Try fetching the RSC data for a movie page
  if (buildId) {
    const rscUrl = `https://vidlink.pro/movie/550?_rsc=`;
    try {
      const rr = await fetch(rscUrl, { 
        headers: { 
          ...HEADERS, 
          'RSC': '1',
          'Next-Router-State-Tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(player)%22%2C%7B%22children%22%3A%5B%22movie%22%2C%7B%22children%22%3A%5B%5B%22id%22%2C%22550%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%5D%7D%5D%7D%5D',
          'Next-Url': '/movie/550',
        },
        signal: AbortSignal.timeout(10000) 
      });
      const rscText = await rr.text();
      console.log('\nRSC response:', rr.status, rscText.length, 'bytes');
      console.log('First 500:', rscText.substring(0, 500));
      
      // Find chunk references in RSC response
      const rscChunks = [...rscText.matchAll(/static\/chunks\/([^"'\s]+\.js)/g)].map(m => m[1]);
      if (rscChunks.length > 0) console.log('RSC chunks:', [...new Set(rscChunks)]);
    } catch (e) {
      console.log('RSC error:', e.message);
    }
  }
  
  // Try to directly fetch the page chunk with proper Next.js headers
  // The chunk path should be: /_next/static/chunks/app/(player)/movie/[id]/page-{hash}.js
  // But we need to URL-encode the brackets
  const pageChunkPaths = [
    '/_next/static/chunks/app/(player)/movie/[id]/page-fcddd0507354c058.js',
    '/_next/static/chunks/app/%28player%29/movie/%5Bid%5D/page-fcddd0507354c058.js',
  ];
  
  for (const path of pageChunkPaths) {
    try {
      const cr = await fetch('https://vidlink.pro' + path, { 
        headers: HEADERS, 
        signal: AbortSignal.timeout(8000) 
      });
      const text = await cr.text();
      const isHtml = text.startsWith('<!');
      console.log(`\n${path.split('chunks/')[1]} → ${cr.status} ${isHtml ? 'HTML' : 'JS'} (${text.length} bytes)`);
      if (!isHtml && text.length > 100) {
        console.log('Content:', text.substring(0, 500));
        
        // Search for API patterns
        const apis = [...text.matchAll(/["'`](\/api\/[^"'`\s]{2,120})["'`]/g)].map(m => m[1]);
        if (apis.length > 0) console.log('APIs:', [...new Set(apis)]);
        
        // Search for decrypt/crypto
        if (text.includes('decrypt') || text.includes('subtle') || text.includes('fromCharCode')) {
          console.log('Has crypto/decrypt logic!');
          const decIdx = text.search(/decrypt|subtle|fromCharCode/);
          console.log('Context:', text.substring(Math.max(0, decIdx - 300), decIdx + 500));
        }
      }
    } catch (e) {
      console.log(`${path} → ERROR: ${e.message}`);
    }
  }
  
  // Also try fetching the _buildManifest to find all page chunks
  if (buildId) {
    try {
      const bmUrl = `https://vidlink.pro/_next/static/${buildId}/_buildManifest.js`;
      const bmr = await fetch(bmUrl, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
      const bm = await bmr.text();
      console.log('\nBuild manifest:', bmr.status, bm.length, 'bytes');
      console.log(bm.substring(0, 2000));
    } catch (e) {
      console.log('Build manifest error:', e.message);
    }
  }
}

run().catch(e => console.log('Fatal:', e));
