/**
 * Test alternative embed providers that might have accessible APIs
 * Looking for providers similar to Videasy that have direct API access
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TMDB_ID = '550'; // Fight Club

// List of potential embed providers to test
const PROVIDERS = [
  // VidSrc variants
  { name: 'VidSrc.pro', embedUrl: `https://vidsrc.pro/embed/movie/${TMDB_ID}` },
  { name: 'VidSrc.cc', embedUrl: `https://vidsrc.cc/v2/embed/movie/${TMDB_ID}` },
  { name: 'VidSrc.xyz', embedUrl: `https://vidsrc.xyz/embed/movie/${TMDB_ID}` },
  { name: 'VidSrc.in', embedUrl: `https://vidsrc.in/embed/movie/${TMDB_ID}` },
  { name: 'VidSrc.me', embedUrl: `https://vidsrc.me/embed/movie/${TMDB_ID}` },
  
  // 2embed variants
  { name: '2embed.cc', embedUrl: `https://2embed.cc/embed/${TMDB_ID}` },
  { name: '2embed.org', embedUrl: `https://2embed.org/embed/${TMDB_ID}` },
  
  // Autoembed
  { name: 'Autoembed', embedUrl: `https://autoembed.cc/embed/movie/${TMDB_ID}` },
  
  // Moviesapi
  { name: 'MoviesAPI', embedUrl: `https://moviesapi.club/movie/${TMDB_ID}` },
  
  // Superembed
  { name: 'Superembed', embedUrl: `https://multiembed.mov/directstream.php?video_id=${TMDB_ID}&tmdb=1` },
  
  // Embed.su
  { name: 'Embed.su', embedUrl: `https://embed.su/embed/movie/${TMDB_ID}` },
  
  // Nontongo
  { name: 'Nontongo', embedUrl: `https://www.nontongo.win/embed/movie/${TMDB_ID}` },
  
  // Rive
  { name: 'Rive', embedUrl: `https://rivestream.live/embed?type=movie&id=${TMDB_ID}` },
  
  // Vidsrc.rip
  { name: 'VidSrc.rip', embedUrl: `https://vidsrc.rip/embed/movie/${TMDB_ID}` },
];

async function testProvider(provider) {
  console.log(`\n=== ${provider.name} ===`);
  console.log(`URL: ${provider.embedUrl}`);
  
  try {
    const response = await fetch(provider.embedUrl, {
      headers: HEADERS,
      redirect: 'follow'
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Final URL: ${response.url}`);
    
    if (!response.ok) {
      return { name: provider.name, status: 'error', code: response.status };
    }
    
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Check for common patterns
    const patterns = {
      hasM3U8: html.includes('.m3u8'),
      hasMP4: html.includes('.mp4'),
      hasSource: html.includes('source') || html.includes('sources'),
      hasPlayer: html.includes('player') || html.includes('Player'),
      hasAPI: html.includes('/api/') || html.includes('api.'),
      hasEncrypted: /[A-Za-z0-9+/=]{100,}/.test(html),
      isCloudflare: html.includes('cloudflare') || html.includes('cf-'),
      isReact: html.includes('__NEXT_DATA__') || html.includes('react'),
      isSvelte: html.includes('svelte'),
    };
    
    console.log('Patterns:', patterns);
    
    // Look for API URLs
    const apiPattern = /["'](https?:\/\/[^"']*api[^"']*)["']/gi;
    const apis = [];
    let match;
    while ((match = apiPattern.exec(html)) !== null) {
      if (!match[1].includes('google') && !match[1].includes('cloudflare')) {
        apis.push(match[1]);
      }
    }
    if (apis.length > 0) {
      console.log('API URLs found:', apis.slice(0, 5));
    }
    
    // Look for direct stream URLs
    const streamPattern = /["'](https?:\/\/[^"']*(?:\.m3u8|\.mp4)[^"']*)["']/gi;
    const streams = [];
    while ((match = streamPattern.exec(html)) !== null) {
      streams.push(match[1]);
    }
    if (streams.length > 0) {
      console.log('Stream URLs found:', streams.slice(0, 3));
    }
    
    return { 
      name: provider.name, 
      status: 'ok', 
      length: html.length,
      patterns,
      apis: apis.slice(0, 5),
      streams: streams.slice(0, 3)
    };
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return { name: provider.name, status: 'error', error: error.message };
  }
}

async function main() {
  console.log('=== TESTING ALTERNATIVE EMBED PROVIDERS ===\n');
  
  const results = [];
  
  for (const provider of PROVIDERS) {
    const result = await testProvider(provider);
    results.push(result);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log('\nWorking providers (returned HTML):');
  for (const r of results.filter(r => r.status === 'ok')) {
    console.log(`  ${r.name}: ${r.length} chars`);
    if (r.streams?.length > 0) {
      console.log(`    *** HAS DIRECT STREAMS! ***`);
    }
    if (r.apis?.length > 0) {
      console.log(`    Has API URLs`);
    }
  }
  
  console.log('\nFailed providers:');
  for (const r of results.filter(r => r.status === 'error')) {
    console.log(`  ${r.name}: ${r.code || r.error}`);
  }
}

main().catch(console.error);
