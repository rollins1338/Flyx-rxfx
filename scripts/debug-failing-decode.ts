/**
 * Debug the failing decode cases
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

async function getEncodedContent(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number) {
  const embedUrl = type === 'tv' && season && episode
    ? `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  const embedRes = await fetchWithHeaders(embedUrl);
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) throw new Error('No RCP');
  
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpMatch[1]}`;
  const rcpRes = await fetchWithHeaders(rcpUrl, embedUrl);
  const rcpHtml = await rcpRes.text();
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  const endpointType = prorcpMatch ? 'prorcp' : 'srcrcp';
  const endpointHash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch?.[1];
  
  if (!endpointHash) throw new Error('No ProRCP/SrcRCP');
  
  const prorcpUrl = `https://cloudnestra.com/${endpointType}/${endpointHash}`;
  const prorcpRes = await fetchWithHeaders(prorcpUrl, rcpUrl);
  const prorcpHtml = await prorcpRes.text();
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) throw new Error('No encoded div');
  
  return { divId: divMatch[1], content: divMatch[2] };
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

// Try ALL possible decoders
function tryAllDecoders(content: string): { method: string; result: string } | null {
  // Method 1: HEX format (reverse + subtract 1 + hex)
  const hex = decodeHexFormat(content);
  if (hex.includes('https://') && hex.includes('.m3u8')) {
    return { method: 'HEX (reverse + sub1 + hex)', result: hex };
  }
  
  // Method 2: BASE64 with various shifts
  for (const shift of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const decoded = decodeBase64Format(content, shift);
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return { method: `BASE64 shift ${shift}`, result: decoded };
    }
  }
  
  // Method 3: Direct base64
  try {
    let data = content.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4 !== 0) data += '=';
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return { method: 'Direct BASE64', result: decoded };
    }
  } catch {}
  
  // Method 4: Reverse + direct base64
  try {
    let data = content.split('').reverse().join('');
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4 !== 0) data += '=';
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return { method: 'Reverse + BASE64', result: decoded };
    }
  } catch {}
  
  // Method 5: URL decode + base64
  try {
    const urlDecoded = decodeURIComponent(content);
    let data = urlDecoded.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4 !== 0) data += '=';
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return { method: 'URL decode + BASE64', result: decoded };
    }
  } catch {}
  
  // Method 6: Just reverse
  const reversed = content.split('').reverse().join('');
  if (reversed.includes('https://') && reversed.includes('.m3u8')) {
    return { method: 'Just reverse', result: reversed };
  }
  
  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('DEBUG FAILING DECODE CASES');
  console.log('='.repeat(70));
  
  const failingCases = [
    { name: 'FNAF 2', tmdbId: '1228246', type: 'movie' as const },
    { name: 'The Office S01E01', tmdbId: '2316', type: 'tv' as const, season: 1, episode: 1 },
  ];
  
  for (const test of failingCases) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${test.name}]`);
    console.log('='.repeat(70));
    
    try {
      const { divId, content } = await getEncodedContent(
        test.tmdbId, 
        test.type, 
        test.season, 
        test.episode
      );
      
      console.log(`Div ID: ${divId}`);
      console.log(`Content length: ${content.length}`);
      console.log(`Content preview: ${content.substring(0, 100)}...`);
      console.log(`Content end: ...${content.substring(content.length - 50)}`);
      
      // Analyze content
      console.log(`\nContent analysis:`);
      console.log(`  Has =: ${content.includes('=')}`);
      console.log(`  Has +: ${content.includes('+')}`);
      console.log(`  Has /: ${content.includes('/')}`);
      console.log(`  Has -: ${content.includes('-')}`);
      console.log(`  Has _: ${content.includes('_')}`);
      console.log(`  Has :: ${content.includes(':')}`);
      console.log(`  Starts with #: ${content.startsWith('#')}`);
      console.log(`  Starts with =: ${content.startsWith('=')}`);
      
      // Character frequency
      const charFreq: Record<string, number> = {};
      for (const c of content.substring(0, 500)) {
        charFreq[c] = (charFreq[c] || 0) + 1;
      }
      const topChars = Object.entries(charFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      console.log(`\nTop characters: ${topChars.map(([c, n]) => `'${c}':${n}`).join(', ')}`);
      
      // Try all decoders
      console.log(`\nTrying all decoders...`);
      const result = tryAllDecoders(content);
      
      if (result) {
        console.log(`\n✅ SUCCESS with method: ${result.method}`);
        console.log(`Result preview: ${result.result.substring(0, 200)}...`);
        
        const urls = result.result.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
        console.log(`Found ${urls.length} m3u8 URLs`);
      } else {
        console.log(`\n❌ ALL DECODERS FAILED`);
        
        // Save content for manual analysis
        await Bun.write(`debug-content-${test.tmdbId}.txt`, content);
        console.log(`Saved content to debug-content-${test.tmdbId}.txt`);
      }
      
    } catch (error) {
      console.log(`Error: ${error}`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
