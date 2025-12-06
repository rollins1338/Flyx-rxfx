/**
 * Test VidSrc extractor with multiple movies/shows
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchWithHeaders(url: string, referer?: string) {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  if (referer) {
    headers['Referer'] = referer;
    headers['Origin'] = new URL(referer).origin;
  }
  return fetch(url, { headers });
}

/**
 * HEX Format Decoder - MAIN DECODER
 */
/**
 * ROT3 Decoder - for content starting with "eqqmp://"
 * Only letters are shifted, NOT numbers!
 */
function decodeRot3(encoded: string): string {
  let decoded = '';
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      decoded += String.fromCharCode(((code - 97 + 3) % 26) + 97);
    } else if (code >= 65 && code <= 90) {
      decoded += String.fromCharCode(((code - 65 + 3) % 26) + 65);
    } else {
      decoded += char;
    }
  }
  return decoded;
}

function decodeHexFormat(encoded: string): string {
  const reversed = encoded.split('').reverse().join('');
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  const hexClean = adjusted.replace(/[^0-9a-fA-F]/g, '');
  let decoded = '';
  for (let i = 0; i < hexClean.length; i += 2) {
    const hexPair = hexClean.substring(i, i + 2);
    const charCode = parseInt(hexPair, 16);
    if (!isNaN(charCode) && charCode > 0) {
      decoded += String.fromCharCode(charCode);
    }
  }
  return decoded;
}

/**
 * BASE64 Format Decoder
 */
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
  } catch {
    return '';
  }
}

function staticDecode(content: string): string | null {
  // Try ROT3 format first (content starts with "eqqmp://")
  if (content.startsWith('eqqmp://')) {
    const decoded = decodeRot3(content);
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return decoded;
    }
  }
  
  // Try REVERSED BASE64 format (content starts with "==" or "=")
  if (content.startsWith('==') || content.startsWith('=')) {
    for (const shift of [3, 5, 7, 1, 2, 4, 6]) {
      const decoded = decodeBase64Format(content, shift);
      if (decoded.includes('https://') && decoded.includes('.m3u8')) {
        return decoded;
      }
    }
  }
  
  // Try HEX format (reverse + subtract 1 + hex)
  if (content.includes(':') || /^[0-9a-f]{10,}/i.test(content.substring(0, 80))) {
    const decoded = decodeHexFormat(content);
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return decoded;
    }
  }
  
  // Try BASE64 with different shifts (fallback)
  for (const shift of [3, 5, 7, 1, 2, 4, 6]) {
    const decoded = decodeBase64Format(content, shift);
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return decoded;
    }
  }
  
  return null;
}

interface TestCase {
  name: string;
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

const testCases: TestCase[] = [
  { name: 'FNAF 2', tmdbId: '1228246', type: 'movie' },
  { name: 'Fight Club', tmdbId: '550', type: 'movie' },
  { name: 'The Matrix', tmdbId: '603', type: 'movie' },
  { name: 'Breaking Bad S01E01', tmdbId: '1396', type: 'tv', season: 1, episode: 1 },
  { name: 'The Office S01E01', tmdbId: '2316', type: 'tv', season: 1, episode: 1 },
];

async function testExtraction(test: TestCase): Promise<boolean> {
  try {
    // Step 1: Fetch embed page
    const embedUrl = test.type === 'tv' && test.season && test.episode
      ? `https://vidsrc-embed.ru/embed/tv/${test.tmdbId}/${test.season}/${test.episode}`
      : `https://vidsrc-embed.ru/embed/movie/${test.tmdbId}`;
    
    const embedRes = await fetchWithHeaders(embedUrl);
    const embedHtml = await embedRes.text();
    
    // Step 2: Extract RCP hash
    const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
    if (!rcpMatch) {
      console.log(`  ❌ No RCP found`);
      return false;
    }
    
    // Step 3: Fetch RCP page
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpMatch[1]}`;
    const rcpRes = await fetchWithHeaders(rcpUrl, embedUrl);
    const rcpHtml = await rcpRes.text();
    
    // Check for Turnstile
    if (rcpHtml.includes('turnstile') || rcpHtml.includes('cf-turnstile')) {
      console.log(`  ❌ Turnstile detected!`);
      return false;
    }
    
    // Step 4: Extract ProRCP/SrcRCP
    const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
    const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
    
    const endpointType = prorcpMatch ? 'prorcp' : 'srcrcp';
    const endpointHash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch?.[1];
    
    if (!endpointHash) {
      console.log(`  ❌ No ProRCP/SrcRCP found`);
      return false;
    }
    
    // Step 5: Fetch ProRCP/SrcRCP page
    const prorcpUrl = `https://cloudnestra.com/${endpointType}/${endpointHash}`;
    const prorcpRes = await fetchWithHeaders(prorcpUrl, rcpUrl);
    const prorcpHtml = await prorcpRes.text();
    
    // Step 6: Extract encoded div
    const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) {
      console.log(`  ❌ No encoded div found`);
      return false;
    }
    
    // Step 7: Decode
    const decoded = staticDecode(divMatch[2]);
    if (!decoded) {
      console.log(`  ❌ Decode failed`);
      return false;
    }
    
    // Step 8: Extract URLs
    const urls = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    if (urls.length === 0) {
      console.log(`  ❌ No m3u8 URLs found`);
      return false;
    }
    
    console.log(`  ✅ Found ${urls.length} m3u8 URLs`);
    return true;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('VIDSRC EXTRACTOR - MULTIPLE CONTENT TEST');
  console.log('='.repeat(70));
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`\n[${test.name}] Testing...`);
    const success = await testExtraction(test);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`Passed: ${passed}/${testCases.length}`);
  console.log(`Failed: ${failed}/${testCases.length}`);
  console.log(`Success rate: ${(passed / testCases.length * 100).toFixed(0)}%`);
  
  if (passed === testCases.length) {
    console.log('\n🎉 ALL TESTS PASSED! VidSrc extraction works without a browser!');
  }
}

main().catch(console.error);
