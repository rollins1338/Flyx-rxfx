/**
 * Fetch fresh data and analyze the decoder script
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
  console.log('Content start:', divMatch[2].substring(0, 100));
  
  // Check content format
  const content = divMatch[2];
  if (content.startsWith('eqqmp://')) {
    console.log('\n*** ROT3 FORMAT DETECTED ***');
  } else if (content.includes(':')) {
    console.log('\n*** HEX WITH COLONS FORMAT ***');
  } else if (/^[0-9a-f]+$/i.test(content.substring(0, 100))) {
    console.log('\n*** PURE HEX FORMAT ***');
  } else {
    console.log('\n*** UNKNOWN FORMAT ***');
  }
  
  // Get decoder script URL
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (!scriptMatch) { console.log('No script'); return; }
  
  console.log('\nScript hash:', scriptMatch[1]);
  
  // Fetch decoder script
  const scriptRes = await fetch('https://cloudnestra.com/sV05kUlNvOdOxvtC/' + scriptMatch[1] + '.js', {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const script = await scriptRes.text();
  
  console.log('Script length:', script.length);
  
  // Save script for manual analysis
  await Bun.write('debug-decoder-fresh.js', script);
  console.log('Saved decoder to debug-decoder-fresh.js');
  
  // Try to find the decode algorithm by looking for patterns
  console.log('\n=== SCRIPT ANALYSIS ===');
  
  // Look for string that might be the div ID
  if (script.includes(divMatch[1])) {
    console.log('Script contains div ID directly!');
  }
  
  // Look for common decode patterns
  const patterns = [
    { name: 'getElementById', regex: /getElementById/g },
    { name: 'innerHTML', regex: /innerHTML/g },
    { name: 'charCodeAt', regex: /charCodeAt/g },
    { name: 'fromCharCode', regex: /fromCharCode/g },
    { name: 'split("")', regex: /split\s*\(\s*['"]['"]?\s*\)/g },
    { name: 'reverse()', regex: /reverse\s*\(\s*\)/g },
    { name: 'join("")', regex: /join\s*\(\s*['"]['"]?\s*\)/g },
    { name: 'parseInt(x,16)', regex: /parseInt\s*\([^,]+,\s*16\s*\)/g },
    { name: 'XOR (^)', regex: /\^/g },
    { name: 'atob', regex: /atob/g },
    { name: 'btoa', regex: /btoa/g },
    { name: 'substring', regex: /substring/g },
    { name: 'substr', regex: /substr\(/g },
    { name: 'slice', regex: /\.slice\(/g },
  ];
  
  for (const p of patterns) {
    const matches = script.match(p.regex);
    console.log(`${p.name}: ${matches?.length || 0}`);
  }
  
  // Try to deobfuscate by finding the main decode function
  // Look for window[divId] = ... pattern
  const windowAssign = script.match(/window\s*\[\s*['"']?([^'"'\]]+)['"']?\s*\]\s*=/g);
  console.log('\nwindow[x] = assignments:', windowAssign?.length || 0);
  
  // Look for document.getElementById calls
  const getElemCalls = script.match(/document\s*\.\s*getElementById\s*\(\s*['"']([^'"']+)['"']\s*\)/g);
  console.log('document.getElementById calls:', getElemCalls?.length || 0);
  if (getElemCalls) {
    getElemCalls.slice(0, 5).forEach(c => console.log('  ', c.substring(0, 60)));
  }
}

main().catch(console.error);
