const https = require('https');
const fs = require('fs');

async function analyzePlayerDecoder() {
  console.log('Fetching player page to find decoder...');
  
  // Use the hash from the latest run
  const embedUrl = 'https://vidsrc-embed.ru/embed/movie/550';
  const embedPage = await fetchPage(embedUrl);
  
  const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
  if (!hashMatch) throw new Error('Hash not found');
  const hash = hashMatch[1];
  console.log('Hash:', hash);
  
  const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
  const rcpPage = await fetchPage(rcpUrl, embedUrl);
  
  const playerUrlMatch = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
  if (!playerUrlMatch) throw new Error('Player URL not found');
  
  const playerUrl = `https://cloudnestra.com/prorcp/${playerUrlMatch[1]}`;
  console.log('Fetching player page:', playerUrl);
  
  const playerPage = await fetchPage(playerUrl, rcpUrl);
  
  // Save the full player page
  fs.writeFileSync('player-page-full.html', playerPage);
  console.log('Saved player page to player-page-full.html');
  
  // Extract all script tags
  const scriptMatches = playerPage.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  let scriptIndex = 0;
  
  for (const match of scriptMatches) {
    const scriptContent = match[1];
    if (scriptContent.length > 100) {
      fs.writeFileSync(`player-script-${scriptIndex}.js`, scriptContent);
      console.log(`Saved script ${scriptIndex} (${scriptContent.length} bytes)`);
      
      // Look for decoder functions
      if (scriptContent.includes('decode') || 
          scriptContent.includes('decrypt') || 
          scriptContent.includes('atob') ||
          scriptContent.includes('fromCharCode') ||
          scriptContent.includes('getElementById')) {
        console.log(`  -> Script ${scriptIndex} might contain decoder!`);
        console.log(`  -> Preview: ${scriptContent.substring(0, 200)}`);
      }
      
      scriptIndex++;
    }
  }
  
  // Look for the hidden div
  const hiddenDivMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i);
  if (hiddenDivMatch) {
    console.log('\nHidden div ID:', hiddenDivMatch[1]);
    console.log('Encoded data length:', hiddenDivMatch[2].length);
    console.log('Encoded preview:', hiddenDivMatch[2].substring(0, 100));
  }
}

function fetchPage(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer,
        'Connection': 'keep-alive'
      }
    }, res => {
      let data = '';
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location, referer).then(resolve).catch(reject);
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

analyzePlayerDecoder().catch(console.error);
