// Deep reverse-engineer vidlink.pro - find the actual API endpoints from JS bundles
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro',
};

async function run() {
  // Get the player page
  const r = await fetch('https://vidlink.pro/movie/550', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await r.text();
  
  // Find ALL script sources
  const chunks = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
  console.log('All JS files:', chunks.length);
  
  // Also find inline __NEXT_DATA__
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const data = JSON.parse(nextData[1]);
      console.log('\n__NEXT_DATA__ buildId:', data.buildId);
      console.log('Page:', data.page);
      if (data.props?.pageProps) {
        console.log('pageProps keys:', Object.keys(data.props.pageProps));
        console.log('pageProps:', JSON.stringify(data.props.pageProps).substring(0, 500));
      }
    } catch (e) {
      console.log('NEXT_DATA parse error:', e.message);
      console.log('Raw:', nextData[1].substring(0, 300));
    }
  }
  
  // Fetch each JS chunk and search for API patterns, decrypt, key, fetch calls
  for (const chunk of chunks) {
    const url = chunk.startsWith('http') ? chunk : 'https://vidlink.pro' + chunk;
    try {
      const cr = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const js = await cr.text();
      
      if (js.length < 100) continue;
      
      // Search for interesting patterns
      const hasApi = js.includes('/api/');
      const hasDecrypt = js.includes('decrypt') || js.includes('AES') || js.includes('aes-');
      const hasKey = js.includes('c75136c5') || js.includes(HEADERS['User-Agent'].substring(0, 10));
      const hasFetch = js.includes('fetch(') || js.includes('.fetch');
      const hasSource = js.includes('sources') && js.includes('file');
      
      if (hasApi || hasDecrypt || hasKey || hasSource) {
        console.log(`\n=== ${chunk.split('/').pop()} (${js.length} bytes) ===`);
        if (hasApi) {
          const apis = [...js.matchAll(/["'`]((?:\/api\/|https?:\/\/[^"'`]*api[^"'`]*)[^"'`\s]{2,120})["'`]/g)].map(m => m[1]);
          console.log('API URLs:', [...new Set(apis)]);
        }
        if (hasDecrypt) {
          // Find decrypt function context
          const decIdx = js.search(/decrypt|AES|aes-256/i);
          if (decIdx > -1) {
            console.log('Decrypt context:', js.substring(Math.max(0, decIdx - 200), decIdx + 300).replace(/\n/g, ' '));
          }
        }
        if (hasKey) {
          const keyIdx = js.indexOf('c75136c5');
          console.log('Key context:', js.substring(Math.max(0, keyIdx - 100), keyIdx + 200));
        }
        if (hasSource && !hasApi && !hasDecrypt) {
          // Find sources pattern
          const srcIdx = js.search(/sources.*file|file.*sources/);
          if (srcIdx > -1) {
            console.log('Sources context:', js.substring(Math.max(0, srcIdx - 100), srcIdx + 200));
          }
        }
      }
    } catch (e) {
      // skip
    }
  }
}

run().catch(e => console.log('Fatal:', e));
