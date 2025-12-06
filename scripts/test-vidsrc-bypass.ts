/**
 * Test if we can consistently bypass Turnstile on vidsrc-embed.ru
 * by directly fetching the RCP and ProRCP pages
 */

const TMDB_ID = '1228246'; // FNAF 2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithHeaders(url: string, referer?: string) {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };
  if (referer) {
    headers['Referer'] = referer;
    headers['Origin'] = new URL(referer).origin;
  }
  return fetch(url, { headers });
}

async function testFullFlow() {
  console.log('='.repeat(70));
  console.log('VIDSRC BYPASS TEST - Full Flow');
  console.log('='.repeat(70));
  
  // Step 1: Fetch embed page
  console.log('\n[1] Fetching vidsrc-embed.ru embed page...');
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedRes = await fetchWithHeaders(embedUrl);
  const embedHtml = await embedRes.text();
  console.log(`Status: ${embedRes.status}`);
  
  // Extract RCP URL
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) {
    console.error('FAILED: No RCP URL found in embed page');
    return false;
  }
  
  const rcpHash = rcpMatch[1];
  console.log(`RCP hash found (${rcpHash.length} chars)`);
  
  // Step 2: Fetch RCP page
  console.log('\n[2] Fetching cloudnestra.com RCP page...');
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  const rcpRes = await fetchWithHeaders(rcpUrl, embedUrl);
  const rcpHtml = await rcpRes.text();
  console.log(`Status: ${rcpRes.status}`);
  
  // Check for Turnstile
  const hasTurnstile = rcpHtml.includes('turnstile') || rcpHtml.includes('cf-turnstile');
  console.log(`Turnstile detected: ${hasTurnstile}`);
  
  if (hasTurnstile) {
    console.error('BLOCKED: Turnstile is present on RCP page');
    await Bun.write('debug-rcp-turnstile.html', rcpHtml);
    return false;
  }
  
  // Extract ProRCP URL
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  console.log(`ProRCP found: ${!!prorcpMatch}`);
  console.log(`SrcRCP found: ${!!srcrcpMatch}`);
  
  if (!prorcpMatch && !srcrcpMatch) {
    console.error('FAILED: No ProRCP or SrcRCP URL found');
    await Bun.write('debug-rcp-no-prorcp.html', rcpHtml);
    return false;
  }
  
  // Step 3: Fetch ProRCP page
  const endpointType = prorcpMatch ? 'prorcp' : 'srcrcp';
  const endpointHash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch![1];
  
  console.log(`\n[3] Fetching cloudnestra.com ${endpointType.toUpperCase()} page...`);
  const prorcpUrl = `https://cloudnestra.com/${endpointType}/${endpointHash}`;
  const prorcpRes = await fetchWithHeaders(prorcpUrl, rcpUrl);
  const prorcpHtml = await prorcpRes.text();
  console.log(`Status: ${prorcpRes.status}`);
  
  // Extract encoded content
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) {
    console.error('FAILED: No encoded div found in ProRCP page');
    await Bun.write('debug-prorcp-no-div.html', prorcpHtml);
    return false;
  }
  
  console.log(`Encoded div ID: ${divMatch[1]}`);
  console.log(`Encoded content length: ${divMatch[2].length}`);
  
  // Extract decoder script
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (scriptMatch) {
    console.log(`Decoder script hash: ${scriptMatch[1]}`);
    
    // Step 4: Fetch decoder script
    console.log('\n[4] Fetching decoder script...');
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptMatch[1]}.js`;
    const scriptRes = await fetchWithHeaders(scriptUrl, prorcpUrl);
    const scriptContent = await scriptRes.text();
    console.log(`Status: ${scriptRes.status}`);
    console.log(`Decoder script length: ${scriptContent.length}`);
    
    if (scriptContent.length > 1000) {
      console.log('\n*** SUCCESS! Full flow completed without Turnstile! ***');
      
      // Save all files for analysis
      await Bun.write('debug-bypass-embed.html', embedHtml);
      await Bun.write('debug-bypass-rcp.html', rcpHtml);
      await Bun.write('debug-bypass-prorcp.html', prorcpHtml);
      await Bun.write('debug-bypass-decoder.js', scriptContent);
      
      return true;
    }
  }
  
  return false;
}

async function main() {
  let successCount = 0;
  const totalTests = 5;
  
  for (let i = 0; i < totalTests; i++) {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`TEST ${i + 1} of ${totalTests}`);
    console.log(`${'#'.repeat(70)}`);
    
    const success = await testFullFlow();
    if (success) successCount++;
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('FINAL RESULTS');
  console.log('='.repeat(70));
  console.log(`Success rate: ${successCount}/${totalTests} (${(successCount/totalTests*100).toFixed(0)}%)`);
  
  if (successCount === totalTests) {
    console.log('\n*** BYPASS WORKS CONSISTENTLY! ***');
    console.log('We can fetch ProRCP directly without solving Turnstile.');
  } else if (successCount > 0) {
    console.log('\n*** BYPASS WORKS INTERMITTENTLY ***');
    console.log('Turnstile may be rate-limited or IP-based.');
  } else {
    console.log('\n*** BYPASS FAILED ***');
    console.log('Turnstile is blocking all requests.');
  }
}

main().catch(console.error);
