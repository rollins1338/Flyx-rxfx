/**
 * Debug what's happening with the RCP page
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return { status: res.status, html: await res.text() };
}

async function main() {
  console.log('Fetching embed page...');
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embed = await fetchPage(embedUrl);
  console.log(`Embed status: ${embed.status}`);
  
  const rcpMatch = embed.html.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) {
    console.error('No RCP found in embed page!');
    console.log('Embed HTML preview:');
    console.log(embed.html.substring(0, 2000));
    return;
  }
  
  let rcpUrl = rcpMatch[0];
  if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;
  if (!rcpUrl.startsWith('http')) rcpUrl = 'https://' + rcpUrl;
  
  console.log(`\nRCP URL: ${rcpUrl.substring(0, 100)}...`);
  
  console.log('\nFetching RCP page...');
  const rcp = await fetchPage(rcpUrl, embedUrl);
  console.log(`RCP status: ${rcp.status}`);
  console.log(`RCP HTML length: ${rcp.html.length}`);
  
  // Check for Turnstile
  const hasTurnstile = rcp.html.includes('turnstile') || rcp.html.includes('cf-turnstile');
  console.log(`Turnstile detected: ${hasTurnstile}`);
  
  // Check for prorcp
  const prorcpMatch = rcp.html.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcp.html.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  console.log(`ProRCP found: ${!!prorcpMatch}`);
  console.log(`SrcRCP found: ${!!srcrcpMatch}`);
  
  if (!prorcpMatch && !srcrcpMatch) {
    console.log('\nRCP HTML preview:');
    console.log(rcp.html.substring(0, 3000));
    
    // Save full HTML for analysis
    await Bun.write('debug-rcp-issue.html', rcp.html);
    console.log('\nFull HTML saved to debug-rcp-issue.html');
  } else {
    const endpoint = prorcpMatch ? 'prorcp' : 'srcrcp';
    const hash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch![1];
    console.log(`\n${endpoint.toUpperCase()} hash: ${hash.substring(0, 80)}...`);
    
    // Fetch the endpoint
    const endpointUrl = `https://cloudnestra.com/${endpoint}/${hash}`;
    console.log(`\nFetching ${endpoint}...`);
    const endpointRes = await fetchPage(endpointUrl, rcpUrl);
    console.log(`Status: ${endpointRes.status}`);
    
    // Check for encoded div
    const divMatch = endpointRes.html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (divMatch) {
      console.log(`\nDiv ID: ${divMatch[1]}`);
      console.log(`Content length: ${divMatch[2].length}`);
      console.log(`Content preview: ${divMatch[2].substring(0, 100)}...`);
    } else {
      console.log('\nNo encoded div found!');
      await Bun.write('debug-prorcp-issue.html', endpointRes.html);
    }
  }
}

main().catch(console.error);
