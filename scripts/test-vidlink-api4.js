// Find the actual working vidlink.pro page/API structure
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function run() {
  // Try the homepage first to understand the site structure
  const r = await fetch('https://vidlink.pro/', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await r.text();
  console.log('Homepage:', r.status, html.length, 'bytes');
  
  // Find all links/routes
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(l => l.startsWith('/'));
  console.log('Internal links:', [...new Set(links)]);
  
  // Find all page chunks to understand route structure
  const pageChunks = [...html.matchAll(/static\/chunks\/app\/([^"]+page-[^"]+\.js)/g)].map(m => m[1]);
  console.log('Page chunks:', pageChunks);
  
  // Find buildManifest or route manifest
  const buildManifest = html.match(/_buildManifest\.js/);
  if (buildManifest) {
    const bmUrl = html.match(/src="([^"]*_buildManifest[^"]*)"/);
    if (bmUrl) {
      const bmr = await fetch('https://vidlink.pro' + bmUrl[1], { headers: HEADERS, signal: AbortSignal.timeout(5000) });
      const bm = await bmr.text();
      console.log('\nBuild manifest:', bm.substring(0, 1000));
    }
  }
  
  // Find the ssgManifest
  const ssgManifest = html.match(/src="([^"]*_ssgManifest[^"]*)"/);
  if (ssgManifest) {
    console.log('SSG manifest URL:', ssgManifest[1]);
  }
  
  // Try to find the Next.js build ID and fetch the routes
  const buildId = html.match(/buildId["':]+\s*["']([^"']+)["']/);
  if (buildId) {
    console.log('\nBuild ID:', buildId[1]);
    // Try to fetch route manifest
    try {
      const rmr = await fetch(`https://vidlink.pro/_next/data/${buildId[1]}/movie/550.json`, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
      console.log('Route data:', rmr.status);
      if (rmr.ok) {
        const rd = await rmr.text();
        console.log('Route data:', rd.substring(0, 500));
      }
    } catch (e) {
      console.log('Route data error:', e.message);
    }
  }
  
  // Check all the Next.js RSC data in the page
  const rscData = [...html.matchAll(/self\.__next_f\.push\(\[1,"([^"]+)"\]\)/g)].map(m => m[1]);
  for (const d of rscData) {
    const decoded = d.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    if (decoded.includes('api') || decoded.includes('mercury') || decoded.includes('venus') || decoded.includes('movie') || decoded.includes('player')) {
      console.log('\nRSC data with interesting content:', decoded.substring(0, 500));
    }
  }
  
  // Try different TMDB IDs - maybe 550 is just not available
  console.log('\n--- Testing different movie IDs ---');
  const ids = ['157336', '299536', '603', '680', '278'];
  for (const id of ids) {
    try {
      const mr = await fetch(`https://vidlink.pro/api/b/movie/${id}`, { 
        headers: { ...HEADERS, 'Referer': 'https://vidlink.pro/', 'Origin': 'https://vidlink.pro' },
        signal: AbortSignal.timeout(5000) 
      });
      const mt = await mr.text();
      console.log(`/api/b/movie/${id} → ${mr.status} len=${mt.length} ${mt.substring(0, 80)}`);
    } catch (e) {
      console.log(`/api/b/movie/${id} → ERROR: ${e.message}`);
    }
  }
  
  // Try the mercury/venus endpoints
  console.log('\n--- Testing mercury/venus endpoints ---');
  const apiTests = [
    '/api/mercury/movie/550',
    '/api/venus/movie/550',
    '/api/mercury?tmdbId=550&type=movie',
    '/api/venus?tmdbId=550&type=movie',
  ];
  for (const path of apiTests) {
    try {
      const ar = await fetch('https://vidlink.pro' + path, { 
        headers: { ...HEADERS, 'Referer': 'https://vidlink.pro/', 'Origin': 'https://vidlink.pro' },
        signal: AbortSignal.timeout(5000) 
      });
      const at = await ar.text();
      const isHtml = at.startsWith('<!') || at.startsWith('<html');
      console.log(`${path} → ${ar.status} ${isHtml ? 'HTML' : 'DATA'} len=${at.length} ${isHtml ? '' : at.substring(0, 100)}`);
    } catch (e) {
      console.log(`${path} → ERROR: ${e.message}`);
    }
  }
}

run().catch(e => console.log('Fatal:', e));
