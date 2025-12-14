/**
 * Test MAL sequel chain for Bleach TYBW
 */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  console.log('Testing MAL sequel chain for Bleach TYBW Part 1 (MAL ID: 41467)');
  console.log('='.repeat(60));
  
  const allIds = new Set();
  await collectSequelChain(41467, allIds);
  
  console.log('\n' + '='.repeat(60));
  console.log(`Collected ${allIds.size} related anime IDs: ${Array.from(allIds).join(', ')}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
