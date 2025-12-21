/**
 * Crack Flixer.sh - V15
 * 
 * The embed URLs return 200! Let's analyze them to see if we can
 * extract video sources without needing to decrypt the API response.
 */

const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function analyzeEmbed() {
  console.log('=== Analyze Flixer Embed Pages ===\n');
  
  const embedUrls = [
    { url: 'https://flixer.sh/embed/movie/550', type: 'movie', id: '550' },
    { url: 'https://flixer.sh/embed/tv/106379/1/1', type: 'tv', id: '106379' },
  ];
  
  for (const embed of embedUrls) {
    console.log(`\n=== ${embed.type.toUpperCase()}: ${embed.url} ===\n`);
    
    const res = await fetchUrl(embed.url);
    console.log(`Status: ${res.status}`);
    console.log(`Content length: ${res.data.length} chars`);
    
    // Check for video sources in the HTML
    const m3u8Matches = res.data.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
    const mp4Matches = res.data.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g);
    
    if (m3u8Matches) {
      console.log('\nM3U8 URLs found:');
      m3u8Matches.forEach(url => console.log(`  ${url}`));
    }
    
    if (mp4Matches) {
      console.log('\nMP4 URLs found:');
      mp4Matches.forEach(url => console.log(`  ${url}`));
    }
    
    // Check for iframe sources
    const iframeMatches = res.data.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
    if (iframeMatches) {
      console.log('\nIframe sources:');
      iframeMatches.forEach(match => {
        const src = match.match(/src=["']([^"']+)["']/i);
        if (src) console.log(`  ${src[1]}`);
      });
    }
    
    // Check for script sources that might load the player
    const scriptMatches = res.data.match(/<script[^>]+src=["']([^"']+)["']/gi);
    if (scriptMatches) {
      console.log('\nScript sources:');
      scriptMatches.slice(0, 5).forEach(match => {
        const src = match.match(/src=["']([^"']+)["']/i);
        if (src) console.log(`  ${src[1]}`);
      });
    }
    
    // Check for inline scripts that might contain video data
    const inlineScripts = res.data.match(/<script[^>]*>([^<]+)<\/script>/gi);
    if (inlineScripts) {
      console.log('\nInline scripts with potential video data:');
      inlineScripts.forEach(script => {
        if (script.includes('source') || script.includes('m3u8') || script.includes('video') || script.includes('player')) {
          // Extract just the content
          const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
          if (content.length > 10 && content.length < 500) {
            console.log(`  ${content.substring(0, 200)}...`);
          }
        }
      });
    }
    
    // Check for data attributes
    const dataAttrs = res.data.match(/data-[a-z-]+="[^"]+"/gi);
    if (dataAttrs) {
      const videoDataAttrs = dataAttrs.filter(attr => 
        attr.includes('source') || attr.includes('video') || attr.includes('stream') || attr.includes('url')
      );
      if (videoDataAttrs.length > 0) {
        console.log('\nVideo-related data attributes:');
        videoDataAttrs.forEach(attr => console.log(`  ${attr}`));
      }
    }
    
    // Check for JSON data in the page
    const jsonMatches = res.data.match(/\{[^{}]*"(url|source|file|stream)"[^{}]*\}/g);
    if (jsonMatches) {
      console.log('\nJSON with video references:');
      jsonMatches.slice(0, 3).forEach(json => console.log(`  ${json}`));
    }
    
    // Look for the WASM initialization
    if (res.data.includes('wasm') || res.data.includes('WASM')) {
      console.log('\nWASM references found in page');
    }
    
    // Look for API calls
    const apiCalls = res.data.match(/fetch\s*\([^)]+\)|axios\.[a-z]+\s*\([^)]+\)/gi);
    if (apiCalls) {
      console.log('\nAPI calls:');
      apiCalls.slice(0, 5).forEach(call => console.log(`  ${call.substring(0, 100)}`));
    }
    
    // Save the HTML for manual inspection
    console.log('\n--- First 2000 chars of HTML ---');
    console.log(res.data.substring(0, 2000));
    console.log('\n--- Last 1000 chars of HTML ---');
    console.log(res.data.substring(res.data.length - 1000));
  }
}

async function main() {
  await analyzeEmbed();
}

main().catch(console.error);
