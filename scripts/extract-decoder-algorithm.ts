/**
 * Extract and analyze the decoder algorithm from the obfuscated script
 * We need to find the actual decoding function
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

// Try to execute the decoder in a sandboxed way
function tryExecuteDecoder(decoderScript: string, divId: string, encodedContent: string): string | null {
  try {
    // Create a mock window and document
    const mockWindow: Record<string, unknown> = {};
    const mockDocument = {
      getElementById: (id: string) => {
        if (id === divId) {
          return { innerHTML: encodedContent };
        }
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    
    // Custom atob/btoa
    const customAtob = (str: string): string => {
      return Buffer.from(str, 'base64').toString('binary');
    };
    
    const customBtoa = (str: string): string => {
      return Buffer.from(str, 'binary').toString('base64');
    };
    
    // Try to execute
    const fn = new Function(
      'window',
      'document',
      'atob',
      'btoa',
      'console',
      decoderScript + `; return window['${divId}'] || window.file || '';`
    );
    
    const result = fn(mockWindow, mockDocument, customAtob, customBtoa, console);
    
    if (typeof result === 'string' && result.length > 0) {
      return result;
    }
    
    // Check if result was stored in window
    for (const key of Object.keys(mockWindow)) {
      const value = mockWindow[key];
      if (typeof value === 'string' && (value.includes('http') || value.includes('.m3u8'))) {
        return value;
      }
    }
    
    return null;
  } catch (e) {
    console.log(`Execution error: ${e}`);
    return null;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('DECODER ALGORITHM EXTRACTION');
  console.log('='.repeat(80));

  // Fetch the full chain
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
  
  // Get div content
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.error('No div'); return; }
  
  const divId = divMatch[1];
  const encodedContent = divMatch[2];
  
  console.log(`\nDiv ID: ${divId}`);
  console.log(`Content length: ${encodedContent.length}`);
  
  // Get decoder script
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (!scriptMatch) { console.error('No decoder script'); return; }
  
  const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptMatch[1]}.js`;
  console.log(`\nDecoder script: ${scriptUrl}`);
  
  const decoderScript = await fetchPage(scriptUrl, prorcpUrl);
  console.log(`Script length: ${decoderScript.length}`);
  
  // Save the script
  await Bun.write('debug-decoder-latest.js', decoderScript);
  
  // Look for key patterns in the script
  console.log('\n[SEARCHING FOR DECODING PATTERNS]');
  
  // Look for the div ID reference
  const divIdPattern = new RegExp(`['"]${divId}['"]`, 'g');
  const divIdMatches = decoderScript.match(divIdPattern);
  console.log(`Div ID references: ${divIdMatches?.length || 0}`);
  
  // Look for innerHTML access
  const innerHtmlMatches = decoderScript.match(/innerHTML/g);
  console.log(`innerHTML references: ${innerHtmlMatches?.length || 0}`);
  
  // Look for string manipulation functions
  const patterns = [
    { name: 'split', regex: /\.split\s*\(/g },
    { name: 'reverse', regex: /\.reverse\s*\(/g },
    { name: 'join', regex: /\.join\s*\(/g },
    { name: 'charCodeAt', regex: /\.charCodeAt\s*\(/g },
    { name: 'fromCharCode', regex: /fromCharCode/g },
    { name: 'substring', regex: /\.substring\s*\(/g },
    { name: 'substr', regex: /\.substr\s*\(/g },
    { name: 'slice', regex: /\.slice\s*\(/g },
    { name: 'replace', regex: /\.replace\s*\(/g },
    { name: 'atob', regex: /\batob\s*\(/g },
    { name: 'btoa', regex: /\bbtoa\s*\(/g },
    { name: 'parseInt', regex: /parseInt\s*\(/g },
    { name: 'toString', regex: /\.toString\s*\(/g },
  ];
  
  for (const { name, regex } of patterns) {
    const matches = decoderScript.match(regex);
    if (matches && matches.length > 0) {
      console.log(`  ${name}: ${matches.length} occurrences`);
    }
  }
  
  // Try to find the actual decoding logic by looking for common patterns
  console.log('\n[LOOKING FOR DECODING LOGIC]');
  
  // Pattern: reverse().join('')
  if (decoderScript.includes('reverse') && decoderScript.includes('join')) {
    console.log('Found: reverse + join pattern');
  }
  
  // Pattern: charCodeAt - N
  const charCodeSubtract = decoderScript.match(/charCodeAt[^)]+\)\s*-\s*(\d+)/g);
  if (charCodeSubtract) {
    console.log(`Found: charCodeAt subtraction patterns: ${charCodeSubtract.slice(0, 3).join(', ')}`);
  }
  
  // Pattern: parseInt(x, 16) - hex parsing
  if (decoderScript.includes('parseInt') && decoderScript.includes('16')) {
    console.log('Found: hex parsing (parseInt with base 16)');
  }
  
  // Try to execute the decoder
  console.log('\n[ATTEMPTING EXECUTION]');
  const result = tryExecuteDecoder(decoderScript, divId, encodedContent);
  
  if (result) {
    console.log('\n*** DECODER EXECUTION SUCCESS! ***');
    console.log(`Result: ${result.substring(0, 500)}`);
    
    // Extract URLs
    const urls = result.match(/https?:\/\/[^\s"']+/g);
    if (urls) {
      console.log('\nExtracted URLs:');
      urls.forEach(url => console.log(`  ${url}`));
    }
  } else {
    console.log('Decoder execution failed');
    
    // Try a simpler approach - look for the decoding function
    console.log('\n[TRYING MANUAL DECODE]');
    
    // The script likely does something like:
    // 1. Get innerHTML of div
    // 2. Reverse it
    // 3. Decode base64
    // 4. Apply some transformation
    
    // Try: reverse -> base64
    try {
      const reversed = encodedContent.split('').reverse().join('');
      const decoded = Buffer.from(reversed, 'base64').toString('utf8');
      console.log(`Reverse + base64: ${decoded.substring(0, 100)}...`);
      
      if (decoded.includes('http')) {
        console.log('*** FOUND URL! ***');
      }
    } catch {}
    
    // Try: base64 -> reverse
    try {
      const decoded = Buffer.from(encodedContent, 'base64').toString('utf8');
      const reversed = decoded.split('').reverse().join('');
      console.log(`Base64 + reverse: ${reversed.substring(0, 100)}...`);
      
      if (reversed.includes('http')) {
        console.log('*** FOUND URL! ***');
      }
    } catch {}
  }
  
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
