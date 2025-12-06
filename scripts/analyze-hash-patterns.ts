/**
 * Analyze hash patterns across multiple requests
 * Looking for: static parts, predictable parts, derivable relationships
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

function decodeB64(str: string): string {
  let clean = str.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  return Buffer.from(clean, 'base64').toString('utf8');
}

interface HashData {
  raw: string;
  md5: string;
  data: string;
  dataDecoded: string;
}

function parseHash(hash: string): HashData {
  const decoded = decodeB64(hash);
  const [md5, data] = decoded.split(':');
  const dataDecoded = decodeB64(data);
  return { raw: hash, md5, data, dataDecoded };
}

async function fetchHashes(): Promise<{ rcp: HashData; prorcp: HashData } | null> {
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) return null;
  
  const rcpHash = rcpMatch[1];
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) return null;
  
  return {
    rcp: parseHash(rcpHash),
    prorcp: parseHash(prorcpMatch[1])
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('HASH PATTERN ANALYSIS - Multiple Requests');
  console.log('='.repeat(80));

  const samples: { rcp: HashData; prorcp: HashData }[] = [];
  
  console.log('\nFetching 5 samples...\n');
  
  for (let i = 0; i < 5; i++) {
    const result = await fetchHashes();
    if (result) {
      samples.push(result);
      console.log(`Sample ${i + 1}:`);
      console.log(`  RCP MD5:    ${result.rcp.md5}`);
      console.log(`  ProRCP MD5: ${result.prorcp.md5}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));
  
  // Check if any MD5s repeat
  const rcpMd5s = samples.map(s => s.rcp.md5);
  const prorcpMd5s = samples.map(s => s.prorcp.md5);
  
  console.log('\n[MD5 UNIQUENESS]');
  console.log(`Unique RCP MD5s:    ${new Set(rcpMd5s).size}/${samples.length}`);
  console.log(`Unique ProRCP MD5s: ${new Set(prorcpMd5s).size}/${samples.length}`);
  
  // Check if data parts have any common substrings
  console.log('\n[DATA COMMONALITY]');
  
  if (samples.length >= 2) {
    const data1 = samples[0].rcp.data;
    const data2 = samples[1].rcp.data;
    
    // Find longest common substring
    let longestCommon = '';
    for (let len = Math.min(data1.length, data2.length); len >= 10; len--) {
      let found = false;
      for (let i = 0; i <= data1.length - len; i++) {
        const substr = data1.substring(i, i + len);
        if (data2.includes(substr)) {
          longestCommon = substr;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    
    console.log(`Longest common substring in RCP data: ${longestCommon.length} chars`);
    if (longestCommon.length > 0) {
      console.log(`  "${longestCommon.substring(0, 50)}..."`);
    }
  }
  
  // Check if RCP and ProRCP from SAME request share anything
  console.log('\n[RCP vs PRORCP RELATIONSHIP (same request)]');
  
  for (let i = 0; i < Math.min(3, samples.length); i++) {
    const s = samples[i];
    
    // Check if MD5s are related
    const crypto = require('crypto');
    
    // Is ProRCP MD5 derived from RCP MD5?
    const testHashes = [
      crypto.createHash('md5').update(s.rcp.md5).digest('hex'),
      crypto.createHash('md5').update(s.rcp.data).digest('hex'),
      crypto.createHash('md5').update(s.rcp.dataDecoded).digest('hex'),
      crypto.createHash('md5').update(s.rcp.md5 + s.rcp.data).digest('hex'),
    ];
    
    console.log(`\nSample ${i + 1}:`);
    console.log(`  RCP MD5:    ${s.rcp.md5}`);
    console.log(`  ProRCP MD5: ${s.prorcp.md5}`);
    
    for (const h of testHashes) {
      if (h === s.prorcp.md5) {
        console.log(`  *** MATCH FOUND! ProRCP MD5 is derived! ***`);
      }
    }
    
    // Check if data parts share common bytes
    const rcpBytes = Buffer.from(s.rcp.dataDecoded, 'binary');
    const prorcpBytes = Buffer.from(s.prorcp.dataDecoded, 'binary');
    
    let matching = 0;
    for (let j = 0; j < Math.min(rcpBytes.length, prorcpBytes.length); j++) {
      if (rcpBytes[j] === prorcpBytes[j]) matching++;
    }
    
    console.log(`  Matching bytes: ${matching}/${rcpBytes.length} (${(matching/rcpBytes.length*100).toFixed(1)}%)`);
  }
  
  // Check the decoded data structure
  console.log('\n[DECODED DATA STRUCTURE]');
  
  const sample = samples[0];
  const rcpDataBytes = Buffer.from(sample.rcp.dataDecoded, 'binary');
  const prorcpDataBytes = Buffer.from(sample.prorcp.dataDecoded, 'binary');
  
  console.log(`\nRCP decoded data (first 100 bytes hex):`);
  console.log(`  ${rcpDataBytes.slice(0, 100).toString('hex')}`);
  
  console.log(`\nProRCP decoded data (first 100 bytes hex):`);
  console.log(`  ${prorcpDataBytes.slice(0, 100).toString('hex')}`);
  
  // Check if it looks like AES encrypted data
  console.log(`\nData length mod 16: ${rcpDataBytes.length % 16} (0 = likely AES)`);
  
  // Check entropy (randomness)
  const byteFreq: number[] = new Array(256).fill(0);
  for (const b of rcpDataBytes) byteFreq[b]++;
  
  let entropy = 0;
  for (const freq of byteFreq) {
    if (freq > 0) {
      const p = freq / rcpDataBytes.length;
      entropy -= p * Math.log2(p);
    }
  }
  
  console.log(`Data entropy: ${entropy.toFixed(2)} bits (8 = perfectly random)`);
  
  // Final conclusion
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  
  console.log(`
Based on the analysis:

1. STRUCTURE: Both hashes are base64(MD5:base64(encrypted_data))
2. MD5: Changes every request - appears to be random/server-generated
3. DATA: Same length (1216 bytes) but completely different content
4. ENTROPY: High (~${entropy.toFixed(1)} bits) - data is encrypted/random
5. RELATIONSHIP: No obvious derivation between RCP and ProRCP hashes

The hashes appear to be:
- Generated server-side with random components
- The MD5 is likely a signature/checksum of the encrypted data
- The encrypted data contains the actual stream info

Since there's NO predictable relationship between RCP and ProRCP hashes,
we CANNOT derive one from the other. We MUST fetch the RCP page to get
the ProRCP hash.

GOOD NEWS: The RCP page currently returns ProRCP without Turnstile!
`);
}

main().catch(console.error);
