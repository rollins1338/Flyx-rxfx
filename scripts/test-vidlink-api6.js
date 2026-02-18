// Find the decryption logic in vidlink.pro JS bundles
// We know the mercury endpoint sets window['ZpQw9XkLmN8c3vR3'] = encrypted data
// We need to find the JS that reads this and decrypts it

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function run() {
  // Get the homepage to find all chunks
  const hr = await fetch('https://vidlink.pro/', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await hr.text();
  
  // Get ALL script URLs (both chunks and inline)
  const scriptUrls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
  console.log('Total scripts:', scriptUrls.length);
  
  // Also check the RSC payload for chunk references
  const rscChunks = [...html.matchAll(/static\/chunks\/([^"]+\.js)/g)].map(m => '/_next/static/chunks/' + m[1]);
  const allChunks = [...new Set([...scriptUrls, ...rscChunks])];
  console.log('All unique chunks:', allChunks.length);
  
  // Search each chunk for the decryption logic
  for (const chunk of allChunks) {
    const url = chunk.startsWith('http') ? chunk : 'https://vidlink.pro' + chunk;
    try {
      const cr = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const js = await cr.text();
      if (js.length < 100) continue;
      
      // Search for window variable access, mercury, or crypto patterns
      const hasWindowAccess = js.includes("window[") || js.includes("window['");
      const hasMercury = js.includes('mercury');
      const hasVenus = js.includes('venus');
      const hasApiB = js.includes('/api/b');
      const hasCrypto = js.includes('subtle') || js.includes('importKey') || js.includes('createDecipher');
      const hasXor = js.match(/\^\s*\d+|\bxor\b/i);
      const hasAtob = js.includes('atob');
      const hasFromCharCode = js.includes('fromCharCode');
      
      if (hasMercury || hasVenus || hasApiB || (hasWindowAccess && (hasCrypto || hasXor || hasAtob))) {
        const name = chunk.split('/').pop();
        console.log(`\n=== ${name} (${js.length} bytes) ===`);
        
        // Extract relevant sections
        for (const term of ['mercury', 'venus', '/api/b', 'window[', 'subtle', 'importKey', 'fromCharCode', 'atob']) {
          let idx = 0;
          let count = 0;
          while ((idx = js.indexOf(term, idx)) !== -1 && count < 3) {
            const start = Math.max(0, idx - 300);
            const end = Math.min(js.length, idx + 400);
            const context = js.substring(start, end).replace(/\n/g, ' ');
            console.log(`\n  "${term}" at ${idx}:`);
            console.log(`  ${context}`);
            idx += term.length;
            count++;
          }
        }
      }
    } catch (e) {}
  }
  
  // Also check the layout and page-specific chunks from RSC data
  // The RSC data references chunk IDs like "380", "482", etc.
  // Let's also look at the 279 and 223 chunks which are loaded for the layout
  const layoutChunks = ['223-489b1204a8af3924.js', '279-130f986d4b1eb2b7.js', 'app/layout-0b392c34f0de0228.js'];
  for (const lc of layoutChunks) {
    const url = `https://vidlink.pro/_next/static/chunks/${lc}`;
    try {
      const cr = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const js = await cr.text();
      if (js.includes('mercury') || js.includes('venus') || js.includes('/api/b') || js.includes('decrypt') || js.includes('window[')) {
        console.log(`\n=== ${lc} (${js.length} bytes) - LAYOUT CHUNK ===`);
        for (const term of ['mercury', 'venus', '/api/b', 'decrypt', 'window[']) {
          let idx = js.indexOf(term);
          if (idx > -1) {
            console.log(`  "${term}":`, js.substring(Math.max(0, idx - 300), idx + 400).replace(/\n/g, ' '));
          }
        }
      }
    } catch (e) {}
  }
}

run().catch(e => console.log('Fatal:', e));
