/**
 * Deep comparison of RCP and ProRCP hashes
 * Goal: Find the relationship/pattern between them
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

function decodeB64ToBuffer(str: string): Buffer {
  let clean = str.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  return Buffer.from(clean, 'base64');
}

async function main() {
  console.log('='.repeat(80));
  console.log('RCP vs PRORCP HASH COMPARISON');
  console.log('='.repeat(80));

  // Fetch embed page
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.error('No RCP found'); return; }
  
  const rcpHash = rcpMatch[1];
  
  // Fetch RCP page
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.error('No ProRCP found'); return; }
  
  const prorcpHash = prorcpMatch[1];
  
  console.log('\n[RAW HASHES]');
  console.log(`RCP hash length:    ${rcpHash.length}`);
  console.log(`ProRCP hash length: ${prorcpHash.length}`);
  console.log(`Same length: ${rcpHash.length === prorcpHash.length}`);
  
  // Decode level 1
  const rcpDecoded1 = decodeB64(rcpHash);
  const prorcpDecoded1 = decodeB64(prorcpHash);
  
  console.log('\n[LEVEL 1 DECODE - base64]');
  console.log(`RCP:    ${rcpDecoded1.substring(0, 100)}...`);
  console.log(`ProRCP: ${prorcpDecoded1.substring(0, 100)}...`);
  
  // Split by colon
  const rcpParts = rcpDecoded1.split(':');
  const prorcpParts = prorcpDecoded1.split(':');
  
  console.log('\n[STRUCTURE - MD5:DATA]');
  console.log(`RCP MD5:    ${rcpParts[0]} (${rcpParts[0].length} chars)`);
  console.log(`ProRCP MD5: ${prorcpParts[0]} (${prorcpParts[0].length} chars)`);
  console.log(`MD5s match: ${rcpParts[0] === prorcpParts[0]}`);
  
  const rcpData = rcpParts[1];
  const prorcpData = prorcpParts[1];
  
  console.log(`\nRCP data length:    ${rcpData.length}`);
  console.log(`ProRCP data length: ${prorcpData.length}`);
  console.log(`Data lengths match: ${rcpData.length === prorcpData.length}`);
  
  // Decode level 2 (the data part)
  console.log('\n[LEVEL 2 DECODE - data part]');
  const rcpData2 = decodeB64(rcpData);
  const prorcpData2 = decodeB64(prorcpData);
  
  console.log(`RCP data2 length:    ${rcpData2.length}`);
  console.log(`ProRCP data2 length: ${prorcpData2.length}`);
  console.log(`Data2 lengths match: ${rcpData2.length === prorcpData2.length}`);
  
  // Compare byte by byte
  console.log('\n[BYTE-BY-BYTE COMPARISON]');
  const rcpBytes = decodeB64ToBuffer(rcpData);
  const prorcpBytes = decodeB64ToBuffer(prorcpData);
  
  let matchingBytes = 0;
  let diffPositions: number[] = [];
  
  for (let i = 0; i < Math.min(rcpBytes.length, prorcpBytes.length); i++) {
    if (rcpBytes[i] === prorcpBytes[i]) {
      matchingBytes++;
    } else {
      if (diffPositions.length < 20) diffPositions.push(i);
    }
  }
  
  console.log(`Matching bytes: ${matchingBytes}/${rcpBytes.length}`);
  console.log(`First diff positions: ${diffPositions.slice(0, 10).join(', ')}`);
  
  // XOR analysis
  console.log('\n[XOR ANALYSIS]');
  const xorResult = Buffer.alloc(Math.min(rcpBytes.length, prorcpBytes.length));
  for (let i = 0; i < xorResult.length; i++) {
    xorResult[i] = rcpBytes[i] ^ prorcpBytes[i];
  }
  
  // Check if XOR has a repeating pattern
  const xorHex = xorResult.toString('hex');
  console.log(`XOR first 64 bytes: ${xorHex.substring(0, 128)}`);
  
  // Check for repeating patterns in XOR
  for (let patternLen = 1; patternLen <= 32; patternLen++) {
    const pattern = xorHex.substring(0, patternLen * 2);
    let isRepeating = true;
    for (let i = patternLen * 2; i < xorHex.length; i += patternLen * 2) {
      if (xorHex.substring(i, i + patternLen * 2) !== pattern) {
        isRepeating = false;
        break;
      }
    }
    if (isRepeating && patternLen < 32) {
      console.log(`*** REPEATING XOR PATTERN FOUND! Length: ${patternLen} ***`);
      console.log(`Pattern: ${pattern}`);
      break;
    }
  }
  
  // Check if data is just shifted/rotated
  console.log('\n[SHIFT/ROTATION CHECK]');
  const rcpDataStr = rcpData;
  const prorcpDataStr = prorcpData;
  
  // Check if one is a substring of the other (rotation)
  const doubled = rcpDataStr + rcpDataStr;
  if (doubled.includes(prorcpDataStr)) {
    const rotationPos = doubled.indexOf(prorcpDataStr);
    console.log(`*** ProRCP is RCP rotated by ${rotationPos} positions! ***`);
  }
  
  // Check character frequency
  console.log('\n[CHARACTER FREQUENCY]');
  const rcpFreq: Record<string, number> = {};
  const prorcpFreq: Record<string, number> = {};
  
  for (const c of rcpDataStr) rcpFreq[c] = (rcpFreq[c] || 0) + 1;
  for (const c of prorcpDataStr) prorcpFreq[c] = (prorcpFreq[c] || 0) + 1;
  
  const rcpChars = Object.keys(rcpFreq).sort();
  const prorcpChars = Object.keys(prorcpFreq).sort();
  
  console.log(`RCP unique chars:    ${rcpChars.length}`);
  console.log(`ProRCP unique chars: ${prorcpChars.length}`);
  console.log(`Same charset: ${rcpChars.join('') === prorcpChars.join('')}`);
  
  // Check if it's a simple substitution cipher
  console.log('\n[SUBSTITUTION CIPHER CHECK]');
  const charMapping: Record<string, Set<string>> = {};
  
  for (let i = 0; i < Math.min(rcpDataStr.length, prorcpDataStr.length); i++) {
    const rcpChar = rcpDataStr[i];
    const prorcpChar = prorcpDataStr[i];
    
    if (!charMapping[rcpChar]) charMapping[rcpChar] = new Set();
    charMapping[rcpChar].add(prorcpChar);
  }
  
  let isSimpleSubstitution = true;
  for (const [char, mappings] of Object.entries(charMapping)) {
    if (mappings.size > 1) {
      isSimpleSubstitution = false;
      break;
    }
  }
  
  console.log(`Simple substitution cipher: ${isSimpleSubstitution}`);
  
  // Check common prefixes/suffixes
  console.log('\n[COMMON PREFIX/SUFFIX]');
  let commonPrefix = 0;
  for (let i = 0; i < Math.min(rcpDataStr.length, prorcpDataStr.length); i++) {
    if (rcpDataStr[i] === prorcpDataStr[i]) commonPrefix++;
    else break;
  }
  
  let commonSuffix = 0;
  for (let i = 0; i < Math.min(rcpDataStr.length, prorcpDataStr.length); i++) {
    if (rcpDataStr[rcpDataStr.length - 1 - i] === prorcpDataStr[prorcpDataStr.length - 1 - i]) commonSuffix++;
    else break;
  }
  
  console.log(`Common prefix length: ${commonPrefix}`);
  console.log(`Common suffix length: ${commonSuffix}`);
  
  // Check if the MD5 is derived from the data
  console.log('\n[MD5 DERIVATION CHECK]');
  const crypto = require('crypto');
  
  // Test various MD5 inputs
  const testInputs = [
    rcpData,
    prorcpData,
    rcpData2,
    prorcpData2,
    TMDB_ID,
    `movie/${TMDB_ID}`,
    rcpParts[0], // RCP MD5 itself
    prorcpParts[0], // ProRCP MD5 itself
  ];
  
  for (const input of testInputs) {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    if (hash === rcpParts[0]) {
      console.log(`*** RCP MD5 matches MD5 of: ${input.substring(0, 50)}... ***`);
    }
    if (hash === prorcpParts[0]) {
      console.log(`*** ProRCP MD5 matches MD5 of: ${input.substring(0, 50)}... ***`);
    }
  }
  
  // Final analysis
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`
RCP Hash:    base64(${rcpParts[0]}:base64(${rcpData2.length} bytes encrypted data))
ProRCP Hash: base64(${prorcpParts[0]}:base64(${prorcpData2.length} bytes encrypted data))

Key observations:
- Both hashes have the same structure: MD5:base64(data)
- MD5 hashes are DIFFERENT
- Data lengths are ${rcpData.length === prorcpData.length ? 'IDENTICAL' : 'DIFFERENT'}
- Data content is ${matchingBytes === rcpBytes.length ? 'IDENTICAL' : 'DIFFERENT'}
`);
}

main().catch(console.error);
