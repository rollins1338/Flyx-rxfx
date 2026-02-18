// Fetch the actual player page chunk and find the decryption logic
const crypto = require('crypto');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

async function run() {
  // The player page loads these chunks (from RSC response):
  // f8025e75, 53c13509, 07b5dd1e, c77734ac, aaea2bcf, 938, 223, 482, 304, 380
  // And the page chunk: app/movie/[id]/page-fcddd0507354c058.js
  
  // Note: the page chunk path is app/movie/[id]/ NOT app/(player)/movie/[id]/
  // Let's try fetching it
  const pageChunkUrl = 'https://vidlink.pro/_next/static/chunks/app/movie/%5Bid%5D/page-fcddd0507354c058.js';
  
  try {
    const pr = await fetch(pageChunkUrl, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const pjs = await pr.text();
    console.log('Page chunk:', pr.status, pjs.length, 'bytes');
    if (!pjs.startsWith('<!')) {
      require('fs').writeFileSync('scripts/vidlink-player-page.js', pjs);
      console.log('Saved to vidlink-player-page.js');
    }
  } catch (e) {
    console.log('Page chunk error:', e.message);
  }
  
  // Also fetch the player-specific chunks that aren't loaded on homepage
  const playerChunks = [
    'f8025e75-44b753887a7c13aa.js',
    '53c13509-02b05f5bdc126ee2.js', 
    '07b5dd1e-cdc722e8cb527850.js',
    '482-8330ffc9d89ead3d.js',
    '304-1259f6409b2b61cd.js',
    '380-250f06e8f355cf4f.js',
  ];
  
  for (const chunk of playerChunks) {
    const url = `https://vidlink.pro/_next/static/chunks/${chunk}`;
    try {
      const cr = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const js = await cr.text();
      if (js.startsWith('<!')) continue;
      
      // Search for the key patterns we need
      const hasMercury = js.includes('mercury');
      const hasVenus = js.includes('venus');
      const hasApiB = js.includes('/api/b');
      const hasDecrypt = js.includes('decrypt');
      const hasSubtle = js.includes('subtle');
      const hasKey = js.includes('c75136c5');
      const hasWindow = js.includes("window[");
      const hasFromCharCode = js.includes('fromCharCode');
      const hasXor = js.includes('^');
      
      const interesting = hasMercury || hasVenus || hasApiB || hasDecrypt || hasSubtle || hasKey;
      
      if (interesting) {
        console.log(`\n=== ${chunk} (${js.length} bytes) ===`);
        console.log('  mercury:', hasMercury, 'venus:', hasVenus, 'api/b:', hasApiB);
        console.log('  decrypt:', hasDecrypt, 'subtle:', hasSubtle, 'key:', hasKey);
        console.log('  window[]:', hasWindow, 'fromCharCode:', hasFromCharCode);
        
        // Save interesting chunks
        require('fs').writeFileSync(`scripts/vidlink-chunk-${chunk}`, js);
        console.log(`  Saved to vidlink-chunk-${chunk}`);
        
        // Find the specific context
        for (const term of ['mercury', 'venus', '/api/b', 'c75136c5', 'decrypt', 'subtle.importKey']) {
          let idx = js.indexOf(term);
          if (idx > -1) {
            console.log(`\n  "${term}" context:`);
            console.log('  ', js.substring(Math.max(0, idx - 400), Math.min(js.length, idx + 600)).replace(/\n/g, ' '));
          }
        }
      }
    } catch (e) {}
  }
}

run().catch(e => console.log('Fatal:', e));
