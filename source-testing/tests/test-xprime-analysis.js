/**
 * Analyze XPrime.tv response
 */

async function main() {
  console.log('=== ANALYZING XPRIME.TV ===\n');
  
  const url = 'https://xprime.tv/embed/movie/155';
  
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://xprime.tv/',
    }
  });
  
  console.log(`Status: ${resp.status}`);
  const html = await resp.text();
  console.log(`Length: ${html.length}`);
  
  // Check if it's a SPA
  if (html.includes('__NUXT__') || html.includes('__NEXT_DATA__')) {
    console.log('Detected: Next.js/Nuxt.js SPA');
  }
  
  if (html.includes('svelte')) {
    console.log('Detected: Svelte SPA');
  }
  
  // Look for API endpoints in the HTML
  const apiMatches = html.match(/https?:\/\/[^\s"'<>]+api[^\s"'<>]*/gi);
  if (apiMatches) {
    console.log('\nAPI URLs found:');
    const unique = [...new Set(apiMatches)];
    for (const u of unique.slice(0, 10)) {
      console.log(`  ${u}`);
    }
  }
  
  // Look for script sources
  const scriptSrcs = html.match(/src="([^"]+\.js[^"]*)"/gi);
  if (scriptSrcs) {
    console.log('\nScript sources:');
    for (const s of scriptSrcs.slice(0, 10)) {
      console.log(`  ${s}`);
    }
  }
  
  // Look for any interesting patterns
  const patterns = [
    { name: 'tmdb', pattern: /tmdb/gi },
    { name: 'imdb', pattern: /imdb/gi },
    { name: 'stream', pattern: /stream/gi },
    { name: 'source', pattern: /source/gi },
    { name: 'player', pattern: /player/gi },
    { name: 'video', pattern: /video/gi },
    { name: 'embed', pattern: /embed/gi },
  ];
  
  console.log('\nPattern matches:');
  for (const { name, pattern } of patterns) {
    const matches = html.match(pattern);
    console.log(`  ${name}: ${matches ? matches.length : 0}`);
  }
  
  // Save first 5000 chars for analysis
  console.log('\n\n=== FIRST 3000 CHARS ===\n');
  console.log(html.substring(0, 3000));
}

main().catch(console.error);
