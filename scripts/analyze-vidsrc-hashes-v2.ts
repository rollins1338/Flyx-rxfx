/**
 * VidSrc Hash Analysis Script v2
 * Fetches RCP, ProRCP AND SrcRCP pages to analyze hash generation patterns
 * Goal: Reverse engineer the hash to bypass Turnstile
 */

const TMDB_ID = '1228246'; // Five Nights at Freddy's 2 (correct ID)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (referer) headers['Referer'] = referer;
  
  const response = await fetch(url, { headers });
  return { status: response.status, html: await response.text() };
}

function decodeHash(hash: string, label: string): { md5: string | null, data: string | null } {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DECODING: ${label}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Raw hash length: ${hash.length}`);
  
  // Clean the hash - remove trailing dashes, convert URL-safe base64
  let clean = hash.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  
  try {
    const decoded = Buffer.from(clean, 'base64').toString('utf8');
    console.log(`First decode: ${decoded.substring(0, 100)}...`);
    
    if (decoded.includes(':')) {
      const colonIdx = decoded.indexOf(':');
      const part1 = decoded.substring(0, colonIdx);
      const part2 = decoded.substring(colonIdx + 1);
      
      console.log(`\nPart 1 (before ':'): ${part1}`);
      console.log(`Part 1 length: ${part1.length}`);
      
      if (/^[0-9a-f]{32}$/i.test(part1)) {
        console.log(`*** Part 1 IS AN MD5 HASH! ***`);
      }
      
      console.log(`\nPart 2 length: ${part2.length}`);
      
      // Decode part2
      let cleanPart2 = part2.replace(/-/g, '+').replace(/_/g, '/');
      while (cleanPart2.length % 4 !== 0) cleanPart2 += '=';
      
      try {
        const decodedPart2 = Buffer.from(cleanPart2, 'base64').toString('utf8');
        console.log(`Part 2 decoded: ${decodedPart2.substring(0, 150)}...`);
        
        // Try third level decode
        let cleanPart2b = decodedPart2.replace(/-/g, '+').replace(/_/g, '/');
        while (cleanPart2b.length % 4 !== 0) cleanPart2b += '=';
        
        try {
          const decodedPart2b = Buffer.from(cleanPart2b, 'base64').toString('utf8');
          console.log(`Part 2 double-decoded: ${decodedPart2b.substring(0, 150)}...`);
          return { md5: part1, data: decodedPart2b };
        } catch {
          return { md5: part1, data: decodedPart2 };
        }
      } catch {
        console.log(`Part 2 is NOT valid base64`);
        return { md5: part1, data: part2 };
      }
    }
    return { md5: null, data: decoded };
  } catch (e) {
    console.log(`Decode failed: ${e}`);
    return { md5: null, data: null };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('VIDSRC-EMBED.RU HASH ANALYSIS v2');
  console.log('Movie: Five Nights at Freddy\'s 2 (TMDB: ' + TMDB_ID + ')');
  console.log('='.repeat(80));

  // Step 1: Fetch embed page
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  console.log(`\n[1] Fetching: ${embedUrl}`);
  
  const embed = await fetchPage(embedUrl);
  console.log(`Status: ${embed.status}`);
  await Bun.write('debug-fnaf2-embed.html', embed.html);
  
  // Extract RCP URL
  const iframeMatch = embed.html.match(/<iframe[^>]*src=["']([^"']*cloudnestra\.com\/rcp\/([^"']+))["']/i);
  if (!iframeMatch) {
    console.error('No RCP iframe found!');
    console.log(embed.html.substring(0, 2000));
    return;
  }
  
  let rcpUrl = iframeMatch[1];
  if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;
  const rcpHash = iframeMatch[2];
  
  console.log(`\nRCP URL: ${rcpUrl.substring(0, 100)}...`);
  const rcpDecoded = decodeHash(rcpHash, 'RCP HASH (from embed page)');
  
  // Step 2: Fetch RCP page
  console.log(`\n[2] Fetching RCP page...`);
  const rcp = await fetchPage(rcpUrl, embedUrl);
  console.log(`Status: ${rcp.status}`);
  await Bun.write('debug-fnaf2-rcp.html', rcp.html);
  
  // Check for Turnstile
  const hasTurnstile = rcp.html.includes('turnstile') || rcp.html.includes('cf-turnstile');
  console.log(`Turnstile: ${hasTurnstile}`);
  
  // Extract ALL endpoint references (prorcp AND srcrcp)
  const prorcpMatches = [...rcp.html.matchAll(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/gi)];
  const srcrcpMatches = [...rcp.html.matchAll(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/gi)];
  
  console.log(`\nFound ${prorcpMatches.length} prorcp references`);
  console.log(`Found ${srcrcpMatches.length} srcrcp references`);
  
  // Process PRORCP
  if (prorcpMatches.length > 0) {
    const prorcpHash = prorcpMatches[0][1];
    const prorcpDecoded = decodeHash(prorcpHash, 'PRORCP HASH (from RCP page)');
    
    // Fetch prorcp page
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
    console.log(`\n[3] Fetching PRORCP: ${prorcpUrl.substring(0, 80)}...`);
    
    const prorcp = await fetchPage(prorcpUrl, rcpUrl);
    console.log(`Status: ${prorcp.status}`);
    await Bun.write('debug-fnaf2-prorcp.html', prorcp.html);
    
    // Extract encoded div
    const divMatch = prorcp.html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (divMatch) {
      console.log(`\nEncoded div ID: ${divMatch[1]}`);
      console.log(`Encoded content length: ${divMatch[2].length}`);
      console.log(`Content preview: ${divMatch[2].substring(0, 80)}...`);
    }
    
    // Extract decoder script
    const scriptMatch = prorcp.html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
    if (scriptMatch) {
      console.log(`Decoder script hash: ${scriptMatch[1]}`);
    }
  }
  
  // Process SRCRCP
  if (srcrcpMatches.length > 0) {
    const srcrcpHash = srcrcpMatches[0][1];
    const srcrcpDecoded = decodeHash(srcrcpHash, 'SRCRCP HASH (from RCP page)');
    
    // Fetch srcrcp page
    const srcrcpUrl = `https://cloudnestra.com/srcrcp/${srcrcpHash}`;
    console.log(`\n[4] Fetching SRCRCP: ${srcrcpUrl.substring(0, 80)}...`);
    
    const srcrcp = await fetchPage(srcrcpUrl, rcpUrl);
    console.log(`Status: ${srcrcp.status}`);
    await Bun.write('debug-fnaf2-srcrcp.html', srcrcp.html);
    
    // Extract encoded div
    const divMatch = srcrcp.html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (divMatch) {
      console.log(`\nEncoded div ID: ${divMatch[1]}`);
      console.log(`Encoded content length: ${divMatch[2].length}`);
      console.log(`Content preview: ${divMatch[2].substring(0, 80)}...`);
    }
  }
  
  // CRITICAL: Compare hashes to find pattern
  console.log('\n' + '='.repeat(80));
  console.log('HASH COMPARISON - LOOKING FOR PATTERNS');
  console.log('='.repeat(80));
  
  if (rcpDecoded.md5 && prorcpMatches.length > 0) {
    const prorcpHash = prorcpMatches[0][1];
    let cleanProrcp = prorcpHash.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
    while (cleanProrcp.length % 4 !== 0) cleanProrcp += '=';
    const prorcpDecoded = Buffer.from(cleanProrcp, 'base64').toString('utf8');
    const prorcpMd5 = prorcpDecoded.split(':')[0];
    
    console.log(`\nRCP MD5:    ${rcpDecoded.md5}`);
    console.log(`ProRCP MD5: ${prorcpMd5}`);
    console.log(`MD5s match: ${rcpDecoded.md5 === prorcpMd5}`);
    
    // Check if the data portions are related
    if (rcpDecoded.data && prorcpMatches.length > 0) {
      console.log(`\nRCP data preview:    ${rcpDecoded.data?.substring(0, 100)}...`);
    }
  }
  
  // Look for patterns in the JavaScript
  console.log('\n' + '='.repeat(80));
  console.log('JAVASCRIPT ANALYSIS');
  console.log('='.repeat(80));
  
  // Find the loadIframe function
  const loadIframeMatch = rcp.html.match(/function loadIframe[^}]+\{[\s\S]*?\}/);
  if (loadIframeMatch) {
    console.log('\nloadIframe function:');
    console.log(loadIframeMatch[0].substring(0, 500));
  }
  
  // Look for any hash generation code
  const hashPatterns = [
    /md5\s*\(/gi,
    /btoa\s*\(/gi,
    /atob\s*\(/gi,
    /CryptoJS/gi,
    /encrypt/gi,
    /decrypt/gi,
  ];
  
  console.log('\nSearching for crypto patterns in RCP page:');
  for (const pattern of hashPatterns) {
    const matches = rcp.html.match(pattern);
    if (matches) {
      console.log(`  ${pattern}: ${matches.length} matches`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
