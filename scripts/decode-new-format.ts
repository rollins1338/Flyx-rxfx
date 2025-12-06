/**
 * Decode the new format: 7gnNwFzd2x2byADR...
 * This looks like base64 but might be modified
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

async function main() {
  console.log('='.repeat(80));
  console.log('DECODING NEW FORMAT');
  console.log('='.repeat(80));

  // Fetch fresh data
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.error('No RCP'); return; }
  
  let rcpUrl = 'https://cloudnestra.com/rcp/' + rcpMatch[1];
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
  console.log(`First 100: ${content.substring(0, 100)}`);
  console.log(`Last 50: ${content.substring(content.length - 50)}`);
  
  // Analyze the content
  console.log('\n[CHARACTER ANALYSIS]');
  const chars = new Set(content);
  console.log(`Unique chars: ${chars.size}`);
  console.log(`Chars: ${[...chars].sort().join('')}`);
  
  // Check if it's base64
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(content);
  console.log(`Is standard base64: ${isBase64}`);
  
  // Try various decoding methods
  console.log('\n[DECODING ATTEMPTS]');
  
  // 1. Standard base64
  try {
    const d1 = Buffer.from(content, 'base64').toString('utf8');
    console.log(`\n1. Standard base64: ${d1.substring(0, 100)}...`);
    if (d1.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('1. Standard base64 failed');
  }
  
  // 2. Reversed then base64
  try {
    const reversed = content.split('').reverse().join('');
    const d2 = Buffer.from(reversed, 'base64').toString('utf8');
    console.log(`\n2. Reversed base64: ${d2.substring(0, 100)}...`);
    if (d2.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('2. Reversed base64 failed');
  }
  
  // 3. Base64 then reverse the result
  try {
    const decoded = Buffer.from(content, 'base64').toString('utf8');
    const d3 = decoded.split('').reverse().join('');
    console.log(`\n3. Base64 then reverse: ${d3.substring(0, 100)}...`);
    if (d3.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('3. Base64 then reverse failed');
  }
  
  // 4. URL-safe base64
  try {
    const urlSafe = content.replace(/-/g, '+').replace(/_/g, '/');
    const d4 = Buffer.from(urlSafe, 'base64').toString('utf8');
    console.log(`\n4. URL-safe base64: ${d4.substring(0, 100)}...`);
    if (d4.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('4. URL-safe base64 failed');
  }
  
  // 5. Custom alphabet base64 (shuffled)
  const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';
  const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  
  try {
    let translated = '';
    for (const c of content) {
      const idx = CUSTOM_ALPHABET.indexOf(c);
      translated += idx >= 0 ? STANDARD_ALPHABET[idx] : c;
    }
    const d5 = Buffer.from(translated, 'base64').toString('utf8');
    console.log(`\n5. Custom alphabet: ${d5.substring(0, 100)}...`);
    if (d5.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('5. Custom alphabet failed');
  }
  
  // 6. Reverse custom alphabet
  try {
    let translated = '';
    for (const c of content) {
      const idx = STANDARD_ALPHABET.indexOf(c);
      translated += idx >= 0 ? CUSTOM_ALPHABET[idx] : c;
    }
    const d6 = Buffer.from(translated, 'base64').toString('utf8');
    console.log(`\n6. Reverse custom alphabet: ${d6.substring(0, 100)}...`);
    if (d6.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('6. Reverse custom alphabet failed');
  }
  
  // 7. XOR with div ID after base64
  try {
    const decoded = Buffer.from(content, 'base64');
    const key = Buffer.from(divId);
    const xored = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      xored[i] = decoded[i] ^ key[i % key.length];
    }
    const d7 = xored.toString('utf8');
    console.log(`\n7. Base64 + XOR with divId: ${d7.substring(0, 100)}...`);
    if (d7.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('7. Base64 + XOR failed');
  }
  
  // 8. Double base64
  try {
    const d8a = Buffer.from(content, 'base64').toString('utf8');
    const d8 = Buffer.from(d8a, 'base64').toString('utf8');
    console.log(`\n8. Double base64: ${d8.substring(0, 100)}...`);
    if (d8.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('8. Double base64 failed');
  }
  
  // 9. Reverse string then double base64
  try {
    const reversed = content.split('').reverse().join('');
    const d9a = Buffer.from(reversed, 'base64').toString('utf8');
    const d9 = Buffer.from(d9a, 'base64').toString('utf8');
    console.log(`\n9. Reverse + double base64: ${d9.substring(0, 100)}...`);
    if (d9.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch (e) {
    console.log('9. Reverse + double base64 failed');
  }
  
  // 10. Check if it's the old hex format with colons
  if (content.includes(':')) {
    console.log('\n10. Content contains colons - might be old format');
    const parts = content.split(':');
    console.log(`Parts: ${parts.length}`);
    
    // Try decoding each part
    for (let i = 0; i < Math.min(parts.length, 3); i++) {
      try {
        const decoded = Buffer.from(parts[i], 'base64').toString('utf8');
        console.log(`Part ${i}: ${decoded.substring(0, 50)}...`);
      } catch {}
    }
  }
  
  // 11. Try the old format decoder anyway
  console.log('\n11. Old format (reverse + sub1 + hex):');
  const reversed = content.split('').reverse().join('');
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  let hexDecoded = '';
  for (let i = 0; i < adjusted.length; i += 2) {
    const hex = adjusted.substring(i, i + 2);
    const code = parseInt(hex, 16);
    if (!isNaN(code) && code > 0) {
      hexDecoded += String.fromCharCode(code);
    }
  }
  console.log(`Result: ${hexDecoded.substring(0, 100)}...`);
  if (hexDecoded.includes('http')) console.log('*** CONTAINS HTTP! ***');
  
  // 12. Try base64 decode then old format
  try {
    const b64decoded = Buffer.from(content, 'base64').toString('utf8');
    const reversed = b64decoded.split('').reverse().join('');
    let adjusted = '';
    for (let i = 0; i < reversed.length; i++) {
      adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
    }
    let hexDecoded = '';
    for (let i = 0; i < adjusted.length; i += 2) {
      const hex = adjusted.substring(i, i + 2);
      const code = parseInt(hex, 16);
      if (!isNaN(code) && code > 0) {
        hexDecoded += String.fromCharCode(code);
      }
    }
    console.log(`\n12. Base64 + old format: ${hexDecoded.substring(0, 100)}...`);
    if (hexDecoded.includes('http')) console.log('*** CONTAINS HTTP! ***');
  } catch {}
  
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
