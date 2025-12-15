/**
 * Get raw dude.php response to analyze
 */

async function main() {
  const url = 'https://embed.smashystream.com/dude.php?imdb=tt0468569';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://smashystream.com/',
    }
  });
  
  const html = await response.text();
  console.log('=== RAW RESPONSE ===\n');
  console.log(html);
  console.log('\n=== END ===');
}

main().catch(console.error);
