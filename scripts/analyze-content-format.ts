/**
 * Analyze the exact format of the encoded content
 * The format seems to vary - need to detect and handle each type
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

// Decoder 1: Reverse + Subtract 1 + Hex (old format)
function decodeOldFormat(encoded: string): string {
  const reversed = encoded.split('').reverse().join('');
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
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

// Decoder 2: Custom base64 with shuffled alphabet
function decodeCustomBase64(encoded: string): string {
  const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';
  
  let result = '';
  let i = 0;
  const clean = encoded.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < clean.length) {
    const s = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const o = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const u = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const a = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    
    if (s < 0 || o < 0) continue;
    
    const n = (s << 2) | (o >> 4);
    const r = ((o & 15) << 4) | (u >> 2);
    const c = ((u & 3) << 6) | a;
    
    result += String.fromCharCode(n);
    if (u !== 64) result += String.fromCharCode(r);
    if (a !== 64) result += String.fromCharCode(c);
  }
  
  return result;
}

// Decoder 3: ROT3 (for eqqmp:// format)
function decodeRot3(encoded: string): string {
  let decoded = '';
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      decoded += String.fromCharCode(((code - 97 + 3) % 26) + 97);
    } else if (code >= 65 && code <= 90) {
      decoded += String.fromCharCode(((code - 65 + 3) % 26) + 65);
    } else if (code >= 48 && code <= 57) {
      decoded += String.fromCharCode(((code - 48 + 3) % 10) + 48);
    } else {
      decoded += char;
    }
  }
  return decoded;
}

// Decoder 4: Base64 with shift
function decodeBase64Shift(encoded: string, shift: number): string {
  try {
    let data = encoded.startsWith('=') ? encoded.substring(1) : encoded;
    data = data.split('').reverse().join('');
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4 !== 0) data += '=';
    
    const decoded = Buffer.from(data, 'base64').toString('binary');
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) - shift);
    }
    return result;
  } catch {
    return '';
  }
}

// Decoder 5: PlayerJS #0/#1 format
function decodePlayerJs(encoded: string): string {
  if (encoded.startsWith('#0')) {
    return decodeCustomBase64(encoded.substring(2));
  } else if (encoded.startsWith('#1')) {
    let data = encoded.substring(2).replace(/#/g, '+');
    return decodeCustomBase64(data);
  }
  return '';
}

// Decoder 6: Simple hex XOR
function decodeHexXor(encoded: string, key: string): string {
  let decoded = '';
  for (let i = 0; i < encoded.length; i += 2) {
    const hex = encoded.substring(i, i + 2);
    const byte = parseInt(hex, 16);
    if (!isNaN(byte)) {
      const keyByte = key.charCodeAt((i / 2) % key.length);
      decoded += String.fromCharCode(byte ^ keyByte);
    }
  }
  return decoded;
}

async function main() {
  console.log('='.repeat(80));
  console.log('CONTENT FORMAT ANALYSIS');
  console.log('='.repeat(80));

  // Fetch multiple times to see different formats
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`ATTEMPT ${attempt}`);
    console.log(`${'#'.repeat(60)}`);
    
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedHtml = await fetchPage(embedUrl);
    
    const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
    if (!rcpMatch) { console.error('No RCP found'); continue; }
    
    const rcpHash = rcpMatch[1];
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
    const rcpHtml = await fetchPage(rcpUrl, embedUrl);
    
    const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
    if (!prorcpMatch) { console.error('No ProRCP found'); continue; }
    
    const prorcpHash = prorcpMatch[1];
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
    const prorcpHtml = await fetchPage(prorcpUrl, rcpUrl);
    
    // Get the encoded div content
    const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) { console.error('No div found'); continue; }
    
    const divId = divMatch[1];
    const content = divMatch[2];
    
    console.log(`\nDiv ID: ${divId}`);
    console.log(`Content length: ${content.length}`);
    console.log(`First 100 chars: ${content.substring(0, 100)}`);
    console.log(`Last 50 chars: ${content.substring(content.length - 50)}`);
    
    // Analyze content format
    console.log('\n[FORMAT DETECTION]');
    
    const startsWithHash = content.startsWith('#');
    const startsWithEqual = content.startsWith('=');
    const endsWithEqual = content.endsWith('=');
    const containsColon = content.includes(':');
    const isHexLike = /^[0-9a-fA-F:]+$/.test(content.replace(/[^0-9a-fA-F:]/g, '').substring(0, 100));
    const isBase64Like = /^[A-Za-z0-9+/=]+$/.test(content.substring(0, 100));
    
    console.log(`Starts with #: ${startsWithHash}`);
    console.log(`Starts with =: ${startsWithEqual}`);
    console.log(`Ends with =: ${endsWithEqual}`);
    console.log(`Contains colon: ${containsColon}`);
    console.log(`Looks like hex: ${isHexLike}`);
    console.log(`Looks like base64: ${isBase64Like}`);
    
    // Try all decoders
    console.log('\n[TRYING ALL DECODERS]');
    
    // Decoder 1: Old format
    const d1 = decodeOldFormat(content);
    if (d1.includes('http') || d1.includes('.m3u8')) {
      console.log('\n*** OLD FORMAT (reverse+sub1+hex) SUCCESS ***');
      console.log(d1.substring(0, 400));
    }
    
    // Decoder 2: Custom base64
    const d2 = decodeCustomBase64(content);
    if (d2.includes('http') || d2.includes('.m3u8')) {
      console.log('\n*** CUSTOM BASE64 SUCCESS ***');
      console.log(d2.substring(0, 400));
    }
    
    // Decoder 3: ROT3
    const d3 = decodeRot3(content);
    if (d3.includes('http') || d3.includes('.m3u8')) {
      console.log('\n*** ROT3 SUCCESS ***');
      console.log(d3.substring(0, 400));
    }
    
    // Decoder 4: Base64 with shift
    for (let shift = 0; shift <= 10; shift++) {
      const d4 = decodeBase64Shift(content, shift);
      if (d4.includes('http') || d4.includes('.m3u8')) {
        console.log(`\n*** BASE64 SHIFT ${shift} SUCCESS ***`);
        console.log(d4.substring(0, 400));
        break;
      }
    }
    
    // Decoder 5: PlayerJS
    if (startsWithHash) {
      const d5 = decodePlayerJs(content);
      if (d5.includes('http') || d5.includes('.m3u8')) {
        console.log('\n*** PLAYERJS FORMAT SUCCESS ***');
        console.log(d5.substring(0, 400));
      }
    }
    
    // Decoder 6: Hex XOR with div ID
    if (isHexLike) {
      const d6 = decodeHexXor(content.replace(/:/g, ''), divId);
      if (d6.includes('http') || d6.includes('.m3u8')) {
        console.log('\n*** HEX XOR SUCCESS ***');
        console.log(d6.substring(0, 400));
      }
    }
    
    // Try standard base64
    try {
      const d7 = Buffer.from(content, 'base64').toString('utf8');
      if (d7.includes('http') || d7.includes('.m3u8')) {
        console.log('\n*** STANDARD BASE64 SUCCESS ***');
        console.log(d7.substring(0, 400));
      }
    } catch {}
    
    // Try reversed base64
    try {
      const reversed = content.split('').reverse().join('');
      const d8 = Buffer.from(reversed, 'base64').toString('utf8');
      if (d8.includes('http') || d8.includes('.m3u8')) {
        console.log('\n*** REVERSED BASE64 SUCCESS ***');
        console.log(d8.substring(0, 400));
      }
    } catch {}
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
