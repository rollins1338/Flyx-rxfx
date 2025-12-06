/**
 * Analyze vidsrc.to embed page structure
 */

const https = require('https');

const EMBED_URL = 'https://vidsrc.to/embed/movie/1228246';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://vidsrc.to/'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function analyze() {
  console.log('=== Analyzing vidsrc.to ===\n');
  console.log('URL:', EMBED_URL);
  
  try {
    const res = await fetch(EMBED_URL);
    console.log('Status:', res.status);
    console.log('Content length:', res.body.length);
    
    // Save full HTML
    require('fs').writeFileSync('vidsrc-to-embed.html', res.body);
    console.log('Saved to vidsrc-to-embed.html');
    
    // Look for patterns
    console.log('\n=== Pattern Analysis ===');
    
    // Iframes
    const iframes = res.body.match(/<iframe[^>]*src="([^"]+)"/gi);
    console.log('Iframes:', iframes);
    
    // Scripts
    const scripts = res.body.match(/<script[^>]*src="([^"]+)"/gi);
    console.log('External scripts:', scripts?.slice(0, 5));
    
    // Data attributes
    const dataAttrs = res.body.match(/data-[a-z-]+="[^"]+"/gi);
    console.log('Data attributes:', dataAttrs?.slice(0, 10));
    
    // API endpoints
    const apiEndpoints = res.body.match(/["']\/[a-z]+\/[^"']+["']/gi);
    console.log('API endpoints:', apiEndpoints?.slice(0, 10));
    
    // Look for hash/id patterns
    const hashes = res.body.match(/[a-f0-9]{32,}/gi);
    console.log('Hashes found:', hashes?.slice(0, 5));
    
    // Look for embed URLs
    const embedUrls = res.body.match(/https?:\/\/[^"'\s]+embed[^"'\s]*/gi);
    console.log('Embed URLs:', embedUrls?.slice(0, 5));
    
    // Look for player URLs
    const playerUrls = res.body.match(/https?:\/\/[^"'\s]+player[^"'\s]*/gi);
    console.log('Player URLs:', playerUrls?.slice(0, 5));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyze();
