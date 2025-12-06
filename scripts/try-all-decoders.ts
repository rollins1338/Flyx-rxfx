/**
 * Try ALL known decoders on the current content
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

// Custom base64 alphabet (PlayerJS)
const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';

function customBase64Decode(encoded: string): string {
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
    if (!isNaN(code) && code > 0) decoded += String.fromCharCode(code);
  }
  return decoded;
}

function decodeBase64Format(encoded: string, shift: number): string {
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
  } catch { return ''; }
}

function decodePlayerJs(encoded: string): string {
  if (encoded.startsWith('#0')) {
    return customBase64Decode(encoded.substring(2));
  } else if (encoded.startsWith('#1')) {
    return customBase64Decode(encoded.substring(2).replace(/#/g, '+'));
  }
  return '';
}

function decodeRot(encoded: string, shift: number): string {
  let decoded = '';
  for (const char of encoded) {
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      decoded += String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    } else if (code >= 65 && code <= 90) {
      decoded += String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    } else if (code >= 48 && code <= 57) {
      decoded += String.fromCharCode(((code - 48 + shift + 10) % 10) + 48);
    } else {
      decoded += char;
    }
  }
  return decoded;
}

function isValidResult(str: string): boolean {
  return str.includes('https://') || str.includes('http://') || str.includes('.m3u8');
}

async function main() {
  console.log('='.repeat(80));
  console.log('TRYING ALL DECODERS');
  console.log('='.repeat(80));

  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.error('No RCP'); return; }
  
  const rcpUrl = 'https://cloudnestra.com/rcp/' + rcpMatch[1];
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.error('No ProRCP'); return; }
  
  const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpMatch[1]}`;
  const prorcpHtml = await fetchPage(prorcpUrl, rcpUrl);
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.error('No div'); return; }
  
  const divId = divMatch[1];
  const content = divMatch[2];
  
  console.log(`\nDiv ID: ${divId}`);
  console.log(`Content length: ${content.length}`);
  console.log(`First 80 chars: ${content.substring(0, 80)}`);
  
  const results: { name: string; result: string }[] = [];
  
  // 1. Old format (reverse + sub1 + hex)
  const d1 = decodeOldFormat(content);
  if (isValidResult(d1)) results.push({ name: 'Old Format', result: d1 });
  
  // 2. Base64 format with various shifts
  for (let shift = 0; shift <= 10; shift++) {
    const d2 = decodeBase64Format(content, shift);
    if (isValidResult(d2)) results.push({ name: `Base64 shift ${shift}`, result: d2 });
  }
  
  // 3. PlayerJS format
  const d3 = decodePlayerJs(content);
  if (isValidResult(d3)) results.push({ name: 'PlayerJS', result: d3 });
  
  // 4. Custom base64
  const d4 = customBase64Decode(content);
  if (isValidResult(d4)) results.push({ name: 'Custom Base64', result: d4 });
  
  // 5. ROT ciphers
  for (let rot = 1; rot <= 25; rot++) {
    const d5 = decodeRot(content, rot);
    if (isValidResult(d5)) results.push({ name: `ROT${rot}`, result: d5 });
  }
  
  // 6. Standard base64
  try {
    const d6 = Buffer.from(content, 'base64').toString('utf8');
    if (isValidResult(d6)) results.push({ name: 'Standard Base64', result: d6 });
  } catch {}
  
  // 7. Reversed base64
  try {
    const reversed = content.split('').reverse().join('');
    const d7 = Buffer.from(reversed, 'base64').toString('utf8');
    if (isValidResult(d7)) results.push({ name: 'Reversed Base64', result: d7 });
  } catch {}
  
  // 8. Double base64
  try {
    const d8a = Buffer.from(content, 'base64').toString('utf8');
    const d8 = Buffer.from(d8a, 'base64').toString('utf8');
    if (isValidResult(d8)) results.push({ name: 'Double Base64', result: d8 });
  } catch {}
  
  // 9. Reversed + old format
  try {
    const reversed = content.split('').reverse().join('');
    const d9 = decodeOldFormat(reversed);
    if (isValidResult(d9)) results.push({ name: 'Reversed + Old Format', result: d9 });
  } catch {}
  
  // 10. Base64 + old format
  try {
    const b64 = Buffer.from(content, 'base64').toString('utf8');
    const d10 = decodeOldFormat(b64);
    if (isValidResult(d10)) results.push({ name: 'Base64 + Old Format', result: d10 });
  } catch {}
  
  // 11. Try with content that has colons (split and decode parts)
  if (content.includes(':')) {
    const parts = content.split(':');
    for (let i = 0; i < parts.length; i++) {
      const d11 = decodeOldFormat(parts[i]);
      if (isValidResult(d11)) results.push({ name: `Part ${i} Old Format`, result: d11 });
      
      try {
        const d11b = Buffer.from(parts[i], 'base64').toString('utf8');
        if (isValidResult(d11b)) results.push({ name: `Part ${i} Base64`, result: d11b });
      } catch {}
    }
  }
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  
  if (results.length === 0) {
    console.log('\nNo decoder worked!');
    console.log('\nContent analysis:');
    console.log(`  Starts with =: ${content.startsWith('=')}`);
    console.log(`  Ends with =: ${content.endsWith('=')}`);
    console.log(`  Contains colon: ${content.includes(':')}`);
    console.log(`  Starts with #: ${content.startsWith('#')}`);
    
    // Show what each decoder produced (first 50 chars)
    console.log('\nDecoder outputs (first 50 chars):');
    console.log(`  Old Format: ${decodeOldFormat(content).substring(0, 50)}`);
    console.log(`  Base64 shift 3: ${decodeBase64Format(content, 3).substring(0, 50)}`);
    console.log(`  Custom Base64: ${customBase64Decode(content).substring(0, 50)}`);
  } else {
    for (const { name, result } of results) {
      console.log(`\n*** ${name} SUCCESS! ***`);
      console.log(result.substring(0, 500));
      
      // Extract URLs
      const urls = result.match(/https?:\/\/[^\s"']+/g);
      if (urls) {
        console.log('\nURLs found:');
        urls.forEach(url => console.log(`  ${url}`));
      }
    }
  }
}

main().catch(console.error);
