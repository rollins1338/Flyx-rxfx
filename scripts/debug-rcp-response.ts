/**
 * Debug the RCP response to see what we're getting
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  // Fetch embed
  console.log('Fetching embed...');
  const embedRes = await fetch('https://vidsrc-embed.ru/embed/movie/1228246', {
    headers: { 'User-Agent': UA }
  });
  const embedHtml = await embedRes.text();
  console.log('Embed status:', embedRes.status);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { 
    console.log('No RCP found in embed!');
    console.log('Embed preview:', embedHtml.substring(0, 500));
    return; 
  }
  console.log('RCP hash found');
  
  // Fetch RCP
  console.log('\nFetching RCP...');
  const rcpRes = await fetch('https://cloudnestra.com/rcp/' + rcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc-embed.ru/' }
  });
  const rcpHtml = await rcpRes.text();
  console.log('RCP status:', rcpRes.status);
  console.log('RCP length:', rcpHtml.length);
  
  // Check for Turnstile
  if (rcpHtml.includes('turnstile') || rcpHtml.includes('cf-turnstile')) {
    console.log('*** TURNSTILE DETECTED! ***');
  }
  
  // Check for prorcp/srcrcp
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  console.log('ProRCP found:', !!prorcpMatch);
  console.log('SrcRCP found:', !!srcrcpMatch);
  
  if (!prorcpMatch && !srcrcpMatch) {
    console.log('\nRCP HTML preview:');
    console.log(rcpHtml.substring(0, 2000));
    await Bun.write('debug-rcp-response.html', rcpHtml);
    console.log('\nSaved full RCP to debug-rcp-response.html');
  } else {
    const endpoint = prorcpMatch ? 'prorcp' : 'srcrcp';
    const hash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch![1];
    
    // Fetch the endpoint
    console.log(`\nFetching ${endpoint}...`);
    const endpointRes = await fetch(`https://cloudnestra.com/${endpoint}/${hash}`, {
      headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
    });
    const endpointHtml = await endpointRes.text();
    console.log(`${endpoint} status:`, endpointRes.status);
    console.log(`${endpoint} length:`, endpointHtml.length);
    
    // Get div content
    const divMatch = endpointHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (divMatch) {
      console.log('\nDiv ID:', divMatch[1]);
      console.log('Content length:', divMatch[2].length);
      console.log('Content start:', divMatch[2].substring(0, 100));
      
      // Detect format
      const content = divMatch[2];
      if (content.startsWith('eqqmp://')) {
        console.log('\n*** FORMAT: ROT3 ***');
      } else if (content.includes(':')) {
        console.log('\n*** FORMAT: HEX WITH COLONS ***');
      } else if (/^[0-9a-f]+$/i.test(content.substring(0, 100))) {
        console.log('\n*** FORMAT: PURE HEX ***');
      } else {
        console.log('\n*** FORMAT: UNKNOWN ***');
      }
      
      await Bun.write('debug-content-fresh.txt', content);
    } else {
      console.log('No div found!');
      await Bun.write('debug-endpoint-response.html', endpointHtml);
    }
  }
}

main().catch(console.error);
