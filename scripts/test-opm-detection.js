#!/usr/bin/env node
/**
 * Test One Punch Man anime detection and extraction
 */

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '54b8a1f8e00b1f5a6c8e9d2c3f4a5b6c';

async function testOPM() {
  // One Punch Man TMDB ID
  const tmdbId = '30983';
  const type = 'tv';
  
  console.log('=== Testing One Punch Man Detection ===\n');
  
  // Check TMDB data
  console.log('1. Fetching TMDB data...');
  const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  const tmdbResponse = await fetch(tmdbUrl);
  const tmdbData = await tmdbResponse.json();
  
  console.log(`   Title: ${tmdbData.name}`);
  console.log(`   Original Language: ${tmdbData.original_language}`);
  console.log(`   Genres: ${tmdbData.genres?.map(g => `${g.name} (${g.id})`).join(', ')}`);
  
  const hasAnimationGenre = tmdbData.genres?.some(g => g.id === 16);
  const isJapanese = tmdbData.original_language === 'ja';
  const isAnime = hasAnimationGenre && isJapanese;
  
  console.log(`\n   Animation genre (16): ${hasAnimationGenre}`);
  console.log(`   Japanese: ${isJapanese}`);
  console.log(`   → Is Anime: ${isAnime}`);
  
  // Test the extract API
  console.log('\n2. Testing extract API with provider=auto...');
  const extractUrl = `http://localhost:3000/api/stream/extract?tmdbId=${tmdbId}&type=${type}&season=1&episode=1`;
  console.log(`   URL: ${extractUrl}`);
  
  try {
    const extractResponse = await fetch(extractUrl);
    const extractData = await extractResponse.json();
    
    console.log(`\n   Response:`);
    console.log(`   - Success: ${extractData.success}`);
    console.log(`   - Provider: ${extractData.provider}`);
    console.log(`   - Sources: ${extractData.sources?.length || 0}`);
    
    if (extractData.sources?.length > 0) {
      console.log(`   - First source: ${extractData.sources[0].title}`);
      console.log(`   - URL: ${extractData.sources[0].url?.substring(0, 80)}...`);
    }
    
    if (extractData.error) {
      console.log(`   - Error: ${extractData.error}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
    console.log('   (Make sure the dev server is running on localhost:3000)');
  }
  
  // Test with explicit animekai provider
  console.log('\n3. Testing extract API with provider=animekai...');
  const animeKaiUrl = `http://localhost:3000/api/stream/extract?tmdbId=${tmdbId}&type=${type}&season=1&episode=1&provider=animekai`;
  
  try {
    const akResponse = await fetch(animeKaiUrl);
    const akData = await akResponse.json();
    
    console.log(`\n   Response:`);
    console.log(`   - Success: ${akData.success}`);
    console.log(`   - Provider: ${akData.provider}`);
    console.log(`   - Sources: ${akData.sources?.length || 0}`);
    
    if (akData.sources?.length > 0) {
      console.log(`   - First source: ${akData.sources[0].title}`);
      console.log(`   - URL: ${akData.sources[0].url?.substring(0, 80)}...`);
    }
    
    if (akData.error) {
      console.log(`   - Error: ${akData.error}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test RPI directly
  console.log('\n4. Testing RPI full-extract directly...');
  const RPI_URL = 'https://rpi-proxy.vynx.cc';
  const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
  
  // First we need to find the kai_id for One Punch Man
  // Search AnimeKai
  const searchUrl = `https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent('One Punch Man')}`;
  const searchResponse = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const searchData = await searchResponse.json();
  
  // Extract kai_id from search results
  const slugMatch = searchData.result?.html?.match(/href="\/watch\/([^"]+)"/);
  if (slugMatch) {
    const slug = slugMatch[1];
    console.log(`   Found slug: ${slug}`);
    
    // Fetch watch page to get kai_id
    const watchUrl = `https://animekai.to/watch/${slug}`;
    const watchResponse = await fetch(watchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const watchHtml = await watchResponse.text();
    
    // Extract kai_id from syncData
    const syncDataMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/i);
    if (syncDataMatch) {
      const syncData = JSON.parse(syncDataMatch[1]);
      const kaiId = syncData.anime_id;
      console.log(`   Found kai_id: ${kaiId}`);
      
      // Test RPI full-extract
      const rpiUrl = `${RPI_URL}/animekai/full-extract?key=${RPI_KEY}&kai_id=${kaiId}&episode=1`;
      console.log(`   RPI URL: ${rpiUrl}`);
      
      const rpiResponse = await fetch(rpiUrl);
      const rpiData = await rpiResponse.json();
      
      console.log(`\n   RPI Response:`);
      console.log(`   - Success: ${rpiData.success}`);
      if (rpiData.streamUrl) {
        console.log(`   - Stream URL: ${rpiData.streamUrl.substring(0, 80)}...`);
      }
      if (rpiData.error) {
        console.log(`   - Error: ${rpiData.error}`);
        console.log(`   - Details: ${JSON.stringify(rpiData.debug || rpiData.details || {})}`);
      }
    }
  } else {
    console.log('   Could not find One Punch Man on AnimeKai');
  }
}

testOPM().catch(console.error);
