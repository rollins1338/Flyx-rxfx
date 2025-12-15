/**
 * Test MultiMovies router endpoint
 */

async function main() {
  console.log('=== TESTING MULTIMOVIES ROUTER ===\n');
  
  const tmdbId = '155';
  
  // First, get the parameters from the embed page
  const embedResp = await fetch(`https://multimovies.cloud/embed/movie/${tmdbId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://multimovies.cloud/',
    }
  });
  
  const embedHtml = await embedResp.text();
  
  // Extract the base64 parameters - it's in the format atob("...")
  const base64Match = embedHtml.match(/atob\(["']([^"']+)["']\)/);
  if (!base64Match) {
    console.log('No base64 parameters found');
    return;
  }
  
  const base64Params = base64Match[1];
  console.log(`Base64 params: ${base64Params.substring(0, 50)}...`);
  
  // Decode
  const params = JSON.parse(Buffer.from(base64Params, 'base64').toString());
  console.log('\nDecoded params:');
  console.log(JSON.stringify(params, null, 2));
  
  // Add required fields
  params.parameters.adBlockingDetected = false;
  params.parameters.timezoneBrowser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  params.parameters.webdriver = false;
  params.parameters.gpu = null;
  
  console.log('\n\n=== CALLING ROUTER ===\n');
  
  // Call the router
  const routerUrl = `https://router.parklogic.com/embed/movie/${tmdbId}`;
  console.log(`URL: ${routerUrl}`);
  
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
    
    console.log(`Status: ${routerResp.status}`);
    const text = await routerResp.text();
    console.log(`Response length: ${text.length}`);
    console.log(`Response: ${text.substring(0, 500)}`);
    
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
      
      // Look for stream URLs
      const streamUrls = redirectHtml.match(/https?:\/\/[^\s"'<>]+(?:m3u8|mp4)[^\s"'<>]*/gi);
      if (streamUrls) {
        console.log('\nStream URLs found:');
        for (const u of streamUrls) {
          console.log(`  ${u}`);
        }
      }
      
      // Save for analysis
      require('fs').writeFileSync('source-testing/multimovies-redirect-response.html', redirectHtml);
      console.log('\nSaved to multimovies-redirect-response.html');
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

main().catch(console.error);
