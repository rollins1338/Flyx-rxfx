/**
 * Analyze the decoder script from ProRCP page
 * The decoder script decodes the hidden div content - let's reverse engineer it
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

// Deobfuscate common patterns
function deobfuscate(code: string): string {
  // Replace hex escapes
  code = code.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  // Replace unicode escapes
  code = code.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  return code;
}

// Extract string array from obfuscated code
function extractStrings(code: string): string[] {
  const strings: string[] = [];
  
  // Look for string arrays
  const arrayMatch = code.match(/\[['"][^'"\]]{1,50}['"](?:,['"][^'"\]]{1,50}['"])*\]/g);
  if (arrayMatch) {
    for (const arr of arrayMatch) {
      const items = arr.match(/['"]([^'"]+)['"]/g);
      if (items) {
        strings.push(...items.map(s => s.slice(1, -1)));
      }
    }
  }
  
  return strings;
}

async function main() {
  console.log('='.repeat(80));
  console.log('DECODER SCRIPT ANALYSIS');
  console.log('='.repeat(80));

  // Fetch the full chain
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
  
  // Extract the encoded div content
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.error('No encoded div found'); return; }
  
  const divId = divMatch[1];
  const encodedContent = divMatch[2];
  
  console.log(`\nDiv ID: ${divId}`);
  console.log(`Encoded content length: ${encodedContent.length}`);
  console.log(`Content preview: ${encodedContent.substring(0, 100)}...`);
  
  // Extract decoder script URL
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (!scriptMatch) { console.error('No decoder script found'); return; }
  
  const scriptHash = scriptMatch[1];
  const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js`;
  
  console.log(`\nDecoder script hash: ${scriptHash}`);
  console.log(`Decoder script URL: ${scriptUrl}`);
  
  // Fetch decoder script
  const decoderScript = await fetchPage(scriptUrl, prorcpUrl);
  console.log(`\nDecoder script length: ${decoderScript.length}`);
  
  // Save for analysis
  await Bun.write('debug-decoder-full.js', decoderScript);
  
  // Look for key patterns in the decoder
  console.log('\n' + '='.repeat(60));
  console.log('DECODER PATTERN ANALYSIS');
  console.log('='.repeat(60));
  
  // Check for common encoding patterns
  const patterns = {
    'atob': decoderScript.includes('atob'),
    'btoa': decoderScript.includes('btoa'),
    'charCodeAt': decoderScript.includes('charCodeAt'),
    'fromCharCode': decoderScript.includes('fromCharCode'),
    'split': decoderScript.includes('split'),
    'reverse': decoderScript.includes('reverse'),
    'join': decoderScript.includes('join'),
    'substring': decoderScript.includes('substring'),
    'substr': decoderScript.includes('substr'),
    'slice': decoderScript.includes('slice'),
    'replace': decoderScript.includes('replace'),
    'parseInt': decoderScript.includes('parseInt'),
    'toString': decoderScript.includes('toString'),
    'innerHTML': decoderScript.includes('innerHTML'),
    'getElementById': decoderScript.includes('getElementById'),
    'window': decoderScript.includes('window'),
    'document': decoderScript.includes('document'),
    'eval': decoderScript.includes('eval'),
    'Function': decoderScript.includes('Function'),
  };
  
  console.log('\nDetected patterns:');
  for (const [pattern, found] of Object.entries(patterns)) {
    if (found) console.log(`  ✓ ${pattern}`);
  }
  
  // Look for the div ID in the script
  console.log(`\nDiv ID "${divId}" in script: ${decoderScript.includes(divId)}`);
  
  // Extract any visible strings
  const strings = extractStrings(decoderScript);
  const interestingStrings = strings.filter(s => 
    s.length > 5 && 
    !s.match(/^[0-9a-f]+$/i) && 
    !s.match(/^[A-Za-z0-9+\/=]+$/)
  );
  
  if (interestingStrings.length > 0) {
    console.log('\nInteresting strings found:');
    interestingStrings.slice(0, 20).forEach(s => console.log(`  "${s}"`));
  }
  
  // Try to find the decoding function
  console.log('\n' + '='.repeat(60));
  console.log('TRYING TO DECODE THE CONTENT');
  console.log('='.repeat(60));
  
  // The encoded content looks like hex
  if (/^[0-9a-fA-F]+$/.test(encodedContent)) {
    console.log('\nContent is HEX encoded!');
    const hexDecoded = Buffer.from(encodedContent, 'hex').toString('utf8');
    console.log(`Hex decoded: ${hexDecoded.substring(0, 200)}...`);
  }
  
  // Check if it starts with = (reversed base64)
  if (encodedContent.endsWith('=')) {
    console.log('\nContent ends with = (might be base64)');
    const reversed = encodedContent.split('').reverse().join('');
    try {
      const decoded = Buffer.from(reversed, 'base64').toString('utf8');
      console.log(`Reversed base64: ${decoded.substring(0, 200)}...`);
    } catch {}
  }
  
  // Try common decoding patterns
  console.log('\n[Trying common decode patterns]');
  
  // Pattern 1: Hex pairs to chars
  try {
    let decoded = '';
    for (let i = 0; i < encodedContent.length; i += 2) {
      const hex = encodedContent.substring(i, i + 2);
      decoded += String.fromCharCode(parseInt(hex, 16));
    }
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`\n*** HEX DECODE SUCCESS ***`);
      console.log(decoded.substring(0, 500));
    } else {
      console.log(`Hex decode preview: ${decoded.substring(0, 100)}...`);
    }
  } catch {}
  
  // Pattern 2: Reverse + hex
  try {
    const reversed = encodedContent.split('').reverse().join('');
    let decoded = '';
    for (let i = 0; i < reversed.length; i += 2) {
      const hex = reversed.substring(i, i + 2);
      decoded += String.fromCharCode(parseInt(hex, 16));
    }
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`\n*** REVERSE + HEX SUCCESS ***`);
      console.log(decoded.substring(0, 500));
    }
  } catch {}
  
  // Pattern 3: Subtract 1 from each char then hex decode (old format)
  try {
    const reversed = encodedContent.split('').reverse().join('');
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
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`\n*** REVERSE + SUBTRACT + HEX SUCCESS ***`);
      console.log(decoded.substring(0, 500));
    }
  } catch {}
  
  // Pattern 4: XOR with div ID
  try {
    const key = divId;
    let decoded = '';
    for (let i = 0; i < encodedContent.length; i += 2) {
      const hex = encodedContent.substring(i, i + 2);
      const byte = parseInt(hex, 16);
      const keyByte = key.charCodeAt(i / 2 % key.length);
      decoded += String.fromCharCode(byte ^ keyByte);
    }
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`\n*** XOR WITH DIV ID SUCCESS ***`);
      console.log(decoded.substring(0, 500));
    }
  } catch {}
  
  // Look at the PlayerJS initialization
  console.log('\n' + '='.repeat(60));
  console.log('PLAYERJS ANALYSIS');
  console.log('='.repeat(60));
  
  const playerMatch = prorcpHtml.match(/new Playerjs\(\{([^}]+)\}\)/);
  if (playerMatch) {
    console.log('\nPlayerJS config:');
    console.log(playerMatch[0].substring(0, 500));
  }
  
  // The file parameter uses the div ID as a variable
  const fileMatch = prorcpHtml.match(/file:\s*(\w+)/);
  if (fileMatch) {
    console.log(`\nFile variable: ${fileMatch[1]}`);
    console.log(`This variable (${fileMatch[1]}) should contain the decoded stream URL`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  console.log(`
The decoder script (${decoderScript.length} bytes) is heavily obfuscated.
It reads the content from div#${divId} and decodes it.
The decoded result is assigned to window.${divId} and used as the file URL.

To fully decode, we need to either:
1. Execute the decoder script in a sandbox
2. Reverse engineer the obfuscated decoder
3. Use a headless browser

The encoded content format appears to be hex-encoded encrypted data.
`);
}

main().catch(console.error);
