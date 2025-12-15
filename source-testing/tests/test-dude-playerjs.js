/**
 * Analyze the Playerjs setup and try to understand the stream delivery
 */

async function main() {
  // First, let's look at the playerjs script
  console.log('=== FETCHING PLAYERJS SCRIPT ===\n');
  
  try {
    const resp = await fetch('https://player.smashystream.com/js/pljssd6.js', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://embed.smashystream.com/',
      }
    });
    
    console.log(`Status: ${resp.status}`);
    const text = await resp.text();
    console.log(`Length: ${text.length} chars`);
    
    // Look for interesting patterns
    if (text.includes('hls.js')) console.log('Uses hls.js');
    if (text.includes('fetch')) console.log('Uses fetch');
    if (text.includes('XMLHttpRequest')) console.log('Uses XMLHttpRequest');
    if (text.includes('proxy')) console.log('Contains "proxy"');
    if (text.includes('cors')) console.log('Contains "cors"');
    
    // Look for URL patterns
    const urlPatterns = text.match(/https?:\/\/[^\s"'`]+/g);
    if (urlPatterns) {
      console.log('\nURLs found in playerjs:');
      const unique = [...new Set(urlPatterns)];
      for (const u of unique.slice(0, 20)) {
        console.log(`  ${u}`);
      }
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  // Now let's try to access the stream through different methods
  console.log('\n\n=== TESTING STREAM ACCESS METHODS ===\n');
  
  // Get fresh URLs
  const dudeResp = await fetch('https://embed.smashystream.com/dude.php?imdb=tt0468569', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://smashystream.com/',
    }
  });
  
  const html = await dudeResp.text();
  const fileMatch = html.match(/"file"\s*:\s*"(https?:[^"]+)"/);
  
  if (!fileMatch) {
    console.log('No stream URL found');
    return;
  }
  
  const streamUrl = fileMatch[1].replace(/\\\//g, '/');
  console.log(`Stream URL: ${streamUrl.substring(0, 100)}...`);
  
  // Parse the URL components
  const urlParts = streamUrl.match(/^(https?:\/\/[^\/]+)(\/[^:]+):(\d+):([^:]+):([^\/]+)(\/index\.m3u8)$/);
  if (urlParts) {
    console.log('\nURL Components:');
    console.log(`  Host: ${urlParts[1]}`);
    console.log(`  Path: ${urlParts[2]}`);
    console.log(`  Timestamp: ${urlParts[3]}`);
    console.log(`  IP: ${urlParts[4]}`);
    console.log(`  Token: ${urlParts[5]}`);
  }
  
  // Try different referers
  const referers = [
    'https://embed.smashystream.com/',
    'https://player.smashystream.com/',
    'https://smashystream.com/',
    'https://player.smashy.stream/',
    null,
  ];
  
  for (const referer of referers) {
    console.log(`\nTrying referer: ${referer || 'none'}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (referer) {
      headers['Referer'] = referer;
      headers['Origin'] = referer.replace(/\/$/, '');
    }
    
    try {
      const resp = await fetch(streamUrl, { headers });
      console.log(`  Status: ${resp.status}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Try the base domain directly
  console.log('\n\n=== TESTING STREAM HOST ===\n');
  
  const streamHost = streamUrl.match(/^(https?:\/\/[^\/]+)/)[1];
  console.log(`Stream host: ${streamHost}`);
  
  try {
    const resp = await fetch(streamHost, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    console.log(`Status: ${resp.status}`);
    const text = await resp.text();
    console.log(`Response: ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

main().catch(console.error);
