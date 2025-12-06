/**
 * Collect multiple samples to find patterns
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

async function getSample() {
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) return null;
  
  const rcpUrl = 'https://cloudnestra.com/rcp/' + rcpMatch[1];
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) return null;
  
  const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpMatch[1]}`;
  const prorcpHtml = await fetchPage(prorcpUrl, rcpUrl);
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) return null;
  
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  
  return {
    divId: divMatch[1],
    content: divMatch[2],
    scriptHash: scriptMatch ? scriptMatch[1] : null,
    contentLength: divMatch[2].length,
    firstChars: divMatch[2].substring(0, 30),
    lastChars: divMatch[2].substring(divMatch[2].length - 30),
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('COLLECTING SAMPLES');
  console.log('='.repeat(80));

  const samples = [];
  
  for (let i = 0; i < 5; i++) {
    console.log(`\nFetching sample ${i + 1}...`);
    const sample = await getSample();
    if (sample) {
      samples.push(sample);
      console.log(`  Div ID: ${sample.divId}`);
      console.log(`  Content length: ${sample.contentLength}`);
      console.log(`  Script hash: ${sample.scriptHash}`);
      console.log(`  First 30: ${sample.firstChars}`);
      console.log(`  Last 30: ${sample.lastChars}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));
  
  // Check if div IDs are the same
  const divIds = samples.map(s => s.divId);
  const uniqueDivIds = new Set(divIds);
  console.log(`\nUnique div IDs: ${uniqueDivIds.size}`);
  console.log(`Div IDs: ${[...uniqueDivIds].join(', ')}`);
  
  // Check if script hashes are the same
  const scriptHashes = samples.map(s => s.scriptHash).filter(Boolean);
  const uniqueScriptHashes = new Set(scriptHashes);
  console.log(`\nUnique script hashes: ${uniqueScriptHashes.size}`);
  
  // Check content patterns
  console.log('\nContent patterns:');
  for (const sample of samples) {
    const startsWithEqual = sample.content.startsWith('=');
    const endsWithEqual = sample.content.endsWith('=');
    const hasColon = sample.content.includes(':');
    const startsWithHash = sample.content.startsWith('#');
    
    console.log(`  ${sample.divId}: starts==:${startsWithEqual} ends==:${endsWithEqual} colon:${hasColon} #:${startsWithHash}`);
  }
  
  // Check if content lengths are similar
  const lengths = samples.map(s => s.contentLength);
  console.log(`\nContent lengths: ${lengths.join(', ')}`);
  console.log(`Length range: ${Math.min(...lengths)} - ${Math.max(...lengths)}`);
  
  // Check character sets
  console.log('\nCharacter analysis:');
  for (const sample of samples) {
    const chars = new Set(sample.content);
    const hasLowercase = /[a-z]/.test(sample.content);
    const hasUppercase = /[A-Z]/.test(sample.content);
    const hasDigits = /[0-9]/.test(sample.content);
    const hasSpecial = /[^a-zA-Z0-9]/.test(sample.content);
    
    console.log(`  ${sample.divId}: ${chars.size} unique chars, lower:${hasLowercase} upper:${hasUppercase} digits:${hasDigits} special:${hasSpecial}`);
  }
}

main().catch(console.error);
