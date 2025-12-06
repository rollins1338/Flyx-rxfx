/**
 * Fetch the decoder script and analyze it for the unknown format
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  // Fetch embed
  const embedRes = await fetch('https://vidsrc-embed.ru/embed/movie/1228246', {
    headers: { 'User-Agent': UA }
  });
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.log('No RCP'); return; }
  
  // Fetch RCP
  const rcpRes = await fetch('https://cloudnestra.com/rcp/' + rcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc-embed.ru/' }
  });
  const rcpHtml = await rcpRes.text();
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.log('No ProRCP'); return; }
  
  // Fetch ProRCP
  const prorcpRes = await fetch('https://cloudnestra.com/prorcp/' + prorcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const prorcpHtml = await prorcpRes.text();
  
  // Get div content
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.log('No div'); return; }
  
  console.log('Div ID:', divMatch[1]);
  console.log('Content length:', divMatch[2].length);
  console.log('Content preview:', divMatch[2].substring(0, 100));
  
  // Get decoder script
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (!scriptMatch) { console.log('No script'); return; }
  
  console.log('\nScript hash:', scriptMatch[1]);
  
  // Fetch decoder script
  const scriptRes = await fetch('https://cloudnestra.com/sV05kUlNvOdOxvtC/' + scriptMatch[1] + '.js', {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const script = await scriptRes.text();
  
  console.log('Script length:', script.length);
  
  // Save script
  await Bun.write('debug-decoder-unknown.js', script);
  console.log('Saved decoder to debug-decoder-unknown.js');
  
  // Try to find decode patterns in the script
  console.log('\n=== LOOKING FOR DECODE PATTERNS ===');
  
  // Look for string literals that might be alphabets
  const longStrings = script.match(/'[A-Za-z0-9+\/=]{20,}'/g) || [];
  console.log('\nLong string literals (potential alphabets):');
  longStrings.slice(0, 10).forEach(s => console.log('  ', s.substring(0, 60)));
  
  // Look for the div ID in the script
  if (script.includes(divMatch[1])) {
    console.log('\n*** Script contains div ID directly! ***');
  }
  
  // Look for common decode function names
  const decodeFuncs = ['decode', 'decrypt', 'deobfuscate', 'atob', 'btoa', 'fromCharCode', 'charCodeAt'];
  for (const func of decodeFuncs) {
    const count = (script.match(new RegExp(func, 'gi')) || []).length;
    if (count > 0) console.log(`${func}: ${count} occurrences`);
  }
  
  // Look for XOR patterns
  const xorCount = (script.match(/\^/g) || []).length;
  console.log(`XOR (^): ${xorCount} occurrences`);
  
  // Look for reverse patterns
  const reverseCount = (script.match(/reverse/gi) || []).length;
  console.log(`reverse: ${reverseCount} occurrences`);
  
  // Look for split/join patterns
  const splitCount = (script.match(/split\s*\(\s*['"]['"]?\s*\)/g) || []).length;
  const joinCount = (script.match(/join\s*\(\s*['"]['"]?\s*\)/g) || []).length;
  console.log(`split(''): ${splitCount}, join(''): ${joinCount}`);
  
  // Look for parseInt with base 16
  const parseIntHex = (script.match(/parseInt\s*\([^,]+,\s*16\s*\)/g) || []).length;
  console.log(`parseInt(x, 16): ${parseIntHex} occurrences`);
  
  // Look for substring/substr
  const substringCount = (script.match(/substring|substr/gi) || []).length;
  console.log(`substring/substr: ${substringCount} occurrences`);
}

main().catch(console.error);
