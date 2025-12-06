/**
 * VidSrc Hash Analysis Script v3
 * Multiple fetches to see if hashes are static or dynamic
 * Deep analysis of the hash structure
 */

const TMDB_ID = '1228246'; // Five Nights at Freddy's 2
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

function extractMd5AndData(hash: string): { md5: string, data: string, rawData: string } | null {
  let clean = hash.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  
  try {
    const decoded = Buffer.from(clean, 'base64').toString('utf8');
    if (decoded.includes(':')) {
      const colonIdx = decoded.indexOf(':');
      const md5 = decoded.substring(0, colonIdx);
      const rawData = decoded.substring(colonIdx + 1);
      
      // Decode the data part
      let cleanData = rawData.replace(/-/g, '+').replace(/_/g, '/');
      while (cleanData.length % 4 !== 0) cleanData += '=';
      const data = Buffer.from(cleanData, 'base64').toString('utf8');
      
      return { md5, data, rawData };
    }
  } catch {}
  return null;
}

async function main() {
  console.log('='.repeat(80));
  console.log('VIDSRC HASH ANALYSIS v3 - MULTIPLE FETCHES');
  console.log('='.repeat(80));

  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  
  // Fetch embed page multiple times
  console.log('\n[1] Fetching embed page 3 times to check if RCP hash changes...\n');
  
  const rcpHashes: string[] = [];
  const rcpMd5s: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 500)); // Small delay
    const html = await fetchPage(embedUrl);
    const match = html.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
    if (match) {
      const hash = match[1];
      rcpHashes.push(hash);
      const decoded = extractMd5AndData(hash);
      if (decoded) {
        rcpMd5s.push(decoded.md5);
        console.log(`Fetch ${i + 1}: MD5 = ${decoded.md5}`);
      }
    }
  }
  
  const uniqueRcpMd5s = [...new Set(rcpMd5s)];
  console.log(`\nUnique RCP MD5s: ${uniqueRcpMd5s.length} (${uniqueRcpMd5s.length === 1 ? 'STATIC!' : 'DYNAMIC'})`);
  
  // Now fetch RCP page multiple times
  console.log('\n[2] Fetching RCP page 3 times to check if ProRCP hash changes...\n');
  
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHashes[0]}`;
  const prorcpHashes: string[] = [];
  const prorcpMd5s: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 500));
    const html = await fetchPage(rcpUrl, embedUrl);
    
    // Look for prorcp
    const prorcpMatch = html.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
    if (prorcpMatch) {
      const hash = prorcpMatch[1];
      prorcpHashes.push(hash);
      const decoded = extractMd5AndData(hash);
      if (decoded) {
        prorcpMd5s.push(decoded.md5);
        console.log(`Fetch ${i + 1}: ProRCP MD5 = ${decoded.md5}`);
      }
    }
    
    // Look for srcrcp
    const srcrcpMatch = html.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
    if (srcrcpMatch) {
      console.log(`Fetch ${i + 1}: Found SRCRCP!`);
    }
  }
  
  const uniqueProrcpMd5s = [...new Set(prorcpMd5s)];
  console.log(`\nUnique ProRCP MD5s: ${uniqueProrcpMd5s.length} (${uniqueProrcpMd5s.length === 1 ? 'STATIC!' : 'DYNAMIC'})`);
  
  // Deep analysis of the hash structure
  console.log('\n' + '='.repeat(80));
  console.log('DEEP HASH STRUCTURE ANALYSIS');
  console.log('='.repeat(80));
  
  if (rcpHashes.length > 0) {
    const rcpDecoded = extractMd5AndData(rcpHashes[0]);
    if (rcpDecoded) {
      console.log('\nRCP Hash Structure:');
      console.log(`  MD5: ${rcpDecoded.md5}`);
      console.log(`  Raw data length: ${rcpDecoded.rawData.length}`);
      console.log(`  Decoded data length: ${rcpDecoded.data.length}`);
      console.log(`  Data preview (first 200 chars): ${rcpDecoded.data.substring(0, 200)}`);
      
      // Check if data looks like encrypted content
      const isPrintable = /^[\x20-\x7E\n\r\t]+$/.test(rcpDecoded.data.substring(0, 100));
      console.log(`  Data is printable ASCII: ${isPrintable}`);
      
      // Check for patterns in the data
      if (rcpDecoded.data.includes('http')) {
        console.log(`  *** DATA CONTAINS HTTP URL! ***`);
      }
    }
  }
  
  if (prorcpHashes.length > 0) {
    const prorcpDecoded = extractMd5AndData(prorcpHashes[0]);
    if (prorcpDecoded) {
      console.log('\nProRCP Hash Structure:');
      console.log(`  MD5: ${prorcpDecoded.md5}`);
      console.log(`  Raw data length: ${prorcpDecoded.rawData.length}`);
      console.log(`  Decoded data length: ${prorcpDecoded.data.length}`);
      console.log(`  Data preview (first 200 chars): ${prorcpDecoded.data.substring(0, 200)}`);
      
      const isPrintable = /^[\x20-\x7E\n\r\t]+$/.test(prorcpDecoded.data.substring(0, 100));
      console.log(`  Data is printable ASCII: ${isPrintable}`);
    }
  }
  
  // KEY QUESTION: Can we derive ProRCP hash from RCP hash?
  console.log('\n' + '='.repeat(80));
  console.log('KEY QUESTION: Is ProRCP derivable from RCP?');
  console.log('='.repeat(80));
  
  if (rcpHashes.length > 0 && prorcpHashes.length > 0) {
    const rcpDecoded = extractMd5AndData(rcpHashes[0]);
    const prorcpDecoded = extractMd5AndData(prorcpHashes[0]);
    
    if (rcpDecoded && prorcpDecoded) {
      // Check if the data portions are related
      console.log(`\nRCP MD5:    ${rcpDecoded.md5}`);
      console.log(`ProRCP MD5: ${prorcpDecoded.md5}`);
      console.log(`MD5s are different: ${rcpDecoded.md5 !== prorcpDecoded.md5}`);
      
      // Check if data lengths are similar
      console.log(`\nRCP data length:    ${rcpDecoded.data.length}`);
      console.log(`ProRCP data length: ${prorcpDecoded.data.length}`);
      
      // Check for common substrings
      const rcpData = rcpDecoded.rawData;
      const prorcpData = prorcpDecoded.rawData;
      
      // Check if one is a transformation of the other
      let commonPrefix = 0;
      for (let i = 0; i < Math.min(rcpData.length, prorcpData.length); i++) {
        if (rcpData[i] === prorcpData[i]) commonPrefix++;
        else break;
      }
      console.log(`\nCommon prefix length: ${commonPrefix}`);
      
      // Check if the raw data is the same
      console.log(`Raw data identical: ${rcpData === prorcpData}`);
    }
  }
  
  // Try to understand what the MD5 is hashing
  console.log('\n' + '='.repeat(80));
  console.log('MD5 ANALYSIS - What is being hashed?');
  console.log('='.repeat(80));
  
  // The MD5 could be:
  // 1. Hash of the TMDB ID
  // 2. Hash of timestamp + TMDB ID
  // 3. Hash of the data portion
  // 4. Random server-generated
  
  const crypto = require('crypto');
  
  const testInputs = [
    TMDB_ID,
    `movie/${TMDB_ID}`,
    `/embed/movie/${TMDB_ID}`,
    `1228246`,
  ];
  
  console.log('\nTesting if MD5 matches common inputs:');
  for (const input of testInputs) {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    console.log(`  MD5("${input}") = ${hash}`);
  }
  
  if (rcpHashes.length > 0) {
    const rcpDecoded = extractMd5AndData(rcpHashes[0]);
    if (rcpDecoded) {
      // Check if MD5 is hash of the data
      const dataHash = crypto.createHash('md5').update(rcpDecoded.rawData).digest('hex');
      console.log(`\n  MD5(RCP raw data) = ${dataHash}`);
      console.log(`  Actual RCP MD5    = ${rcpDecoded.md5}`);
      console.log(`  Match: ${dataHash === rcpDecoded.md5}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  
  if (uniqueRcpMd5s.length === 1 && uniqueProrcpMd5s.length > 1) {
    console.log('\n*** RCP hash is STATIC but ProRCP hash is DYNAMIC ***');
    console.log('This means the ProRCP hash is generated server-side on each RCP page load.');
    console.log('We CANNOT bypass the RCP page - we need to fetch it to get the ProRCP hash.');
  } else if (uniqueRcpMd5s.length === 1 && uniqueProrcpMd5s.length === 1) {
    console.log('\n*** BOTH hashes are STATIC! ***');
    console.log('This means we might be able to cache or predict the ProRCP hash!');
  } else {
    console.log('\n*** Both hashes are DYNAMIC ***');
    console.log('Hashes change on every request - server-side generation.');
  }
}

main().catch(console.error);
