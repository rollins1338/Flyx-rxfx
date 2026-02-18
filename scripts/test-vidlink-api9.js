// Fetch the actual movie player page to get the page-specific JS chunks
const crypto = require('crypto');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

async function run() {
  // The homepage works (200, 159KB) - let's check if it has a different route structure
  // Maybe movies are at a different path like /tmdb/550 or just embedded via iframe
  
  // Check the homepage for how it links to movies
  const hr = await fetch('https://vidlink.pro/', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await hr.text();
  
  // Find any route patterns in the RSC data
  const rscSegments = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)].map(m => m[1]);
  
  for (const seg of rscSegments) {
    const decoded = seg.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    // Look for route/page references
    if (decoded.includes('player') || decoded.includes('movie') || decoded.includes('tv') || 
        decoded.includes('api/b') || decoded.includes('mercury') || decoded.includes('page-')) {
      console.log('RSC segment with routes:', decoded.substring(0, 800));
      console.log('---');
    }
  }
  
  // The homepage loads these chunks for the layout:
  // 223, 279, app/layout
  // And for the page: app/page-5261dfa0df40f0ec.js
  // Let's check the page chunk
  try {
    const pr = await fetch('https://vidlink.pro/_next/static/chunks/app/page-5261dfa0df40f0ec.js', { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const pjs = await pr.text();
    console.log('\nHomepage page chunk:', pjs.length, 'bytes');
    // Look for route definitions
    if (pjs.includes('movie') || pjs.includes('player') || pjs.includes('api')) {
      console.log('Has movie/player/api references');
      const apis = [...pjs.matchAll(/["'`](\/api\/[^"'`\s]{2,80})["'`]/g)].map(m => m[1]);
      if (apis.length > 0) console.log('APIs:', [...new Set(apis)]);
      
      // Find route navigation
      const routes = [...pjs.matchAll(/["'`](\/(?:movie|tv|player|embed)[^"'`\s]{0,80})["'`]/g)].map(m => m[1]);
      if (routes.length > 0) console.log('Routes:', [...new Set(routes)]);
    }
  } catch (e) {
    console.log('Page chunk error:', e.message);
  }
  
  // Let's try to navigate to a movie page using Next.js client-side navigation
  // This requires the RSC protocol
  console.log('\n--- Trying RSC navigation to movie page ---');
  try {
    const rr = await fetch('https://vidlink.pro/movie/550', {
      headers: {
        ...HEADERS,
        'Accept': 'text/x-component',
        'RSC': '1',
        'Next-Router-State-Tree': encodeURIComponent(JSON.stringify(["",{"children":["(player)",{"children":["movie",{"children":[["id","550","d"],{"children":["__PAGE__",{}]}]}]}]}])),
        'Next-Url': '/movie/550',
      },
      signal: AbortSignal.timeout(10000)
    });
    const rscText = await rr.text();
    console.log('RSC nav status:', rr.status, 'length:', rscText.length);
    console.log('Content-Type:', rr.headers.get('content-type'));
    
    if (rscText.length > 0) {
      // Find chunk references
      const chunks = [...rscText.matchAll(/static\/chunks\/([^"'\s]+\.js)/g)].map(m => m[1]);
      if (chunks.length > 0) console.log('Chunks:', [...new Set(chunks)]);
      
      // Find API references
      const apis = [...rscText.matchAll(/api\/[a-z]+/g)].map(m => m[0]);
      if (apis.length > 0) console.log('APIs:', [...new Set(apis)]);
      
      console.log('First 1000:', rscText.substring(0, 1000));
    }
  } catch (e) {
    console.log('RSC nav error:', e.message);
  }
  
  // Let's also try the mercury endpoint with different params to understand the encryption
  console.log('\n--- Mercury endpoint analysis ---');
  const mr = await fetch('https://vidlink.pro/api/mercury?tmdbId=550&type=movie', {
    headers: { ...HEADERS, 'Referer': 'https://vidlink.pro/', 'Origin': 'https://vidlink.pro' },
    signal: AbortSignal.timeout(15000)
  });
  const mText = await mr.text();
  
  // Extract the encrypted value
  const varMatch = mText.match(/window\['([^']+)'\]\s*=\s*'([^']+)'/);
  if (varMatch) {
    const varName = varMatch[1];
    const encValue = varMatch[2];
    console.log('Variable:', varName, 'Length:', encValue.length);
    
    // Analyze the encoding
    const decoded = Buffer.from(encValue, 'base64');
    console.log('Base64 decoded length:', decoded.length);
    console.log('First 32 bytes hex:', decoded.slice(0, 32).toString('hex'));
    
    // The key might be used differently - try XOR with key
    const keyBuf = Buffer.from(KEY, 'hex');
    const xored = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      xored[i] = decoded[i] ^ keyBuf[i % keyBuf.length];
    }
    console.log('XOR with key first 100:', xored.slice(0, 100).toString('utf8'));
    
    // Try XOR with just the variable name
    const nameXored = Buffer.alloc(decoded.length);
    const nameBuf = Buffer.from(varName);
    for (let i = 0; i < decoded.length; i++) {
      nameXored[i] = decoded[i] ^ nameBuf[i % nameBuf.length];
    }
    console.log('XOR with varName first 100:', nameXored.slice(0, 100).toString('utf8'));
    
    // Try simple Caesar/shift
    const shifted = decoded.map(b => (b + 13) % 256);
    console.log('ROT13 bytes first 50:', Buffer.from(shifted.slice(0, 50)).toString('utf8'));
    
    // Check if the base64 value itself is a custom alphabet
    // Standard base64: A-Z a-z 0-9 + /
    // The value uses: A-Z a-z 0-9 + / = (standard base64)
    const uniqueChars = [...new Set(encValue)].sort().join('');
    console.log('Unique chars in value:', uniqueChars);
    console.log('Char count:', uniqueChars.length);
  }
}

run().catch(e => console.log('Fatal:', e));
