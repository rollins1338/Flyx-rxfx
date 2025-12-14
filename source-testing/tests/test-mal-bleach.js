/**
 * Test MAL service for Bleach TYBW
 * Should find all 3 parts:
 * - Sennen Kessen-hen (13 eps)
 * - Soukoku-tan (14 eps)
 * - Ketsubetsu-tan (13 eps)
 */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchMAL(query) {
  console.log(`\n[Search] Searching for: "${query}"`);
  const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=10&order_by=members&sort=desc`;
  const response = await fetch(url);
  const data = await response.json();
  
  console.log(`[Search] Found ${data.data?.length || 0} results:`);
  data.data?.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title} (${r.mal_id}) - ${r.episodes} eps - ${r.type}`);
  });
  
  return data.data || [];
}

async function getRelations(malId) {
  console.log(`\n[Relations] Getting relations for MAL ID: ${malId}`);
  await sleep(400); // Rate limit
  
  const url = `${JIKAN_BASE_URL}/anime/${malId}/relations`;
  const response = await fetch(url);
  const data = await response.json();
  
  console.log(`[Relations] Found ${data.data?.length || 0} relation groups:`);
  data.data?.forEach(r => {
    console.log(`  ${r.relation}:`);
    r.entry.forEach(e => {
      console.log(`    - ${e.name} (${e.mal_id}) [${e.type}]`);
    });
  });
  
  return data.data || [];
}

async function getAnimeDetails(malId) {
  console.log(`\n[Details] Getting details for MAL ID: ${malId}`);
  await sleep(400); // Rate limit
  
  const url = `${JIKAN_BASE_URL}/anime/${malId}/full`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.data) {
    console.log(`[Details] ${data.data.title}`);
    console.log(`  Episodes: ${data.data.episodes}`);
    console.log(`  Score: ${data.data.score}`);
    console.log(`  Aired: ${data.data.aired?.string}`);
  }
  
  return data.data;
}

async function collectSequelChain(startId, collected, depth = 0) {
  if (depth > 5 || collected.has(startId)) return;
  
  collected.add(startId);
  
  const relations = await getRelations(startId);
  
  for (const relation of relations) {
    if (relation.relation === 'Sequel' || relation.relation === 'Prequel') {
      for (const entry of relation.entry) {
        if (entry.type === 'anime' && !collected.has(entry.mal_id)) {
          console.log(`\n>>> Following ${relation.relation} to: ${entry.name} (${entry.mal_id})`);
          await collectSequelChain(entry.mal_id, collected, depth + 1);
        }
      }
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Testing MAL Service for Bleach: Thousand-Year Blood War');
  console.log('='.repeat(60));
  
  // Step 1: Search for Bleach TYBW (using Japanese title for better results)
  const results = await searchMAL('Bleach Sennen Kessen');
  
  if (results.length === 0) {
    console.log('\nNo results found!');
    return;
  }
  
  // Find the first TYBW entry (should be Sennen Kessen-hen)
  const tybwEntry = results.find(r => 
    r.title.toLowerCase().includes('sennen kessen') ||
    r.title_english?.toLowerCase().includes('thousand-year')
  );
  
  if (!tybwEntry) {
    console.log('\nCould not find TYBW entry!');
    return;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Found TYBW entry: ${tybwEntry.title} (${tybwEntry.mal_id})`);
  console.log('='.repeat(60));
  
  // Step 2: Recursively collect all sequel/prequel entries
  const allIds = new Set();
  await collectSequelChain(tybwEntry.mal_id, allIds);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Collected ${allIds.size} related anime IDs: ${Array.from(allIds).join(', ')}`);
  console.log('='.repeat(60));
  
  // Step 3: Get details for all entries
  console.log('\nFetching details for all entries...');
  const allAnime = [];
  for (const id of allIds) {
    const details = await getAnimeDetails(id);
    if (details) {
      allAnime.push(details);
    }
  }
  
  // Step 4: Filter to TV series with TYBW in title
  const tybwSeries = allAnime
    .filter(a => 
      (a.type === 'TV' || a.type === 'ONA') &&
      (a.title.toLowerCase().includes('sennen kessen') || 
       a.title_english?.toLowerCase().includes('thousand-year'))
    )
    .sort((a, b) => {
      const dateA = a.aired?.from ? new Date(a.aired.from).getTime() : 0;
      const dateB = b.aired?.from ? new Date(b.aired.from).getTime() : 0;
      return dateA - dateB;
    });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL RESULT - Bleach TYBW Parts:');
  console.log('='.repeat(60));
  
  let totalEps = 0;
  tybwSeries.forEach((anime, i) => {
    console.log(`\nPart ${i + 1}: ${anime.title}`);
    console.log(`  English: ${anime.title_english || 'N/A'}`);
    console.log(`  MAL ID: ${anime.mal_id}`);
    console.log(`  Episodes: ${anime.episodes}`);
    console.log(`  Score: ${anime.score}`);
    console.log(`  Aired: ${anime.aired?.string}`);
    totalEps += anime.episodes || 0;
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total: ${tybwSeries.length} parts, ${totalEps} episodes`);
  console.log('='.repeat(60));
  
  if (tybwSeries.length === 3 && totalEps === 40) {
    console.log('\n✅ SUCCESS! Found all 3 parts with correct episode counts!');
  } else {
    console.log('\n❌ FAILED! Expected 3 parts with 40 total episodes');
  }
}

main().catch(console.error);
