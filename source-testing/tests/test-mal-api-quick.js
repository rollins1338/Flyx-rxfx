/**
 * Quick test for MAL API search
 */

async function test() {
  const query = 'Bleach Sennen Kessen';
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5&order_by=members&sort=desc`;
  
  console.log('Searching MAL for:', query);
  console.log('URL:', url);
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('\nResults:', data.data?.length || 0);
  
  if (data.data) {
    data.data.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   English: ${r.title_english || 'N/A'}`);
      console.log(`   MAL ID: ${r.mal_id}`);
      console.log(`   Episodes: ${r.episodes}`);
      console.log(`   Type: ${r.type}`);
      console.log('');
    });
  }
}

test().catch(console.error);
