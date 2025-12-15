/**
 * Fetch the epicplayplay.cfd player page
 * This is where the actual HLS player is initialized
 */

const https = require('https');
const fs = require('fs');

const CHANNEL = 51;
const PLAYER_URL = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${CHANNEL}`;

function fetch(url, referer) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer || 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching epicplayplay.cfd player page...\n');
  console.log('URL:', PLAYER_URL);
  
  try {
    const result = await fetch(PLAYER_URL, 'https://daddyhd.com/stream/stream-51.php');
    console.log('Status:', result.status);
    console.log('Content-Length:', result.data.length);
    
    // Save the full HTML
    fs.writeFileSync('source-testing/results/epicplayplay-player.html', result.data);
    console.log('\nSaved to: source-testing/results/epicplayplay-player.html');
    
    // Extract all script tags
    const scriptMatches = result.data.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    console.log('\nFound', scriptMatches.length, 'script tags');
    
    // Look for external script sources
    const srcMatches = result.data.match(/src=["']([^"']+\.js[^"']*)["']/gi) || [];
    console.log('\nExternal scripts:');
    srcMatches.forEach(s => console.log('  ', s));
    
    // Look for inline scripts
    const inlineScripts = scriptMatches.filter(s => !s.includes('src='));
    console.log('\nInline scripts:', inlineScripts.length);
    
    inlineScripts.forEach((script, i) => {
      const content = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
      if (content.length > 50) {
        console.log(`\n=== Inline Script ${i + 1} (${content.length} chars) ===`);
        console.log(content.substring(0, 2000));
        if (content.length > 2000) console.log('...[truncated]');
        
        // Save each script
        fs.writeFileSync(`source-testing/results/epicplayplay-script-${i + 1}.js`, content);
      }
    });
    
    // Look for HLS.js configuration
    const hlsConfigMatch = result.data.match(/new\s+Hls\s*\([^)]*\)/gi);
    if (hlsConfigMatch) {
      console.log('\n=== HLS.js Initialization ===');
      hlsConfigMatch.forEach(m => console.log(m.substring(0, 500)));
    }
    
    // Look for loadSource calls
    const loadSourceMatch = result.data.match(/loadSource\s*\([^)]+\)/gi);
    if (loadSourceMatch) {
      console.log('\n=== loadSource Calls ===');
      loadSourceMatch.forEach(m => console.log(m));
    }
    
    // Look for server_lookup
    const serverLookupMatch = result.data.match(/server_lookup[^\n]*/gi);
    if (serverLookupMatch) {
      console.log('\n=== server_lookup References ===');
      serverLookupMatch.forEach(m => console.log(m.substring(0, 200)));
    }
    
    // Look for key-related code
    const keyMatches = result.data.match(/(?:key|KEY)[^\n]{0,100}/gi) || [];
    const relevantKeyMatches = keyMatches.filter(m => 
      m.includes('URI') || m.includes('url') || m.includes('fetch') || 
      m.includes('load') || m.includes('request')
    );
    if (relevantKeyMatches.length > 0) {
      console.log('\n=== Key-related Code ===');
      relevantKeyMatches.slice(0, 10).forEach(m => console.log(m.substring(0, 150)));
    }
    
    // Look for m3u8 URLs
    const m3u8Matches = result.data.match(/https?:\/\/[^\s"'<>]*(?:m3u8|mono\.css)[^\s"'<>]*/gi) || [];
    if (m3u8Matches.length > 0) {
      console.log('\n=== M3U8 URLs ===');
      [...new Set(m3u8Matches)].forEach(url => console.log(url));
    }
    
    // Look for kiko2.ru or giokko.ru references
    const cdnMatches = result.data.match(/(?:kiko2|giokko)\.ru[^\s"'<>]*/gi) || [];
    if (cdnMatches.length > 0) {
      console.log('\n=== CDN References ===');
      [...new Set(cdnMatches)].forEach(m => console.log(m));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
