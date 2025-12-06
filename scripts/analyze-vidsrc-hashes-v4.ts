/**
 * VidSrc Hash Analysis v4
 * Deep dive into the encrypted data structure
 * Looking for patterns that could help bypass Turnstile
 */

const TMDB_ID = '1228246';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (referer) headers['Referer'] = referer;
  const response = await fetch(url, { headers });
  return await response.text();
}

function decodeHashFully(hash: string): { md5: string, level1: string, level2: string, level2Bytes: Buffer } | null {
  let clean = hash.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  
  try {
    const decoded = Buffer.from(clean, 'base64').toString('utf8');
    if (!decoded.includes(':')) return null;
    
    const colonIdx = decoded.indexOf(':');
    const md5 = decoded.substring(0, colonIdx);
    const level1 = decoded.substring(colonIdx + 1);
    
    // Decode level 1
    let cleanL1 = level1.replace(/-/g, '+').replace(/_/g, '/');
    while (cleanL1.length % 4 !== 0) cleanL1 += '=';
    const level2 = Buffer.from(cleanL1, 'base64').toString('utf8');
    const level2Bytes = Buffer.from(cleanL1, 'base64');
    
    return { md5, level1, level2, level2Bytes };
  } catch {
    return null;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('VIDSRC HASH DEEP ANALYSIS v4');
  console.log('='.repeat(80));

  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  
  // Fetch embed page
  console.log('\n[1] Fetching embed page...');
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) {
    console.error('No RCP hash found!');
    return;
  }
  
  const rcpHash = rcpMatch[1];
  const rcpDecoded = decodeHashFully(rcpHash);
  
  if (!rcpDecoded) {
    console.error('Failed to decode RCP hash');
    return;
  }
  
  console.log('\nRCP Hash Analysis:');
  console.log(`  MD5: ${rcpDecoded.md5}`);
  console.log(`  Level 1 (base64): ${rcpDecoded.level1.substring(0, 80)}...`);
  console.log(`  Level 2 length: ${rcpDecoded.level2.length} chars`);
  console.log(`  Level 2 bytes: ${rcpDecoded.level2Bytes.length} bytes`);
  
  // Analyze the level 2 data
  console.log('\n[2] Analyzing Level 2 data structure...');
  
  // Check if it looks like AES encrypted data
  const bytes = rcpDecoded.level2Bytes;
  console.log(`  First 32 bytes (hex): ${bytes.slice(0, 32).toString('hex')}`);
  console.log(`  Last 32 bytes (hex): ${bytes.slice(-32).toString('hex')}`);
  
  // Check for common encryption patterns
  // AES-CBC typically has 16-byte blocks
  console.log(`  Data length mod 16: ${bytes.length % 16} (0 = likely AES block cipher)`);
  
  // Fetch RCP page to get ProRCP
  console.log('\n[3] Fetching RCP page...');
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  // Save for analysis
  await Bun.write('debug-fnaf2-rcp-v4.html', rcpHtml);
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  console.log(`  Found prorcp: ${!!prorcpMatch}`);
  console.log(`  Found srcrcp: ${!!srcrcpMatch}`);
  
  if (prorcpMatch) {
    const prorcpHash = prorcpMatch[1];
    const prorcpDecoded = decodeHashFully(prorcpHash);
    
    if (prorcpDecoded) {
      console.log('\nProRCP Hash Analysis:');
      console.log(`  MD5: ${prorcpDecoded.md5}`);
      console.log(`  Level 2 length: ${prorcpDecoded.level2.length} chars`);
      console.log(`  Level 2 bytes: ${prorcpDecoded.level2Bytes.length} bytes`);
      
      // Compare RCP and ProRCP data
      console.log('\n[4] Comparing RCP vs ProRCP data...');
      
      const rcpBytes = rcpDecoded.level2Bytes;
      const prorcpBytes = prorcpDecoded.level2Bytes;
      
      console.log(`  RCP bytes: ${rcpBytes.length}`);
      console.log(`  ProRCP bytes: ${prorcpBytes.length}`);
      
      // XOR the two to see if there's a pattern
      if (rcpBytes.length === prorcpBytes.length) {
        const xorResult = Buffer.alloc(rcpBytes.length);
        for (let i = 0; i < rcpBytes.length; i++) {
          xorResult[i] = rcpBytes[i] ^ prorcpBytes[i];
        }
        
        // Check if XOR result has a pattern
        const uniqueXorBytes = new Set(xorResult);
        console.log(`  XOR unique bytes: ${uniqueXorBytes.size}`);
        console.log(`  XOR first 32 bytes: ${xorResult.slice(0, 32).toString('hex')}`);
        
        // Check if XOR is all zeros (same data)
        const allZeros = xorResult.every(b => b === 0);
        console.log(`  XOR all zeros (identical data): ${allZeros}`);
      }
      
      // Fetch the ProRCP page
      console.log('\n[5] Fetching ProRCP page...');
      const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
      const prorcpHtml = await fetchPage(prorcpUrl, rcpUrl);
      
      await Bun.write('debug-fnaf2-prorcp-v4.html', prorcpHtml);
      
      // Extract the encoded content
      const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
      if (divMatch) {
        console.log(`\n  Encoded div ID: ${divMatch[1]}`);
        console.log(`  Encoded content length: ${divMatch[2].length}`);
        
        // Analyze the encoded content format
        const content = divMatch[2];
        console.log(`  Content starts with: ${content.substring(0, 50)}`);
        console.log(`  Content ends with: ${content.substring(content.length - 50)}`);
        
        // Check if it's hex
        if (/^[0-9a-fA-F]+$/.test(content)) {
          console.log(`  Content is HEX encoded`);
        }
        
        // Check if it starts with = (base64 format)
        if (content.startsWith('=')) {
          console.log(`  Content starts with '=' - likely reversed base64`);
        }
      }
      
      // Extract decoder script
      const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
      if (scriptMatch) {
        console.log(`\n  Decoder script hash: ${scriptMatch[1]}`);
        
        // Fetch the decoder script
        const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptMatch[1]}.js`;
        console.log(`  Fetching decoder script...`);
        const scriptContent = await fetchPage(scriptUrl, prorcpUrl);
        
        await Bun.write('debug-fnaf2-decoder.js', scriptContent);
        console.log(`  Decoder script length: ${scriptContent.length}`);
        console.log(`  Decoder preview: ${scriptContent.substring(0, 200)}...`);
      }
    }
  }
  
  // KEY INSIGHT: Look at the RCP page JavaScript
  console.log('\n' + '='.repeat(80));
  console.log('ANALYZING RCP PAGE JAVASCRIPT');
  console.log('='.repeat(80));
  
  // Extract all script content
  const scripts = rcpHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i].replace(/<\/?script[^>]*>/gi, '').trim();
    if (script.length > 100 && script.length < 10000) {
      // Look for hash generation logic
      if (script.includes('prorcp') || script.includes('srcrcp') || script.includes('loadIframe')) {
        console.log(`\nScript ${i + 1} (${script.length} chars) - Contains relevant code:`);
        console.log(script.substring(0, 1500));
        if (script.length > 1500) console.log('... [truncated]');
      }
    }
  }
  
  // Check for external scripts
  const externalScripts = rcpHtml.match(/src=["']([^"']+\.js[^"']*)/gi) || [];
  console.log(`\nExternal scripts: ${externalScripts.length}`);
  externalScripts.forEach(s => console.log(`  ${s}`));
  
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  
  console.log(`
The hash structure is:
  base64(MD5:base64(base64(ENCRYPTED_DATA)))

Key findings:
1. MD5 changes on EVERY request (server-side random)
2. The encrypted data also changes on every request
3. The ProRCP hash is generated server-side when RCP page loads
4. There is NO way to derive ProRCP from RCP hash alone

The only way to get the ProRCP hash is to:
1. Fetch the RCP page (which may have Turnstile)
2. Extract the ProRCP hash from the response

If Turnstile is present, we need a browser to solve it.
`);
}

main().catch(console.error);
