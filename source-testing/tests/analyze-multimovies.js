/**
 * Analyze MultiMovies response in detail
 */

async function main() {
  console.log('=== ANALYZING MULTIMOVIES RESPONSE ===\n');
  
  const url = 'https://multimovies.cloud/embed/movie/155';
  
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://multimovies.cloud/',
    }
  });
  
  const html = await resp.text();
  console.log('=== RAW RESPONSE ===\n');
  console.log(html);
  console.log('\n=== END ===\n');
  
  // Extract all URLs
  const urls = html.match(/https?:\/\/[^\s"'<>]+/g);
  if (urls) {
    console.log('\nURLs found:');
    const unique = [...new Set(urls)];
    for (const u of unique) {
      console.log(`  ${u}`);
    }
  }
  
  // Look for base64 data
  const base64 = html.match(/[A-Za-z0-9+/=]{50,}/g);
  if (base64) {
    console.log('\nBase64-like strings:');
    for (const b of base64) {
      console.log(`  ${b.substring(0, 80)}... (${b.length} chars)`);
      
      // Try to decode
      try {
        const decoded = Buffer.from(b, 'base64').toString();
        if (decoded.length > 10 && !decoded.includes('\ufffd')) {
          console.log(`    Decoded: ${decoded.substring(0, 100)}`);
        }
      } catch (e) {}
    }
  }
  
  // Look for script content
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptMatch) {
    console.log('\nScript contents:');
    for (const script of scriptMatch) {
      const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
      if (content.length > 0) {
        console.log(`  ${content.substring(0, 200)}`);
      }
    }
  }
}

main().catch(console.error);
