/**
 * CRACK THE VIDSRC DECODER WITHOUT A BROWSER
 * 
 * The flow works without Turnstile! The issue is decoding the content.
 * This script analyzes the encoded content and cracks the algorithm.
 */

const TMDB_ID = '1228246'; // FNAF 2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithHeaders(url: string, referer?: string) {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (referer) {
    headers['Referer'] = referer;
    headers['Origin'] = new URL(referer).origin;
  }
  return fetch(url, { headers });
}

// Custom base64 alphabet used by PlayerJS (shuffled)
const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';
const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function customBase64Decode(encoded: string): string {
  let result = '';
  let i = 0;
  const clean = encoded.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < clean.length) {
    const s = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const o = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const u = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const a = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    
    const n = (s << 2) | (o >> 4);
    const r = ((o & 15) << 4) | (u >> 2);
    const c = ((u & 3) << 6) | a;
    
    result += String.fromCharCode(n);
    if (u !== 64) result += String.fromCharCode(r);
    if (a !== 64) result += String.fromCharCode(c);
  }
  
  return result;
}

function standardBase64Decode(encoded: string): string {
  let clean = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  return Buffer.from(clean, 'base64').toString('binary');
}

function decodeRot(str: string, shift: number): string {
  let decoded = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
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

function xorDecode(data: string, key: string): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function reverseString(str: string): string {
  return str.split('').reverse().join('');
}

function subtractFromChars(str: string, n: number): string {
  return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) - n)).join('');
}

function hexDecode(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (!isNaN(code) && code > 0) {
      result += String.fromCharCode(code);
    }
  }
  return result;
}

function looksLikeUrl(str: string): boolean {
  return str.includes('https://') || str.includes('http://') || str.includes('.m3u8');
}

function looksLikePrintable(str: string): boolean {
  let printable = 0;
  for (let i = 0; i < Math.min(str.length, 100); i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) printable++;
  }
  return printable / Math.min(str.length, 100) > 0.8;
}

async function analyzeDecoderScript(scriptContent: string): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('DECODER SCRIPT ANALYSIS');
  console.log('='.repeat(70));
  
  // Look for string literals that might be keys or alphabets
  const stringLiterals = scriptContent.match(/'[^']{10,}'/g) || [];
  console.log(`\nFound ${stringLiterals.length} string literals (10+ chars)`);
  
  // Look for base64-like patterns
  const base64Patterns = stringLiterals.filter(s => /^'[A-Za-z0-9+/=]{20,}'$/.test(s));
  console.log(`Base64-like strings: ${base64Patterns.length}`);
  base64Patterns.slice(0, 5).forEach(s => console.log(`  ${s.substring(0, 60)}...`));
  
  // Look for atob/btoa usage
  const atobCount = (scriptContent.match(/atob/g) || []).length;
  const btoaCount = (scriptContent.match(/btoa/g) || []).length;
  console.log(`\natob calls: ${atobCount}, btoa calls: ${btoaCount}`);
  
  // Look for charCodeAt usage (common in decoders)
  const charCodeAtCount = (scriptContent.match(/charCodeAt/g) || []).length;
  const fromCharCodeCount = (scriptContent.match(/fromCharCode/g) || []).length;
  console.log(`charCodeAt: ${charCodeAtCount}, fromCharCode: ${fromCharCodeCount}`);
  
  // Look for XOR operations
  const xorCount = (scriptContent.match(/\^/g) || []).length;
  console.log(`XOR operations (^): ${xorCount}`);
  
  // Look for reverse operations
  const reverseCount = (scriptContent.match(/reverse/g) || []).length;
  console.log(`reverse() calls: ${reverseCount}`);
  
  // Look for split/join patterns
  const splitCount = (scriptContent.match(/split/g) || []).length;
  const joinCount = (scriptContent.match(/join/g) || []).length;
  console.log(`split: ${splitCount}, join: ${joinCount}`);
  
  // Look for innerHTML access (where decoded content goes)
  const innerHTMLCount = (scriptContent.match(/innerHTML/g) || []).length;
  console.log(`innerHTML access: ${innerHTMLCount}`);
  
  // Look for getElementById (to find the div)
  const getElementCount = (scriptContent.match(/getElementById/g) || []).length;
  console.log(`getElementById: ${getElementCount}`);
}

async function tryAllDecoders(divId: string, content: string): Promise<string | null> {
  console.log('\n' + '='.repeat(70));
  console.log('TRYING ALL DECODERS');
  console.log('='.repeat(70));
  console.log(`Div ID: ${divId}`);
  console.log(`Content length: ${content.length}`);
  console.log(`Content preview: ${content.substring(0, 80)}...`);
  
  // Check content characteristics
  const hasEquals = content.includes('=');
  const hasPlus = content.includes('+');
  const hasSlash = content.includes('/');
  const hasDash = content.includes('-');
  const hasUnderscore = content.includes('_');
  const hasColon = content.includes(':');
  const startsWithHash = content.startsWith('#');
  const startsWithEquals = content.startsWith('=');
  
  console.log(`\nContent characteristics:`);
  console.log(`  Has =: ${hasEquals}, Has +: ${hasPlus}, Has /: ${hasSlash}`);
  console.log(`  Has -: ${hasDash}, Has _: ${hasUnderscore}, Has :: ${hasColon}`);
  console.log(`  Starts with #: ${startsWithHash}, Starts with =: ${startsWithEquals}`);
  
  // Try 1: ROT3 (eqqmp:// -> https://)
  console.log('\n[1] Trying ROT3 decode...');
  for (let shift = 1; shift <= 25; shift++) {
    const decoded = decodeRot(content, shift);
    if (looksLikeUrl(decoded)) {
      console.log(`*** ROT${shift} SUCCESS! ***`);
      console.log(decoded.substring(0, 200));
      return decoded;
    }
  }
  
  // Try 2: Standard base64
  console.log('\n[2] Trying standard base64...');
  try {
    const decoded = standardBase64Decode(content);
    if (looksLikeUrl(decoded)) {
      console.log('*** Standard base64 SUCCESS! ***');
      console.log(decoded.substring(0, 200));
      return decoded;
    }
    if (looksLikePrintable(decoded)) {
      console.log(`Printable result: ${decoded.substring(0, 100)}`);
    }
  } catch (e) {
    console.log('Standard base64 failed');
  }
  
  // Try 3: Custom base64 (PlayerJS alphabet)
  console.log('\n[3] Trying custom base64 (PlayerJS)...');
  try {
    const decoded = customBase64Decode(content);
    if (looksLikeUrl(decoded)) {
      console.log('*** Custom base64 SUCCESS! ***');
      console.log(decoded.substring(0, 200));
      return decoded;
    }
    if (looksLikePrintable(decoded)) {
      console.log(`Printable result: ${decoded.substring(0, 100)}`);
    }
  } catch (e) {
    console.log('Custom base64 failed');
  }
  
  // Try 4: Reverse + base64
  console.log('\n[4] Trying reverse + base64...');
  try {
    const reversed = reverseString(content);
    const decoded = standardBase64Decode(reversed);
    if (looksLikeUrl(decoded)) {
      console.log('*** Reverse + base64 SUCCESS! ***');
      console.log(decoded.substring(0, 200));
      return decoded;
    }
    if (looksLikePrintable(decoded)) {
      console.log(`Printable result: ${decoded.substring(0, 100)}`);
    }
  } catch (e) {
    console.log('Reverse + base64 failed');
  }
  
  // Try 5: Strip prefix + reverse + base64 + subtract
  console.log('\n[5] Trying strip prefix + reverse + base64 + subtract...');
  for (let prefixLen = 0; prefixLen <= 2; prefixLen++) {
    for (let shift = 0; shift <= 10; shift++) {
      try {
        let data = content.substring(prefixLen);
        data = reverseString(data);
        data = data.replace(/-/g, '+').replace(/_/g, '/');
        while (data.length % 4 !== 0) data += '=';
        const decoded = Buffer.from(data, 'base64').toString('binary');
        const shifted = subtractFromChars(decoded, shift);
        if (looksLikeUrl(shifted)) {
          console.log(`*** Strip ${prefixLen} + reverse + base64 + subtract ${shift} SUCCESS! ***`);
          console.log(shifted.substring(0, 200));
          return shifted;
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  // Try 6: Hex decode
  console.log('\n[6] Trying hex decode...');
  if (/^[0-9a-fA-F]+$/.test(content.replace(/[:\s]/g, ''))) {
    const hexClean = content.replace(/[:\s]/g, '');
    const decoded = hexDecode(hexClean);
    if (looksLikeUrl(decoded)) {
      console.log('*** Hex decode SUCCESS! ***');
      console.log(decoded.substring(0, 200));
      return decoded;
    }
    if (looksLikePrintable(decoded)) {
      console.log(`Printable result: ${decoded.substring(0, 100)}`);
    }
  }
  
  // Try 7: Reverse + subtract + hex
  console.log('\n[7] Trying reverse + subtract + hex...');
  for (let shift = 0; shift <= 5; shift++) {
    const reversed = reverseString(content);
    const shifted = subtractFromChars(reversed, shift);
    const hexClean = shifted.replace(/[^0-9a-fA-F]/g, '');
    if (hexClean.length > 10) {
      const decoded = hexDecode(hexClean);
      if (looksLikeUrl(decoded)) {
        console.log(`*** Reverse + subtract ${shift} + hex SUCCESS! ***`);
        console.log(decoded.substring(0, 200));
        return decoded;
      }
    }
  }
  
  // Try 8: XOR with common keys
  console.log('\n[8] Trying XOR with common keys...');
  const xorKeys = [divId, 'cloudnestra', 'vidsrc', 'prorcp', 'srcrcp', TMDB_ID, '123456'];
  for (const key of xorKeys) {
    // Try XOR on raw content
    const decoded = xorDecode(content, key);
    if (looksLikeUrl(decoded)) {
      console.log(`*** XOR with "${key}" SUCCESS! ***`);
      console.log(decoded.substring(0, 200));
      return decoded;
    }
    
    // Try XOR on base64 decoded content
    try {
      const b64decoded = standardBase64Decode(content);
      const xored = xorDecode(b64decoded, key);
      if (looksLikeUrl(xored)) {
        console.log(`*** Base64 + XOR with "${key}" SUCCESS! ***`);
        console.log(xored.substring(0, 200));
        return xored;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Try 9: Double base64
  console.log('\n[9] Trying double base64...');
  try {
    const first = standardBase64Decode(content);
    const second = standardBase64Decode(first);
    if (looksLikeUrl(second)) {
      console.log('*** Double base64 SUCCESS! ***');
      console.log(second.substring(0, 200));
      return second;
    }
  } catch (e) {
    console.log('Double base64 failed');
  }
  
  // Try 10: PlayerJS format (#0 or #1 prefix)
  console.log('\n[10] Trying PlayerJS format...');
  if (content.startsWith('#0') || content.startsWith('#1')) {
    const data = content.substring(2).replace(/#/g, '+');
    try {
      const decoded = customBase64Decode(data);
      if (looksLikeUrl(decoded)) {
        console.log('*** PlayerJS format SUCCESS! ***');
        console.log(decoded.substring(0, 200));
        return decoded;
      }
    } catch (e) {
      console.log('PlayerJS format failed');
    }
  }
  
  console.log('\n*** ALL DECODERS FAILED ***');
  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('CRACKING VIDSRC DECODER - NO BROWSER NEEDED');
  console.log('='.repeat(70));
  
  // Step 1: Fetch embed page
  console.log('\n[Step 1] Fetching vidsrc-embed.ru...');
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedRes = await fetchWithHeaders(embedUrl);
  const embedHtml = await embedRes.text();
  console.log(`Status: ${embedRes.status}, Length: ${embedHtml.length}`);
  
  // Step 2: Extract RCP hash
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) {
    console.error('No RCP found!');
    return;
  }
  console.log(`RCP hash found (${rcpMatch[1].length} chars)`);
  
  // Step 3: Fetch RCP page
  console.log('\n[Step 2] Fetching cloudnestra.com RCP...');
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpMatch[1]}`;
  const rcpRes = await fetchWithHeaders(rcpUrl, embedUrl);
  const rcpHtml = await rcpRes.text();
  console.log(`Status: ${rcpRes.status}, Length: ${rcpHtml.length}`);
  
  // Check for Turnstile
  const hasTurnstile = rcpHtml.includes('turnstile') || rcpHtml.includes('cf-turnstile');
  console.log(`Turnstile: ${hasTurnstile ? 'YES - BLOCKED!' : 'NO - GOOD!'}`);
  
  if (hasTurnstile) {
    console.error('\n*** TURNSTILE DETECTED - Cannot proceed without browser ***');
    await Bun.write('debug-turnstile-rcp.html', rcpHtml);
    return;
  }
  
  // Step 4: Extract ProRCP/SrcRCP
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  const endpointType = prorcpMatch ? 'prorcp' : 'srcrcp';
  const endpointHash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch?.[1];
  
  if (!endpointHash) {
    console.error('No ProRCP/SrcRCP found!');
    await Bun.write('debug-no-prorcp.html', rcpHtml);
    return;
  }
  console.log(`${endpointType.toUpperCase()} hash found (${endpointHash.length} chars)`);
  
  // Step 5: Fetch ProRCP/SrcRCP page
  console.log(`\n[Step 3] Fetching cloudnestra.com ${endpointType}...`);
  const prorcpUrl = `https://cloudnestra.com/${endpointType}/${endpointHash}`;
  const prorcpRes = await fetchWithHeaders(prorcpUrl, rcpUrl);
  const prorcpHtml = await prorcpRes.text();
  console.log(`Status: ${prorcpRes.status}, Length: ${prorcpHtml.length}`);
  
  // Step 6: Extract encoded div
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) {
    console.error('No encoded div found!');
    await Bun.write('debug-no-div.html', prorcpHtml);
    return;
  }
  
  const divId = divMatch[1];
  const encodedContent = divMatch[2];
  console.log(`\nDiv ID: ${divId}`);
  console.log(`Encoded content length: ${encodedContent.length}`);
  
  // Save for analysis
  await Bun.write('debug-encoded-content.txt', encodedContent);
  
  // Step 7: Extract and analyze decoder script
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (scriptMatch) {
    console.log(`\n[Step 4] Fetching decoder script...`);
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptMatch[1]}.js`;
    const scriptRes = await fetchWithHeaders(scriptUrl, prorcpUrl);
    const scriptContent = await scriptRes.text();
    console.log(`Decoder script length: ${scriptContent.length}`);
    
    await Bun.write('debug-decoder-script.js', scriptContent);
    await analyzeDecoderScript(scriptContent);
  }
  
  // Step 8: Try all decoders
  const decoded = await tryAllDecoders(divId, encodedContent);
  
  if (decoded) {
    console.log('\n' + '='.repeat(70));
    console.log('SUCCESS! DECODED CONTENT:');
    console.log('='.repeat(70));
    console.log(decoded);
    
    // Extract m3u8 URLs
    const urls = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    console.log(`\nFound ${urls.length} m3u8 URLs:`);
    urls.forEach((url, i) => console.log(`  [${i + 1}] ${url}`));
    
    await Bun.write('debug-decoded-content.txt', decoded);
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('FAILED TO DECODE - Need to analyze the decoder script');
    console.log('='.repeat(70));
    console.log('\nSaved files for analysis:');
    console.log('  - debug-encoded-content.txt');
    console.log('  - debug-decoder-script.js');
  }
}

main().catch(console.error);
