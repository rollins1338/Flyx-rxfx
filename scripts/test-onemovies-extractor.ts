/**
 * Test the 1movies/yflix extractor service
 */

const { extractOneMovies } = require('../app/lib/services/onemovies-extractor');

async function main() {
  console.log('=== Testing 1movies/yflix Extractor Service ===\n');
  
  // Test TV Show
  console.log('--- Test 1: TV Show (Cyberpunk Edgerunners) ---\n');
  const tvResult = await extractOneMovies('cyberpunk edgerunners', { season: 1, episode: 1 });
  
  if (tvResult) {
    console.log('Title:', tvResult.title);
    console.log('Type:', tvResult.type);
    console.log('Content ID:', tvResult.contentId);
    console.log('Servers:');
    tvResult.servers.forEach((s: any) => console.log(`  - ${s.name}: ${s.embedUrl.substring(0, 70)}...`));
    console.log('Subtitles:', tvResult.subtitles?.length || 0, 'languages');
  } else {
    console.log('Failed to extract TV show');
  }
  
  console.log('\n--- Test 2: Movie (FNAF) ---\n');
  const movieResult = await extractOneMovies('five nights at freddys');
  
  if (movieResult) {
    console.log('Title:', movieResult.title);
    console.log('Type:', movieResult.type);
    console.log('Content ID:', movieResult.contentId);
    console.log('Servers:');
    movieResult.servers.forEach((s: any) => console.log(`  - ${s.name}: ${s.embedUrl.substring(0, 70)}...`));
    console.log('Subtitles:', movieResult.subtitles?.length || 0, 'languages');
  } else {
    console.log('Failed to extract movie');
  }
}

main().catch(console.error);
