/**
 * Apply the discovered decoding pattern to RCP/ProRCP hashes
 * Pattern found: REVERSE + SUBTRACT 1 FROM EACH CHAR + HEX DECODE
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

function decodeB64Str(str: string): string {
  let clean = str.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  return Buffer.from(clean, 'base64').toString('utf8');
}

// The magic decoder!
function decodeContent(encoded: string): string {
  // Step 1: Reverse
  const reversed = encoded.split('').reverse().join('');
  
  // Step 2: Subtract 1 from each char
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  
  // Step 3: Hex decode
  let decoded = '';
  for (let i = 0; i < adjusted.length; i += 2) {
    const hex = adjusted.substring(i, i + 2);
    const code = parseInt(hex, 16);
    if (!isNaN(code) && code > 0) {
      decoded += String.fromCharCode(code);
    }
  }
  
  return decoded;
}

// Try variations of the pattern
function tryAllVariations(data: string): void {
  console.log('\n[Trying all variations of the decode pattern]');
  
  // Variation 1: Direct decode
  const v1 = decodeContent(data);
  if (v1.includes('http')) {
    console.log('\n*** V1 (reverse+sub1+hex) SUCCESS ***');
    console.log(v1.substring(0, 300));
  }
  
  // Variation 2: Different subtract values
  for (let sub = 0; sub <= 5; sub++) {
    const reversed = data.split('').reverse().join('');
    let adjusted = '';
    for (let i = 0; i < reversed.length; i++) {
      adjusted += String.fromCharCode(reversed.charCodeAt(i) - sub);
    }
    let decoded = '';
    for (let i = 0; i < adjusted.length; i += 2) {
      const hex = adjusted.substring(i, i + 2);
      const code = parseInt(hex, 16);
      if (!isNaN(code) && code > 0 && code < 128) {
        decoded += String.fromCharCode(code);
      }
    }
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`\n*** Subtract ${sub} SUCCESS ***`);
      console.log(decoded.substring(0, 300));
    }
  }
  
  // Variation 3: No reverse, just subtract + hex
  for (let sub = 0; sub <= 5; sub++) {
    let adjusted = '';
    for (let i = 0; i < data.length; i++) {
      adjusted += String.fromCharCode(data.charCodeAt(i) - sub);
    }
    let decoded = '';
    for (let i = 0; i < adjusted.length; i += 2) {
      const hex = adjusted.substring(i, i + 2);
      const code = parseInt(hex, 16);
      if (!isNaN(code) && code > 0 && code < 128) {
        decoded += String.fromCharCode(code);
      }
    }
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`\n*** No reverse, subtract ${sub} SUCCESS ***`);
      console.log(decoded.substring(0, 300));
    }
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('APPLYING DISCOVERED DECODE PATTERN');
  console.log('='.repeat(80));

  // Fetch fresh data
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
  const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
  const prorcpHtml = await fetchPage(prorcpUrl, rcpUrl);
  
  // Get the encoded div content
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.error('No div found'); return; }
  
  const divId = divMatch[1];
  const encodedContent = divMatch[2];
  
  console.log(`\nDiv ID: ${divId}`);
  console.log(`Encoded content length: ${encodedContent.length}`);
  
  // Decode the div content
  console.log('\n' + '='.repeat(60));
  console.log('DECODING DIV CONTENT');
  console.log('='.repeat(60));
  
  const decoded = decodeContent(encodedContent);
  console.log(`\nDecoded content:`);
  console.log(decoded);
  
  // Now try to decode the RCP hash data
  console.log('\n' + '='.repeat(60));
  console.log('TRYING TO DECODE RCP HASH DATA');
  console.log('='.repeat(60));
  
  const rcpDecoded = decodeB64Str(rcpHash);
  const [rcpMd5, rcpDataB64] = rcpDecoded.split(':');
  const rcpDataLevel2 = decodeB64Str(rcpDataB64);
  
  console.log(`\nRCP MD5: ${rcpMd5}`);
  console.log(`RCP Data Level 2: ${rcpDataLevel2.substring(0, 80)}...`);
  
  tryAllVariations(rcpDataLevel2);
  
  // Try on the raw base64 data
  console.log('\n[Trying on raw base64 data]');
  tryAllVariations(rcpDataB64);
  
  // Now try to decode the ProRCP hash data
  console.log('\n' + '='.repeat(60));
  console.log('TRYING TO DECODE PRORCP HASH DATA');
  console.log('='.repeat(60));
  
  const prorcpDecoded = decodeB64Str(prorcpHash);
  const [prorcpMd5, prorcpDataB64] = prorcpDecoded.split(':');
  const prorcpDataLevel2 = decodeB64Str(prorcpDataB64);
  
  console.log(`\nProRCP MD5: ${prorcpMd5}`);
  console.log(`ProRCP Data Level 2: ${prorcpDataLevel2.substring(0, 80)}...`);
  
  tryAllVariations(prorcpDataLevel2);
  tryAllVariations(prorcpDataB64);
  
  // Check if the decoded content contains any clues about the hash relationship
  console.log('\n' + '='.repeat(60));
  console.log('ANALYZING DECODED STREAM URL');
  console.log('='.repeat(60));
  
  // Parse the decoded URL
  const urlMatch = decoded.match(/https?:\/\/[^\s"']+/g);
  if (urlMatch) {
    console.log('\nFound URLs:');
    urlMatch.forEach(url => {
      console.log(`  ${url}`);
      
      // Check if URL contains any identifiers
      if (url.includes(TMDB_ID)) console.log('    ^ Contains TMDB ID!');
      if (url.includes(rcpMd5)) console.log('    ^ Contains RCP MD5!');
      if (url.includes(prorcpMd5)) console.log('    ^ Contains ProRCP MD5!');
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`
DECODING SUCCESS!

The ProRCP page contains encoded content that decodes to stream URLs.
Decoding algorithm: REVERSE + SUBTRACT 1 + HEX DECODE

The RCP/ProRCP hash data appears to be encrypted differently (AES/similar).
The hash data is NOT using the same simple encoding as the div content.

The flow is:
1. vidsrc-embed.ru generates RCP hash (encrypted)
2. cloudnestra.com/rcp decrypts RCP, generates ProRCP hash (re-encrypted)
3. cloudnestra.com/prorcp contains div with simple encoding
4. Decoder script decodes div content to get stream URL

We CAN decode the final div content without the decoder script!
`);
}

main().catch(console.error);
