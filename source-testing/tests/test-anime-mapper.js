/**
 * Test Anime ID Mapper
 * 
 * Run: node source-testing/tests/test-anime-mapper.js
 */

const mapper = require('../extractors/anime-id-mapper');

async function main() {
  console.log('========================================');
  console.log('  Anime ID Mapper Test');
  console.log('========================================\n');
  
  // Test cases - popular anime with known TMDB IDs
  const testCases = [
    { tmdbId: 85937, title: 'Demon Slayer', year: 2019 },
    { tmdbId: 31911, title: 'Naruto', year: 2002 },
    { tmdbId: 37854, title: 'One Piece', year: 1999 },
    { tmdbId: 1429, title: 'Attack on Titan', year: 2013 },
    { tmdbId: 114410, title: 'Jujutsu Kaisen', year: 2020 },
  ];
  
  console.log('--- Testing getAnimeIds ---\n');
  
  for (const test of testCases) {
    console.log(`\nLooking up: ${test.title} (TMDB: ${test.tmdbId})`);
    console.log('-'.repeat(50));
    
    const result = await mapper.getAnimeIds(test.tmdbId, test.title, test.year);
    
    console.log('Result:', {
      mal_id: result.mal_id,
      anilist_id: result.anilist_id,
      title: result.title,
      source: result.source,
    });
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n--- Testing AniList Direct Search ---\n');
  
  const anilistResults = await mapper.anilist.search('Spy x Family');
  console.log('AniList search "Spy x Family":');
  anilistResults.slice(0, 3).forEach(r => {
    console.log(`  - ${r.title.english || r.title.romaji} (AniList: ${r.id}, MAL: ${r.idMal})`);
  });
  
  console.log('\n--- Testing ARM Direct Lookup ---\n');
  
  // Try ARM with a known TMDB ID
  const armResult = await mapper.arm.lookup('themoviedb', 85937);
  console.log('ARM lookup TMDB 85937 (Demon Slayer):', armResult);
  
  console.log('\n========================================');
  console.log('  Test Complete');
  console.log('========================================\n');
}

main().catch(console.error);
