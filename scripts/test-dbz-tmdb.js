/**
 * Test TMDB data for Dragon Ball Z
 */
const https = require('https');

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '2e0c0e0e0e0e0e0e0e0e0e0e0e0e0e0e'; // placeholder

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { 
        try { resolve(JSON.parse(data)); } 
        catch(e) { resolve({ error: e.message, raw: data }); } 
      });
    }).on('error', reject);
  });
}

async function main() {
  // Dragon Ball Z TMDB ID
  const tmdbId = '12971';
  
  console.log('=== Dragon Ball Z TMDB Data ===\n');
  
  // Get show info
  const showUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
  console.log(`Fetching: ${showUrl}\n`);
  
  const show = await fetchJson(showUrl);
  
  if (show.error) {
    console.log('Error:', show.error);
    console.log('Raw:', show.raw?.substring(0, 200));
    console.log('\nNote: Set NEXT_PUBLIC_TMDB_API_KEY environment variable');
    return;
  }
  
  console.log(`Name: ${show.name}`);
  console.log(`Original Name: ${show.original_name}`);
  console.log(`First Air Date: ${show.first_air_date}`);
  console.log(`Number of Seasons: ${show.number_of_seasons}`);
  console.log(`Number of Episodes: ${show.number_of_episodes}`);
  console.log(`Original Language: ${show.original_language}`);
  
  console.log('\n=== Seasons ===');
  
  if (show.seasons) {
    let totalEpisodes = 0;
    for (const season of show.seasons) {
      if (season.season_number > 0) { // Skip specials
        console.log(`Season ${season.season_number}: ${season.episode_count} episodes (${season.name})`);
        totalEpisodes += season.episode_count;
      }
    }
    console.log(`\nTotal (excluding specials): ${totalEpisodes} episodes`);
    
    // Calculate what episode S5E1 would be in absolute numbering
    console.log('\n=== Absolute Episode Calculation ===');
    let absoluteEp = 0;
    for (const season of show.seasons) {
      if (season.season_number > 0 && season.season_number < 5) {
        absoluteEp += season.episode_count;
        console.log(`After S${season.season_number}: ${absoluteEp} episodes`);
      }
    }
    console.log(`\nS5E1 = Absolute Episode ${absoluteEp + 1}`);
  }
}

main().catch(console.error);
