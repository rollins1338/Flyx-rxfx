/**
 * Test decoding The Office content
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  console.log('Fetching The Office S01E01...');
  
  const embedRes = await fetch('https://vidsrc-embed.ru/embed/tv/2316/1/1', {
    headers: { 'User-Agent': UA }
  });
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.log('No RCP'); return; }
  
  const rcpRes = await fetch('https://cloudnestra.com/rcp/' + rcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc-embed.ru/' }
  });
  const rcpHtml = await rcpRes.text();
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.log('No ProRCP'); return; }
  
  const prorcpRes = await fetch('https://cloudnestra.com/prorcp/' + prorcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const prorcpHtml = await prorcpRes.text();
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.log('No div'); return; }
  
  const content = divMatch[2];
  console.log('Div ID:', divMatch[1]);
  console.log('Content length:', content.length);
  console.log('Content start:', content.substring(0, 100));
  
  // Detect format
  if (content.startsWith('==') || content.startsWith('=')) {
    console.log('\nFormat: REVERSED_BASE64');
  } else if (content.startsWith('eqqmp://')) {
    console.log('\nFormat: ROT3');
  } else if (content.includes(':')) {
    console.log('\nFormat: HEX_WITH_COLONS');
  } else if (/^[0-9a-f]+$/i.test(content.substring(0, 100))) {
    console.log('\nFormat: PURE_HEX');
  } else {
    console.log('\nFormat: UNKNOWN');
  }
  
  // Try reverse + subtract 1 + hex
  console.log('\nTrying HEX decode (reverse + sub1 + hex)...');
  const reversed = content.split('').reverse().join('');
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  
  const hexClean = adjusted.replace(/[^0-9a-fA-F]/g, '');
  console.log('Hex clean length:', hexClean.length);
  
  let decoded = '';
  for (let i = 0; i < hexClean.length; i += 2) {
    const code = parseInt(hexClean.substring(i, i + 2), 16);
    if (!isNaN(code) && code > 0) decoded += String.fromCharCode(code);
  }
  
  console.log('Decoded length:', decoded.length);
  console.log('Has https:', decoded.includes('https'));
  console.log('Has m3u8:', decoded.includes('m3u8'));
  
  if (decoded.includes('https')) {
    console.log('\n*** SUCCESS! ***');
    console.log('Decoded preview:', decoded.substring(0, 300));
    
    const urls = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    console.log('\nFound', urls.length, 'm3u8 URLs');
  } else {
    console.log('\n*** HEX DECODE FAILED ***');
    
    // Try BASE64 with various shifts
    console.log('\nTrying BASE64 decode...');
    for (let shift = 0; shift <= 10; shift++) {
      try {
        let data = content.split('').reverse().join('');
        data = data.replace(/-/g, '+').replace(/_/g, '/');
        while (data.length % 4 !== 0) data += '=';
        const b64decoded = Buffer.from(data, 'base64').toString('binary');
        let result = '';
        for (let i = 0; i < b64decoded.length; i++) {
          result += String.fromCharCode(b64decoded.charCodeAt(i) - shift);
        }
        if (result.includes('https://') && result.includes('.m3u8')) {
          console.log(`\n*** SUCCESS with shift ${shift}! ***`);
          console.log('Decoded preview:', result.substring(0, 300));
          break;
        }
      } catch (e) {}
    }
  }
}

main().catch(console.error);
