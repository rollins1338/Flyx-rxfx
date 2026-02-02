#!/usr/bin/env node
/**
 * Debug JJK TMDB mapping
 */

async function test() {
  const tmdbKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!tmdbKey) {
    console.log('TMDB API key not set');
    return;
  }
  
  // Check TMDB ID 57658 (the one from the URL)
  console.log('=== TMDB ID 57658 ===\n');
  const resp1 = await fetch(`https://api.themoviedb.org/3/tv/57658?api_key=${tmdbKey}`);
  const data1 = await resp1.json();
  console.log('Name:', data1.name);
  console.log('Original Name:', data1.original_name);
  console.log('Original Language:', data1.original_language);
  console.log('First Air Date:', data1.first_air_date);
  console.log('Seasons:', data1.number_of_seasons);
  console.log('Episodes:', data1.number_of_episodes);
  
  // Check main JJK show (95479)
  console.log('\n=== TMDB ID 95479 (Main JJK) ===\n');
  const resp2 = await fetch(`https://api.themoviedb.org/3/tv/95479?api_key=${tmdbKey}`);
  const data2 = await resp2.json();
  console.log('Name:', data2.name);
  console.log('Original Name:', data2.original_name);
  console.log('Seasons:', data2.number_of_seasons);
  console.log('Episodes:', data2.number_of_episodes);
  
  // Check ARM mapping for 57658
  console.log('\n=== ARM Mapping for TMDB 57658 ===\n');
  const armResp = await fetch(`https://arm.haglund.dev/api/v2/ids?source=tmdb&id=57658`);
  const armData = await armResp.json();
  console.log('MAL ID:', armData.mal);
  console.log('AniList ID:', armData.anilist);
  
  // Check ARM mapping for 95479
  console.log('\n=== ARM Mapping for TMDB 95479 ===\n');
  const armResp2 = await fetch(`https://arm.haglund.dev/api/v2/ids?source=tmdb&id=95479`);
  const armData2 = await armResp2.json();
  console.log('MAL ID:', armData2.mal);
  console.log('AniList ID:', armData2.anilist);
}

test().catch(console.error);
