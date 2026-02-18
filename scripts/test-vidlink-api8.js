// The build manifest should tell us all page chunks
// Let's find the build ID from the RSC payload more carefully
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function run() {
  const hr = await fetch('https://vidlink.pro/', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await hr.text();
  
  // Find build ID in various formats
  const patterns = [
    /buildId['":\s]+['"]([^'"]+)['"]/,
    /_next\/static\/([a-zA-Z0-9_-]{10,})\//, 
    /gVN6W8ANeHbG49HiyZqTc/,
  ];
  
  for (const p of patterns) {
    const m = html.match(p);
    if (m) console.log('Pattern match:', m[0].substring(0, 100));
  }
  
  // Find the build ID from _next/static paths
  const staticPaths = [...html.matchAll(/_next\/static\/([^/'"]+)\//g)].map(m => m[1]);
  const uniquePaths = [...new Set(staticPaths)].filter(p => p !== 'chunks' && p !== 'css' && p !== 'media');
  console.log('Static path segments:', uniquePaths);
  
  // Try each as build ID
  for (const bid of uniquePaths) {
    try {
      const bmUrl = `https://vidlink.pro/_next/static/${bid}/_buildManifest.js`;
      const bmr = await fetch(bmUrl, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
      if (bmr.ok) {
        const bm = await bmr.text();
        console.log(`\nBuild manifest for ${bid}:`, bm.length, 'bytes');
        console.log(bm.substring(0, 3000));
        
        // Extract page chunk paths
        const pageChunks = [...bm.matchAll(/page-[a-f0-9]+\.js/g)].map(m => m[0]);
        console.log('\nPage chunks:', pageChunks);
        break;
      }
    } catch (e) {}
  }
  
  // Also try the RSC buildId from the earlier 404 page
  // We saw: "buildId":"gVN6W8ANeHbG49HiyZqTc"
  const knownBuildId = 'gVN6W8ANeHbG49HiyZqTc';
  try {
    const bmUrl = `https://vidlink.pro/_next/static/${knownBuildId}/_buildManifest.js`;
    const bmr = await fetch(bmUrl, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
    if (bmr.ok) {
      const bm = await bmr.text();
      console.log(`\nBuild manifest for ${knownBuildId}:`, bm.length, 'bytes');
      console.log(bm);
    } else {
      console.log(`Build manifest ${knownBuildId}: ${bmr.status}`);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

run().catch(e => console.log('Fatal:', e));
