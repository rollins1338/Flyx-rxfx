/**
 * Fetch and analyze the daddyhd watch.php page
 * Looking for how they generate key URLs and handle authentication
 */

const https = require('https');

const CHANNEL = 51;
const WATCH_URL = `https://daddyhd.com/watch.php?id=${CHANNEL}`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching daddyhd watch.php page...\n');
  console.log('URL:', WATCH_URL);
  
  try {
    const result = await fetch(WATCH_URL);
    console.log('Status:', result.status);
    console.log('Content-Length:', result.data.length);
    
    // Save the full HTML
    require('fs').writeFileSync('source-testing/results/daddyhd-watch.html', result.data);
    console.log('\nSaved to: source-testing/results/daddyhd-watch.html');
    
    // Extract all script tags
    const scriptMatches = result.data.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    console.log('\nFound', scriptMatches.length, 'script tags');
    
    // Look for inline scripts (not src)
    const inlineScripts = scriptMatches.filter(s => !s.includes('src='));
    console.log('Inline scripts:', inlineScripts.length);
    
    // Extract and analyze each inline script
    inlineScripts.forEach((script, i) => {
      const content = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
      if (content.length > 50) {
        console.log(`\n=== Inline Script ${i + 1} (${content.length} chars) ===`);
        console.log(content.substring(0, 500));
        if (content.length > 500) console.log('...[truncated]');
        
        // Save each script
        require('fs').writeFileSync(`source-testing/results/daddyhd-script-${i + 1}.js`, content);
      }
    });
    
    // Look for iframe src (embed URL)
    const iframeMatch = result.data.match(/<iframe[^>]*src=["']([^"']+)["']/i);
    if (iframeMatch) {
      console.log('\n=== Iframe Embed URL ===');
      console.log(iframeMatch[1]);
    }
    
    // Look for any URLs containing key, m3u8, or stream
    const urlMatches = result.data.match(/https?:\/\/[^\s"'<>]+(?:key|m3u8|stream|mono\.css)[^\s"'<>]*/gi) || [];
    if (urlMatches.length > 0) {
      console.log('\n=== Stream-related URLs ===');
      urlMatches.forEach(url => console.log(url));
    }
    
    // Look for server_lookup or server_key references
    const serverKeyMatches = result.data.match(/server[_-]?(?:key|lookup)[^\n]*/gi) || [];
    if (serverKeyMatches.length > 0) {
      console.log('\n=== Server Key References ===');
      serverKeyMatches.forEach(m => console.log(m.substring(0, 200)));
    }
    
    // Look for any obfuscated code patterns
    const obfuscatedPatterns = [
      /eval\s*\(/gi,
      /atob\s*\(/gi,
      /btoa\s*\(/gi,
      /String\.fromCharCode/gi,
      /\[["'][a-z]+["']\]/gi,
      /0x[0-9a-f]+/gi,
    ];
    
    console.log('\n=== Obfuscation Patterns ===');
    obfuscatedPatterns.forEach(pattern => {
      const matches = result.data.match(pattern) || [];
      if (matches.length > 0) {
        console.log(`${pattern}: ${matches.length} matches`);
      }
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
