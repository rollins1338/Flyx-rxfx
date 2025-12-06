/**
 * Deep decode the hash data to see what's actually inside
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

async function main() {
  console.log('='.repeat(80));
  console.log('DEEP HASH DECODE');
  console.log('='.repeat(80));

  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.error('No RCP found'); return; }
  
  const rcpHash = rcpMatch[1];
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.error('No ProRCP found'); return; }
  
  const prorcpHash = prorcpMatch[1];
  
  console.log('\n[RCP HASH DECODE CHAIN]');
  console.log('Level 0 (raw):', rcpHash.substring(0, 80) + '...');
  
  const level1 = decodeB64(rcpHash);
  console.log('\nLevel 1:', level1.substring(0, 100) + '...');
  
  const [md5, dataB64] = level1.split(':');
  console.log('\nMD5:', md5);
  console.log('Data (base64):', dataB64.substring(0, 80) + '...');
  
  const level2 = decodeB64(dataB64);
  console.log('\nLevel 2 (decoded data):', level2.substring(0, 150) + '...');
  console.log('Level 2 length:', level2.length);
  
  // The level 2 data looks like base64 too! Let's try decoding it
  console.log('\n[TRYING LEVEL 3 DECODE]');
  try {
    const level3 = decodeB64(level2);
    console.log('Level 3:', level3.substring(0, 150) + '...');
    console.log('Level 3 length:', level3.length);
    
    // Check if level 3 is printable
    const isPrintable = /^[\x20-\x7E\n\r\t]+$/.test(level3.substring(0, 100));
    console.log('Level 3 is printable:', isPrintable);
    
    if (!isPrintable) {
      console.log('Level 3 hex:', Buffer.from(level3, 'binary').slice(0, 50).toString('hex'));
    }
    
    // Try level 4
    try {
      const level4 = decodeB64(level3);
      console.log('\nLevel 4:', level4.substring(0, 150) + '...');
    } catch (e) {
      console.log('\nLevel 4 decode failed - level 3 is not base64');
    }
  } catch (e) {
    console.log('Level 3 decode failed - level 2 is not base64');
    console.log('Level 2 hex:', Buffer.from(level2, 'binary').slice(0, 50).toString('hex'));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('PRORCP HASH DECODE CHAIN');
  console.log('='.repeat(80));
  
  console.log('\nLevel 0 (raw):', prorcpHash.substring(0, 80) + '...');
  
  const pLevel1 = decodeB64(prorcpHash);
  console.log('\nLevel 1:', pLevel1.substring(0, 100) + '...');
  
  const [pMd5, pDataB64] = pLevel1.split(':');
  console.log('\nMD5:', pMd5);
  console.log('Data (base64):', pDataB64.substring(0, 80) + '...');
  
  const pLevel2 = decodeB64(pDataB64);
  console.log('\nLevel 2 (decoded data):', pLevel2.substring(0, 150) + '...');
  console.log('Level 2 length:', pLevel2.length);
  
  // Try level 3
  console.log('\n[TRYING LEVEL 3 DECODE]');
  try {
    const pLevel3 = decodeB64(pLevel2);
    console.log('Level 3:', pLevel3.substring(0, 150) + '...');
    console.log('Level 3 length:', pLevel3.length);
    
    const isPrintable = /^[\x20-\x7E\n\r\t]+$/.test(pLevel3.substring(0, 100));
    console.log('Level 3 is printable:', isPrintable);
    
    if (!isPrintable) {
      console.log('Level 3 hex:', Buffer.from(pLevel3, 'binary').slice(0, 50).toString('hex'));
    }
  } catch (e) {
    console.log('Level 3 decode failed');
  }
  
  // Now let's see what the ACTUAL content might be
  console.log('\n' + '='.repeat(80));
  console.log('CONTENT ANALYSIS');
  console.log('='.repeat(80));
  
  // The data at level 2 looks like base64 characters
  // Let's check if it's URL-safe base64 or standard
  console.log('\nLevel 2 character analysis:');
  console.log('Contains +:', level2.includes('+'));
  console.log('Contains /:', level2.includes('/'));
  console.log('Contains -:', level2.includes('-'));
  console.log('Contains _:', level2.includes('_'));
  console.log('Contains =:', level2.includes('='));
  
  // Check if it might be encrypted with a key derived from TMDB ID
  console.log('\n[ENCRYPTION KEY ANALYSIS]');
  const crypto = require('crypto');
  
  // Common key derivations
  const possibleKeys = [
    TMDB_ID,
    md5,
    crypto.createHash('md5').update(TMDB_ID).digest('hex'),
    crypto.createHash('sha256').update(TMDB_ID).digest('hex').substring(0, 32),
  ];
  
  console.log('Possible keys tested:');
  for (const key of possibleKeys) {
    console.log(`  ${key.substring(0, 32)}...`);
  }
  
  // The structure seems to be:
  // base64(MD5:base64(base64(encrypted_data)))
  // Where encrypted_data is AES encrypted (1216 bytes = 76 * 16 blocks)
  
  console.log('\n[FINAL STRUCTURE]');
  console.log(`
Hash structure:
  Level 0: URL-safe base64 with -- suffix
  Level 1: MD5_HASH:BASE64_DATA
  Level 2: Base64 encoded string (looks like another base64)
  Level 3: Binary data (likely AES encrypted)

The encrypted data is 1216 bytes = 76 AES blocks (16 bytes each)
This suggests AES-128 or AES-256 in CBC or similar mode.

The MD5 hash is likely:
  - A checksum of the encrypted data
  - Or a signature for validation
  - Changes every request (server-side random IV/key)
`);
}

main().catch(console.error);
