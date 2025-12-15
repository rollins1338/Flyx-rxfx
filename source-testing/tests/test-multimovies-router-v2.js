/**
 * Test MultiMovies router endpoint v2
 */

async function main() {
  console.log('=== TESTING MULTIMOVIES ROUTER ===\n');
  
  const tmdbId = '155';
  
  // Get the embed page to extract parameters
  const embedResp = await fetch(`https://multimovies.cloud/embed/movie/${tmdbId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://multimovies.cloud/',
    }
  });
  
  const embedHtml = await embedResp.text();
  
  // Extract the base64 parameters
  const base64Match = embedHtml.match(/eyJ[A-Za-z0-9+/=]+/);
  if (!base64Match) {
    console.log('No base64 parameters found');
    return;
  }
  
  const params = JSON.parse(Buffer.from(base64Match[0], 'base64').toString());
  console.log('Original params:', JSON.stringify(params, null, 2));
  
  // Add required fields
  params.parameters.adBlockingDetected = false;
  params.parameters.timezoneBrowser = 'America/Chicago';
  params.parameters.webdriver = false;
  params.parameters.gpu = null;
  
  console.log('\n\n=== CALLING ROUTER ===\n');
  
  const routerUrl = `https://router.parklogic.com/embed/movie/${tmdbId}`;
  console.log(`URL: ${routerUrl}`);
  console.log(`Body: ${JSON.stringify(params)}`);
  
  try {
    const routerResp = await fetch(routerUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Origin': 'https://multimovies.cloud',
        'Referer': 'https://multimovies.cloud/',
      },
      body: JSON.stringify(params),
    });
    
    console.log(`\nStatus: ${routerResp.status}`);
    const text = await routerResp.text();
    console.log(`Response length: ${text.length}`);
    console.log(`Response preview: ${text.substring(0, 300)}`);
    
    // Check if it's a redirect URL
    if (text.startsWith('http')) {
      console.log('\n\n=== FOLLOWING REDIRECT ===\n');
      console.log(`Redirect URL: ${text}`);
      
      // Follow the redirect
      const redirectResp = await fetch(text, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://multimovies.cloud/',
        }
      });
      
      console.log(`Status: ${redirectResp.status}`);
      const redirectHtml = await redirectResp.text();
      console.log(`Length: ${redirectHtml.length}`);
      console.log(`Has m3u8: ${redirectHtml.includes('m3u8')}`);
      console.log(`Has mp4: ${redirectHtml.includes('.mp4')}`);
      console.log(`Has Playerjs: ${redirectHtml.includes('Playerjs')}`);
      console.log(`Has file: ${redirectHtml.includes('"file"')}`);
      
      // Look for stream URLs
      const streamUrls = redirectHtml.match(/https?:\/\/[^\s"'<>\\]+(?:m3u8|mp4)[^\s"'<>\\]*/gi);
      if (streamUrls) {
        console.log('\nStream URLs found:');
        for (const u of streamUrls.slice(0, 5)) {
          console.log(`  ${u.substring(0, 100)}`);
        }
      }
      
      // Look for file URLs
      const fileUrls = redirectHtml.match(/"file"\s*:\s*"([^"]+)"/gi);
      if (fileUrls) {
        console.log('\nFile URLs found:');
        for (const f of fileUrls.slice(0, 5)) {
          const url = f.match(/"file"\s*:\s*"([^"]+)"/)[1].replace(/\\\//g, '/');
          console.log(`  ${url.substring(0, 100)}`);
        }
      }
      
      // Save for analysis
      require('fs').writeFileSync('source-testing/multimovies-redirect-response.html', redirectHtml);
      console.log('\nSaved to multimovies-redirect-response.html');
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
    console.log(e.stack);
  }
}

main().catch(console.error);
