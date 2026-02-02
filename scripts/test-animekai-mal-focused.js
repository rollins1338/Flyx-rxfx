#!/usr/bin/env node
/**
 * Test AnimeKai MAL ID Focused Extraction
 * 
 * This tests the new MAL ID focused approach where:
 * 1. We search AnimeKai with a title
 * 2. Check each result's syncData.mal_id
 * 3. Return the one that matches our MAL ID
 * 
 * Usage:
 *   npx tsx scripts/test-animekai-mal-focused.js
 *   npx tsx scripts/test-animekai-mal-focused.js 57658 "Jujutsu Kaisen" 1
 */

// Import crypto functions - use dynamic import for TypeScript
const loadCrypto = async () => {
  try {
    return await import('../app/lib/animekai-crypto.ts');
  } catch {
    // Fallback: try to load from .next build
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
  
  // Test cases: [malId, searchQuery, expectedTitle, episode]
  const testCases = [
    // JJK Season 1
    [40748, 'Jujutsu Kaisen', 'Jujutsu Kaisen', 1],
    // JJK Season 2
    [51009, 'Jujutsu Kaisen', 'Jujutsu Kaisen 2nd Season', 1],
    // JJK Season 3 (Culling Game)
    [57658, 'Jujutsu Kaisen', 'Jujutsu Kaisen: The Culling Game', 1],
    // Solo Leveling Season 2
    [58567, 'Solo Leveling', 'Solo Leveling Season 2', 1],
  ];
  
  // Allow command line override
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    const malId = parseInt(args[0]);
    const query = args[1];
    const episode = parseInt(args[2]) || 1;
    testCases.length = 0;
    testCases.push([malId, query, 'Custom Test', episode]);
  }
  
  console.log('='.repeat(60));
  console.log('AnimeKai MAL ID Focused Extraction Test');
  console.log('='.repeat(60));
  
  for (const [malId, searchQuery, expectedTitle, episode] of testCases) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Testing: MAL ID ${malId} - "${expectedTitle}"`);
    console.log(`Search Query: "${searchQuery}"`);
    console.log(`Episode: ${episode}`);
    console.log('─'.repeat(60));
    
    try {
      // Step 1: Search AnimeKai
      console.log(`\n[1] Searching AnimeKai for "${searchQuery}"...`);
      const searchResp = await fetch(`${KAI_AJAX}/anime/search?keyword=${encodeURIComponent(searchQuery)}`, { headers: HEADERS });
      const searchData = await searchResp.json();
      
      if (!searchData.result?.html) {
        console.log('❌ No search results');
        continue;
      }
      
      // Parse results
      const animeRegex = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
      const results = [];
      let match;
      while ((match = animeRegex.exec(searchData.result.html)) !== null) {
        results.push({ slug: match[1], title: match[2].trim() });
      }
      
      console.log(`   Found ${results.length} results`);
      
      // Step 2: Check each result's MAL ID
      console.log(`\n[2] Checking MAL IDs...`);
      let foundAnime = null;
      
      for (const result of results) {
        const watchResp = await fetch(`https://animekai.to/watch/${result.slug}`, { headers: HEADERS });
        const watchHtml = await watchResp.text();
        
        const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
        if (syncMatch) {
          const syncData = JSON.parse(syncMatch[1]);
          const pageMalId = parseInt(syncData.mal_id);
          const animeId = syncData.anime_id;
          
          console.log(`   - "${result.title}" → mal_id: ${pageMalId}, anime_id: ${animeId}`);
          
          if (pageMalId === malId) {
            console.log(`   ✓ MAL ID ${malId} MATCH!`);
            foundAnime = { content_id: animeId, title: result.title };
            break;
          }
        }
      }
      
      if (!foundAnime) {
        console.log(`\n❌ MAL ID ${malId} not found in search results`);
        continue;
      }
      
      // Step 3: Get episodes
      console.log(`\n[3] Getting episodes for content_id: ${foundAnime.content_id}...`);
      const encId = encryptAnimeKai(foundAnime.content_id);
      const epResp = await fetch(`${KAI_AJAX}/episodes/list?ani_id=${foundAnime.content_id}&_=${encId}`, { headers: HEADERS });
      const epData = await epResp.json();
      
      if (!epData.result) {
        console.log('❌ Failed to get episodes');
        continue;
      }
      
      // Parse episode token
      const tokenRegex = new RegExp(`num="${episode}"[^>]*token="([^"]+)"`, 'i');
      const tokenMatch = epData.result.match(tokenRegex);
      
      if (!tokenMatch) {
        // Try alternate order
        const altRegex = new RegExp(`token="([^"]+)"[^>]*num="${episode}"`, 'i');
        const altMatch = epData.result.match(altRegex);
        if (!altMatch) {
          console.log(`❌ Episode ${episode} not found`);
          continue;
        }
        tokenMatch[1] = altMatch[1];
      }
      
      const episodeToken = tokenMatch[1];
      console.log(`   ✓ Found episode ${episode} token: ${episodeToken.substring(0, 30)}...`);
      
      // Step 4: Get servers
      console.log(`\n[4] Getting servers...`);
      const encToken = encryptAnimeKai(episodeToken);
      const serverResp = await fetch(`${KAI_AJAX}/links/list?token=${episodeToken}&_=${encToken}`, { headers: HEADERS });
      const serverData = await serverResp.json();
      
      if (!serverData.result) {
        console.log('❌ Failed to get servers');
        continue;
      }
      
      // Parse server lid
      const lidMatch = serverData.result.match(/data-lid="([^"]+)"/);
      if (!lidMatch) {
        console.log('❌ No server lid found');
        continue;
      }
      
      const lid = lidMatch[1];
      console.log(`   ✓ Found server lid: ${lid}`);
      
      // Step 5: Get embed
      console.log(`\n[5] Getting embed...`);
      const encLid = encryptAnimeKai(lid);
      const embedResp = await fetch(`${KAI_AJAX}/links/view?id=${lid}&_=${encLid}`, { headers: HEADERS });
      const embedData = await embedResp.json();
      
      if (!embedData.result) {
        console.log('❌ Failed to get embed');
        continue;
      }
      
      // Step 6: Decrypt embed
      console.log(`\n[6] Decrypting embed...`);
      const decrypted = decryptAnimeKai(embedData.result);
      console.log(`   Decrypted: ${decrypted}`);
      
      console.log(`\n✅ SUCCESS: MAL ID ${malId} → "${foundAnime.title}" → Episode ${episode}`);
      
    } catch (error) {
      console.log(`\n❌ ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Complete');
  console.log('='.repeat(60));
}

test().catch(console.error);
