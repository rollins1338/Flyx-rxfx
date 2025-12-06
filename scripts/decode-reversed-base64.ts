/**
 * The content starts with == which means it's REVERSED base64!
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
  console.log('DECODING REVERSED BASE64 FORMAT');
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
  console.log(`Starts with: ${content.substring(0, 20)}`);
  console.log(`Ends with: ${content.substring(content.length - 20)}`);
  
  // The content starts with == which is base64 padding
  // This means the string is REVERSED!
  
  console.log('\n[STEP 1: Reverse the string]');
  const reversed = content.split('').reverse().join('');
  console.log(`Reversed starts with: ${reversed.substring(0, 50)}`);
  console.log(`Reversed ends with: ${reversed.substring(reversed.length - 20)}`);
  
  console.log('\n[STEP 2: Base64 decode]');
  try {
    // Make sure it's valid base64
    let b64 = reversed.replace(/-/g, '+').replace(/_/g, '/');
    // Ensure proper padding
    while (b64.length % 4 !== 0) b64 += '=';
    
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    console.log(`Decoded length: ${decoded.length}`);
    console.log(`Decoded preview: ${decoded.substring(0, 200)}`);
    
    if (decoded.includes('http')) {
      console.log('\n*** FOUND HTTP URL! ***');
      const urls = decoded.match(/https?:\/\/[^\s"']+/g);
      if (urls) {
        urls.forEach(url => console.log(`  ${url}`));
      }
    }
    
    // Check if the decoded content needs further processing
    if (decoded.startsWith('==') || decoded.endsWith('==')) {
      console.log('\n[STEP 3: Decoded content also looks reversed, trying again]');
      const decoded2 = decoded.split('').reverse().join('');
      console.log(`Double reversed: ${decoded2.substring(0, 200)}`);
      
      if (decoded2.includes('http')) {
        console.log('\n*** FOUND HTTP URL! ***');
        const urls = decoded2.match(/https?:\/\/[^\s"']+/g);
        if (urls) {
          urls.forEach(url => console.log(`  ${url}`));
        }
      }
    }
    
    // Try to decode as JSON
    try {
      const json = JSON.parse(decoded);
      console.log('\n*** DECODED AS JSON! ***');
      console.log(JSON.stringify(json, null, 2).substring(0, 500));
    } catch {}
    
    // Check if it's another layer of base64
    try {
      const decoded2 = Buffer.from(decoded, 'base64').toString('utf8');
      console.log(`\n[STEP 3: Another base64 layer]`);
      console.log(`Decoded2: ${decoded2.substring(0, 200)}`);
      
      if (decoded2.includes('http')) {
        console.log('\n*** FOUND HTTP URL IN LAYER 2! ***');
        const urls = decoded2.match(/https?:\/\/[^\s"']+/g);
        if (urls) {
          urls.forEach(url => console.log(`  ${url}`));
        }
      }
    } catch {}
    
  } catch (e) {
    console.log(`Base64 decode failed: ${e}`);
  }
  
  // Also try with different character shifts
  console.log('\n[TRYING CHARACTER SHIFTS]');
  for (let shift = 1; shift <= 5; shift++) {
    let shifted = '';
    for (const c of reversed) {
      shifted += String.fromCharCode(c.charCodeAt(0) - shift);
    }
    
    try {
      let b64 = shifted.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      if (decoded.includes('http') || decoded.includes('.m3u8')) {
        console.log(`\n*** SHIFT ${shift} SUCCESS! ***`);
        console.log(decoded.substring(0, 300));
      }
    } catch {}
  }
  
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
