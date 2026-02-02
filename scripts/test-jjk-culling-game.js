#!/usr/bin/env node
/**
 * Test JJK Culling Game extraction with the exact parameters
 * that would be passed from the anime watch page
 */

const loadCrypto = async () => {
  try {
    return await import('../app/lib/animekai-crypto.ts');
  } catch {
    console.log('Note: Run with "npx tsx" for TypeScript support');
    process.exit(1);
  }
};

async function test() {
  const { encryptAnimeKai, decryptAnimeKai } = await loadCrypto();
  
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
  
  const KAI_AJAX = 'https://animekai.to/ajax';
  
  // Get MAL info for 57658 (JJK Culling Game)
  console.log('Fetching MAL info for 57658...');
  const malResp = await fetch('https://api.jikan.moe/v4/anime/57658');
  const malData = await malResp.json();
  
  const malTitle = malData.data.title_english || malData.data.title;
  console.log(`MAL Title: "${malTitle}"`);
  console.log(`MAL Japanese Title: "${malData.data.title}"`);
  
  // This is what the AnimeWatchClient would pass
  const malId = 57658;
  const episode = 1;
  
  console.log('\n=== Simulating AnimeWatchClient parameters ===');
  console.log(`malId: ${malId}`);
  console.log(`malTitle: "${malTitle}"`);
  console.log(`episode: ${episode}`);
  
  // Now search AnimeKai with these parameters
  console.log('\n=== Searching AnimeKai ===');
  
  // Try the MAL title first
  console.log(`\nSearching for: "${malTitle}"`);
  let searchResp = await fetch(`${KAI_AJAX}/anime/search?keyword=${encodeURIComponent(malTitle)}`, { headers: HEADERS });
  let searchData = await searchResp.json();
  
  if (!searchData.result?.html || !searchData.result.html.includes('href="/watch/')) {
    console.log('No results with MAL title, trying "Jujutsu Kaisen"...');
    searchResp = await fetch(`${KAI_AJAX}/anime/search?keyword=${encodeURIComponent('Jujutsu Kaisen')}`, { headers: HEADERS });
    searchData = await searchResp.json();
  }
  
  // Parse results
  const animeRegex = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
  const results = [];
  let match;
  while ((match = animeRegex.exec(searchData.result?.html || '')) !== null) {
    results.push({ slug: match[1], title: match[2].trim() });
  }
  
  console.log(`Found ${results.length} results`);
  
  // Check each result's MAL ID
  console.log('\nChecking MAL IDs...');
  let foundAnime = null;
  
  for (const result of results) {
    const watchResp = await fetch(`https://animekai.to/watch/${result.slug}`, { headers: HEADERS });
    const watchHtml = await watchResp.text();
    
    const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
    if (syncMatch) {
      const syncData = JSON.parse(syncMatch[1]);
      const pageMalId = parseInt(syncData.mal_id);
      const animeId = syncData.anime_id;
      
      console.log(`  - "${result.title}" → mal_id: ${pageMalId}, anime_id: ${animeId}`);
      
      if (pageMalId === malId) {
        console.log(`  ✓ MATCH!`);
        foundAnime = { content_id: animeId, title: result.title };
        break;
      }
    }
  }
  
  if (!foundAnime) {
    console.log('\n❌ MAL ID not found!');
    return;
  }
  
  console.log(`\n✓ Found: "${foundAnime.title}" (content_id: ${foundAnime.content_id})`);
  
  // Get episodes
  console.log('\nGetting episodes...');
  const encId = encryptAnimeKai(foundAnime.content_id);
  const epResp = await fetch(`${KAI_AJAX}/episodes/list?ani_id=${foundAnime.content_id}&_=${encId}`, { headers: HEADERS });
  const epData = await epResp.json();
  
  // Find episode token
  const tokenRegex = new RegExp(`num="${episode}"[^>]*token="([^"]+)"`, 'i');
  let tokenMatch = epData.result?.match(tokenRegex);
  
  if (!tokenMatch) {
    const altRegex = new RegExp(`token="([^"]+)"[^>]*num="${episode}"`, 'i');
    tokenMatch = epData.result?.match(altRegex);
  }
  
  if (!tokenMatch) {
    console.log(`❌ Episode ${episode} not found!`);
    
    // Show available episodes
    const allTokens = epData.result?.match(/num="(\d+)"/g) || [];
    console.log('Available episodes:', allTokens.map(t => t.match(/\d+/)?.[0]).join(', '));
    return;
  }
  
  console.log(`✓ Found episode ${episode} token`);
  
  // Get servers
  console.log('\nGetting servers...');
  const token = tokenMatch[1];
  const encToken = encryptAnimeKai(token);
  const serverResp = await fetch(`${KAI_AJAX}/links/list?token=${token}&_=${encToken}`, { headers: HEADERS });
  const serverData = await serverResp.json();
  
  const lidMatch = serverData.result?.match(/data-lid="([^"]+)"/);
  if (!lidMatch) {
    console.log('❌ No server found!');
    return;
  }
  
  console.log(`✓ Found server lid: ${lidMatch[1]}`);
  
  // Get embed
  console.log('\nGetting embed...');
  const lid = lidMatch[1];
  const encLid = encryptAnimeKai(lid);
  const embedResp = await fetch(`${KAI_AJAX}/links/view?id=${lid}&_=${encLid}`, { headers: HEADERS });
  const embedData = await embedResp.json();
  
  if (!embedData.result) {
    console.log('❌ No embed found!');
    return;
  }
  
  // Decrypt
  const decrypted = decryptAnimeKai(embedData.result);
  console.log(`✓ Decrypted: ${decrypted.substring(0, 100)}...`);
  
  console.log('\n✅ SUCCESS! JJK Culling Game extraction works correctly.');
}

test().catch(console.error);
