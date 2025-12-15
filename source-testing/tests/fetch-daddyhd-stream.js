/**
 * Fetch the actual stream embed page (stream-51.php)
 * This is where the HLS player is initialized
 */

const https = require('https');
const fs = require('fs');

const CHANNEL = 51;
const STREAM_URL = `https://daddyhd.com/stream/stream-${CHANNEL}.php`;

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
  console.log('Fetching daddyhd stream embed page...\n');
  console.log('URL:', STREAM_URL);
  
  try {
    const result = await fetch(STREAM_URL, 'https://daddyhd.com/watch.php?id=51');
    console.log('Status:', result.status);
    console.log('Content-Length:', result.data.length);
    
    // Save the full HTML
    fs.writeFileSync('source-testing/results/daddyhd-stream.html', result.data);
    console.log('\nSaved to: source-testing/results/daddyhd-stream.html');
    
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
        console.log(content.substring(0, 1000));
        if (content.length > 1000) console.log('...[truncated]');
        
        // Save each script
        fs.writeFileSync(`source-testing/results/daddyhd-stream-script-${i + 1}.js`, content);
      }
    });
    
    // Look for HLS.js or video player initialization
    const hlsMatches = result.data.match(/Hls|hls\.js|loadSource|attachMedia/gi) || [];
    console.log('\n=== HLS.js References ===');
    console.log('Found:', hlsMatches.length, 'references');
    
    // Look for m3u8 or key URLs
    const urlMatches = result.data.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    const streamUrls = urlMatches.filter(u => 
      u.includes('m3u8') || u.includes('mono.css') || u.includes('key') || 
      u.includes('kiko2') || u.includes('giokko') || u.includes('server_lookup')
    );
    if (streamUrls.length > 0) {
      console.log('\n=== Stream URLs ===');
      [...new Set(streamUrls)].forEach(url => console.log(url));
    }
    
    // Look for epicplayplay.cfd references
    const epicMatches = result.data.match(/epicplayplay[^\s"'<>]*/gi) || [];
    if (epicMatches.length > 0) {
      console.log('\n=== epicplayplay References ===');
      [...new Set(epicMatches)].forEach(m => console.log(m));
    }
    
    // Look for any iframe
    const iframeMatch = result.data.match(/<iframe[^>]*src=["']([^"']+)["']/i);
    if (iframeMatch) {
      console.log('\n=== Nested Iframe ===');
      console.log(iframeMatch[1]);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
