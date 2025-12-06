/**
 * VidSrc Hash Analysis Script
 * Fetches RCP and ProRCP pages to analyze hash generation patterns
 * Goal: Reverse engineer the hash to bypass Turnstile
 */

const TMDB_ID = '1228246'; // Five Nights at Freddy's 2
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface FetchResult {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
}

async function fetchPage(url: string, referer?: string): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  
  if (referer) {
    headers['Referer'] = referer;
  }

  const response = await fetch(url, { headers });
  const html = await response.text();
  
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    url,
    status: response.status,
    html,
    headers: responseHeaders
  };
}

function extractAllHashes(html: string): string[] {
  const hashes: string[] = [];
  
  // Look for any base64-like strings
  const base64Pattern = /[A-Za-z0-9+\/=_-]{20,}/g;
  const matches = html.match(base64Pattern) || [];
  
  for (const match of matches) {
    if (!hashes.includes(match) && match.length > 30) {
      hashes.push(match);
    }
  }
  
  return hashes;
}

function analyzeHash(hash: string, label: string): void {
  console.log(`\n=== ${label} ===`);
  console.log(`Hash: ${hash}`);
  console.log(`Length: ${hash.length}`);
  
  // Check if it contains a colon (separator)
  if (hash.includes(':')) {
    const parts = hash.split(':');
    console.log(`Contains colon separator - ${parts.length} parts`);
    parts.forEach((part, i) => {
      console.log(`  Part ${i}: ${part} (len: ${part.length})`);
      
      // Try to decode each part
      try {
        const decoded = Buffer.from(part, 'base64').toString('utf8');
        if (decoded.length > 0 && /^[\x20-\x7E]+$/.test(decoded)) {
          console.log(`    Base64 decoded: ${decoded}`);
        }
      } catch {}
    });
  }
  
  // Try base64 decode
  try {
    const decoded = Buffer.from(hash, 'base64').toString('utf8');
    if (decoded.length > 0 && decoded.length < 500) {
      console.log(`Base64 decoded: ${decoded.substring(0, 200)}`);
    }
  } catch {}
  
  // Try URL-safe base64
  try {
    const urlSafe = hash.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    if (decoded.length > 0 && decoded.length < 500) {
      console.log(`URL-safe Base64 decoded: ${decoded.substring(0, 200)}`);
    }
  } catch {}
  
  // Check for hex
  if (/^[0-9a-fA-F]+$/.test(hash)) {
    console.log(`Looks like HEX (${hash.length / 2} bytes)`);
    if (hash.length === 32) console.log('  -> Could be MD5');
    if (hash.length === 40) console.log('  -> Could be SHA1');
    if (hash.length === 64) console.log('  -> Could be SHA256');
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('VIDSRC-EMBED.RU HASH ANALYSIS');
  console.log('Movie: Five Nights at Freddy\'s 2 (TMDB: 507089)');
  console.log('='.repeat(80));

  // Step 1: Fetch the initial embed page
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  console.log(`\n[1] Fetching embed page: ${embedUrl}`);
  
  const embedResult = await fetchPage(embedUrl);
  console.log(`Status: ${embedResult.status}`);
  
  // Save embed page
  await Bun.write('debug-vidsrc-embed-fnaf2-analysis.html', embedResult.html);
  console.log('Saved to: debug-vidsrc-embed-fnaf2-analysis.html');
  
  // Extract RCP iframe URL
  const iframeMatch = embedResult.html.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
  
  if (!iframeMatch) {
    console.error('ERROR: Could not find RCP iframe!');
    console.log('\nHTML Preview:');
    console.log(embedResult.html.substring(0, 2000));
    return;
  }
  
  let rcpFullUrl = iframeMatch[1];
  // Fix protocol-relative URL
  if (rcpFullUrl.startsWith('//')) {
    rcpFullUrl = 'https:' + rcpFullUrl;
  }
  const rcpHash = iframeMatch[2];
  
  console.log(`\nFound RCP iframe:`);
  console.log(`  Full URL: ${rcpFullUrl}`);
  analyzeHash(rcpHash, 'RCP HASH FROM EMBED PAGE');
  
  // Step 2: Fetch the RCP page
  console.log(`\n[2] Fetching RCP page: ${rcpFullUrl}`);
  
  const rcpResult = await fetchPage(rcpFullUrl, embedUrl);
  console.log(`Status: ${rcpResult.status}`);
  
  // Save RCP page
  await Bun.write('debug-vidsrc-rcp-fnaf2-analysis.html', rcpResult.html);
  console.log('Saved to: debug-vidsrc-rcp-fnaf2-analysis.html');
  
  // Check for Turnstile
  const hasTurnstile = rcpResult.html.includes('turnstile') || rcpResult.html.includes('cf-turnstile');
  console.log(`\nTurnstile detected: ${hasTurnstile}`);
  
  // Extract ALL potential hashes/paths from RCP page
  console.log('\n[3] Analyzing RCP page content...');
  
  // Look for prorcp references
  const prorcpMatches = rcpResult.html.match(/prorcp\/([A-Za-z0-9+\/=_:-]+)/gi) || [];
  console.log(`\nFound ${prorcpMatches.length} prorcp references:`);
  prorcpMatches.forEach((match, i) => {
    const hash = match.replace('prorcp/', '');
    analyzeHash(hash, `PRORCP HASH #${i + 1}`);
  });
  
  // Look for srcrcp references
  const srcrcpMatches = rcpResult.html.match(/srcrcp\/([A-Za-z0-9+\/=_:-]+)/gi) || [];
  console.log(`\nFound ${srcrcpMatches.length} srcrcp references:`);
  srcrcpMatches.forEach((match, i) => {
    const hash = match.replace('srcrcp/', '');
    analyzeHash(hash, `SRCRCP HASH #${i + 1}`);
  });
  
  // Extract JavaScript variables and functions
  console.log('\n[4] Extracting JavaScript from RCP page...');
  
  const scriptMatches = rcpResult.html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  console.log(`Found ${scriptMatches.length} script blocks`);
  
  scriptMatches.forEach((script, i) => {
    const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
    if (content.length > 50 && content.length < 5000) {
      console.log(`\n--- Script Block ${i + 1} (${content.length} chars) ---`);
      console.log(content.substring(0, 1000));
      if (content.length > 1000) console.log('... [truncated]');
    }
  });
  
  // Step 3: If we found a prorcp hash, fetch that page too
  if (prorcpMatches.length > 0) {
    const prorcpHash = prorcpMatches[0].replace('prorcp/', '');
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
    
    console.log(`\n[5] Fetching ProRCP page: ${prorcpUrl}`);
    
    try {
      const prorcpResult = await fetchPage(prorcpUrl, rcpFullUrl);
      console.log(`Status: ${prorcpResult.status}`);
      
      // Save ProRCP page
      await Bun.write('debug-vidsrc-prorcp-fnaf2-analysis.html', prorcpResult.html);
      console.log('Saved to: debug-vidsrc-prorcp-fnaf2-analysis.html');
      
      // Look for encoded content div
      const divMatch = prorcpResult.html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
      if (divMatch) {
        console.log(`\nFound encoded div:`);
        console.log(`  ID: ${divMatch[1]}`);
        console.log(`  Content length: ${divMatch[2].length}`);
        console.log(`  Content preview: ${divMatch[2].substring(0, 100)}...`);
      }
      
      // Look for decoder script
      const decoderMatch = prorcpResult.html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
      if (decoderMatch) {
        console.log(`\nFound decoder script hash: ${decoderMatch[1]}`);
      }
    } catch (error) {
      console.error(`Failed to fetch ProRCP: ${error}`);
    }
  }
  
  // Step 4: CRITICAL ANALYSIS - Compare RCP hash to ProRCP hash
  console.log('\n' + '='.repeat(80));
  console.log('HASH RELATIONSHIP ANALYSIS');
  console.log('='.repeat(80));
  
  console.log('\nRCP Hash (from embed page):');
  console.log(`  ${rcpHash}`);
  
  if (prorcpMatches.length > 0) {
    const prorcpHash = prorcpMatches[0].replace('prorcp/', '');
    console.log('\nProRCP Hash (from RCP page):');
    console.log(`  ${prorcpHash}`);
    
    // Check if they share any common parts
    if (rcpHash.includes(':') && prorcpHash.includes(':')) {
      const rcpParts = rcpHash.split(':');
      const prorcpParts = prorcpHash.split(':');
      
      console.log('\nComparing parts:');
      console.log(`  RCP parts: ${rcpParts.length}`);
      console.log(`  ProRCP parts: ${prorcpParts.length}`);
      
      // Check for matching parts
      for (let i = 0; i < rcpParts.length; i++) {
        for (let j = 0; j < prorcpParts.length; j++) {
          if (rcpParts[i] === prorcpParts[j]) {
            console.log(`  MATCH: RCP[${i}] === ProRCP[${j}]: ${rcpParts[i]}`);
          }
        }
      }
    }
    
    // Check if prorcp hash is derived from rcp hash
    if (prorcpHash.startsWith(rcpHash) || rcpHash.startsWith(prorcpHash)) {
      console.log('\n*** One hash is a prefix of the other! ***');
    }
    
    // Check if they share a common substring
    const minLen = Math.min(rcpHash.length, prorcpHash.length);
    for (let len = minLen; len >= 10; len--) {
      for (let i = 0; i <= rcpHash.length - len; i++) {
        const substr = rcpHash.substring(i, i + len);
        if (prorcpHash.includes(substr)) {
          console.log(`\nCommon substring (len ${len}): ${substr}`);
          break;
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
