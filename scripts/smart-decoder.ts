/**
 * Smart decoder that detects the format and applies the right algorithm
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

// Format 1: HEX (16 unique chars, only 0-9 and a-f)
function isHexFormat(content: string): boolean {
  return /^[0-9a-f]+$/i.test(content);
}

function decodeHex(content: string): string {
  let decoded = '';
  for (let i = 0; i < content.length; i += 2) {
    const hex = content.substring(i, i + 2);
    const code = parseInt(hex, 16);
    if (!isNaN(code)) decoded += String.fromCharCode(code);
  }
  return decoded;
}

// Format 2: OLD format with colons (reverse + sub1 + hex)
function isOldFormat(content: string): boolean {
  return content.includes(':');
}

function decodeOldFormat(content: string): string {
  const reversed = content.split('').reverse().join('');
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  let decoded = '';
  for (let i = 0; i < adjusted.length; i += 2) {
    const hex = adjusted.substring(i, i + 2);
    const code = parseInt(hex, 16);
    if (!isNaN(code) && code > 0) decoded += String.fromCharCode(code);
  }
  return decoded;
}

// Format 3: Reversed base64 (starts with =)
function isReversedBase64(content: string): boolean {
  return content.startsWith('=');
}

function decodeReversedBase64(content: string): string {
  const reversed = content.split('').reverse().join('');
  return Buffer.from(reversed, 'base64').toString('utf8');
}

// Format 4: Standard base64 with shift
function decodeBase64Shift(content: string, shift: number): string {
  try {
    let data = content.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4 !== 0) data += '=';
    const decoded = Buffer.from(data, 'base64').toString('binary');
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) - shift);
    }
    return result;
  } catch { return ''; }
}

// Smart decode function
function smartDecode(content: string, divId: string): string | null {
  console.log(`\n[SMART DECODE]`);
  console.log(`Content length: ${content.length}`);
  console.log(`First 30 chars: ${content.substring(0, 30)}`);
  
  const uniqueChars = new Set(content).size;
  console.log(`Unique chars: ${uniqueChars}`);
  
  // Try Format 1: Pure HEX
  if (isHexFormat(content)) {
    console.log('Detected: HEX format');
    const decoded = decodeHex(content);
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      return decoded;
    }
    // Try XOR with div ID
    let xorDecoded = '';
    for (let i = 0; i < content.length; i += 2) {
      const hex = content.substring(i, i + 2);
      const byte = parseInt(hex, 16);
      const keyByte = divId.charCodeAt((i / 2) % divId.length);
      xorDecoded += String.fromCharCode(byte ^ keyByte);
    }
    if (xorDecoded.includes('http') || xorDecoded.includes('.m3u8')) {
      console.log('HEX + XOR with divId worked!');
      return xorDecoded;
    }
  }
  
  // Try Format 2: OLD format with colons
  if (isOldFormat(content)) {
    console.log('Detected: OLD format (has colons)');
    const decoded = decodeOldFormat(content);
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      return decoded;
    }
  }
  
  // Try Format 3: Reversed base64
  if (isReversedBase64(content)) {
    console.log('Detected: Reversed base64 (starts with =)');
    try {
      const decoded = decodeReversedBase64(content);
      if (decoded.includes('http') || decoded.includes('.m3u8')) {
        return decoded;
      }
      // Try another layer
      const decoded2 = decodeReversedBase64(decoded);
      if (decoded2.includes('http') || decoded2.includes('.m3u8')) {
        return decoded2;
      }
    } catch {}
  }
  
  // Try Format 4: Base64 with various shifts
  console.log('Trying: Base64 with shifts');
  for (let shift = 0; shift <= 10; shift++) {
    const decoded = decodeBase64Shift(content, shift);
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`Base64 shift ${shift} worked!`);
      return decoded;
    }
  }
  
  // Try reversed + base64 shift
  console.log('Trying: Reversed + Base64 with shifts');
  const reversed = content.split('').reverse().join('');
  for (let shift = 0; shift <= 10; shift++) {
    const decoded = decodeBase64Shift(reversed, shift);
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`Reversed + Base64 shift ${shift} worked!`);
      return decoded;
    }
  }
  
  // Try old format without colons
  console.log('Trying: Old format (no colons)');
  const oldDecoded = decodeOldFormat(content);
  if (oldDecoded.includes('http') || oldDecoded.includes('.m3u8')) {
    return oldDecoded;
  }
  
  return null;
}

async function main() {
  console.log('='.repeat(80));
  console.log('SMART DECODER TEST');
  console.log('='.repeat(80));

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`ATTEMPT ${attempt}`);
    console.log(`${'#'.repeat(60)}`);
    
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedHtml = await fetchPage(embedUrl);
    
    const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
    if (!rcpMatch) { console.error('No RCP'); continue; }
    
    const rcpUrl = 'https://cloudnestra.com/rcp/' + rcpMatch[1];
    const rcpHtml = await fetchPage(rcpUrl, embedUrl);
    
    const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
    if (!prorcpMatch) { console.error('No ProRCP'); continue; }
    
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpMatch[1]}`;
    const prorcpHtml = await fetchPage(prorcpUrl, rcpUrl);
    
    const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) { console.error('No div'); continue; }
    
    const divId = divMatch[1];
    const content = divMatch[2];
    
    console.log(`\nDiv ID: ${divId}`);
    
    const result = smartDecode(content, divId);
    
    if (result) {
      console.log('\n*** DECODE SUCCESS! ***');
      console.log(result.substring(0, 500));
      
      const urls = result.match(/https?:\/\/[^\s"']+/g);
      if (urls) {
        console.log('\nURLs:');
        urls.forEach(url => console.log(`  ${url}`));
      }
    } else {
      console.log('\n*** DECODE FAILED ***');
      console.log('Content preview:', content.substring(0, 100));
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
