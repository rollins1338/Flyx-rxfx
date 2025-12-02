// Debug MoviesAPI extraction

async function testMoviesApi() {
  // Test with Fight Club (550)
  const clubUrl = 'https://moviesapi.club/movie/550';
  console.log('Fetching:', clubUrl);
  
  const res = await fetch(clubUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await res.text();
  console.log('Status:', res.status);
  console.log('HTML length:', html.length);
  
  // Find all iframes
  const iframeRegex = /iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  console.log('\nIframes found:');
  while ((match = iframeRegex.exec(html)) !== null) {
    console.log('  -', match[1]);
  }
  
  // Find vidora specifically
  const vidoraMatch = html.match(/src=["'](https:\/\/vidora\.stream\/embed\/[^"']+)["']/);
  console.log('\nVidora match:', vidoraMatch ? vidoraMatch[1] : 'NOT FOUND');
  
  // Check for other embed sources
  const embedPatterns = [
    /vidsrc/i,
    /vidora/i,
    /embed/i,
    /player/i,
    /stream/i
  ];
  
  console.log('\nEmbed patterns found:');
  for (const pattern of embedPatterns) {
    if (pattern.test(html)) {
      console.log('  ✓', pattern.source);
    }
  }
  
  // Show HTML snippet
  console.log('\n--- HTML Preview (first 2000 chars) ---');
  console.log(html.substring(0, 2000));
}

testMoviesApi().catch(console.error);
