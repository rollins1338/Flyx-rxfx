/**
 * Analyze the BASE64_LIKE format that's not decoding
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchContent(tmdbId: string) {
  const embedRes = await fetch(`https://vidsrc-embed.ru/embed/movie/${tmdbId}`, {
    headers: { 'User-Agent': UA }
  });
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) return null;
  
  const rcpRes = await fetch('https://cloudnestra.com/rcp/' + rcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc-embed.ru/' }
  });
  const rcpHtml = await rcpRes.text();
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) return null;
  
  const prorcpRes = await fetch('https://cloudnestra.com/prorcp/' + prorcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const prorcpHtml = await prorcpRes.text();
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  return divMatch ? { divId: divMatch[1], content: divMatch[2] } : null;
}

function tryAllDecoders(content: string): string | null {
  // Try reverse + base64 + subtract (various shifts)
  for (let shift = 0; shift <= 10; shift++) {
    try {
      let data = content.split('').reverse().join('');
      data = data.replace(/-/g, '+').replace(/_/g, '/');
      while (data.length % 4 !== 0) data += '=';
      const decoded = Buffer.from(data, 'base64').toString('binary');
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) - shift);
      }
      if (result.includes('https://') && result.includes('.m3u8')) {
        return `REVERSE+BASE64+SHIFT${shift}: ${result.substring(0, 150)}`;
      }
    } catch {}
  }
  
  // Try direct base64 + subtract
  for (let shift = 0; shift <= 10; shift++) {
    try {
      let data = content.replace(/-/g, '+').replace(/_/g, '/');
      while (data.length % 4 !== 0) data += '=';
      const decoded = Buffer.from(data, 'base64').toString('binary');
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) - shift);
      }
      if (result.includes('https://') && result.includes('.m3u8')) {
        return `DIRECT_BASE64+SHIFT${shift}: ${result.substring(0, 150)}`;
      }
    } catch {}
  }
  
  // Try hex decode
  if (/^[0-9a-f]+$/i.test(content.replace(/[^0-9a-f]/gi, '').substring(0, 100))) {
    const hexClean = content.replace(/[^0-9a-f]/gi, '');
    let decoded = '';
    for (let i = 0; i < hexClean.length; i += 2) {
      const code = parseInt(hexClean.substring(i, i + 2), 16);
      if (!isNaN(code) && code > 0) decoded += String.fromCharCode(code);
    }
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return `HEX: ${decoded.substring(0, 150)}`;
    }
  }
  
  // Try reverse + subtract 1 + hex
  const reversed = content.split('').reverse().join('');
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  const hexClean = adjusted.replace(/[^0-9a-f]/gi, '');
  if (hexClean.length > 100) {
    let decoded = '';
    for (let i = 0; i < hexClean.length; i += 2) {
      const code = parseInt(hexClean.substring(i, i + 2), 16);
      if (!isNaN(code) && code > 0) decoded += String.fromCharCode(code);
    }
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      return `REVERSE+SUB1+HEX: ${decoded.substring(0, 150)}`;
    }
  }
  
  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('ANALYZING BASE64_LIKE FORMAT');
  console.log('='.repeat(70));
  
  // Fetch FNAF 2 (known to use BASE64_LIKE format)
  console.log('\nFetching FNAF 2 (1228246)...');
  const result = await fetchContent('1228246');
  
  if (!result) {
    console.log('Failed to fetch content');
    return;
  }
  
  console.log('Div ID:', result.divId);
  console.log('Content length:', result.content.length);
  console.log('Content start:', result.content.substring(0, 80));
  console.log('Content end:', result.content.substring(result.content.length - 80));
  
  // Analyze content
  console.log('\nContent analysis:');
  console.log('  Starts with ==:', result.content.startsWith('=='));
  console.log('  Starts with =:', result.content.startsWith('='));
  console.log('  Contains =:', result.content.includes('='));
  console.log('  Position of first =:', result.content.indexOf('='));
  
  // Character frequency
  const freq: Record<string, number> = {};
  for (const c of result.content.substring(0, 500)) {
    freq[c] = (freq[c] || 0) + 1;
  }
  const topChars = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('  Top chars:', topChars.map(([c, n]) => `'${c}':${n}`).join(', '));
  
  // Try all decoders
  console.log('\nTrying all decoders...');
  const decoded = tryAllDecoders(result.content);
  
  if (decoded) {
    console.log('\n*** SUCCESS! ***');
    console.log(decoded);
  } else {
    console.log('\n*** ALL DECODERS FAILED ***');
    
    // Save content for manual analysis
    await Bun.write('debug-base64-content.txt', result.content);
    console.log('Saved content to debug-base64-content.txt');
  }
}

main().catch(console.error);
