/**
 * Test: Can the RPI proxy fetch HiAnime pages?
 */
const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function main() {
  console.log('=== Test RPI proxy fetching HiAnime ===\n');

  // Test 1: Search page
  const searchUrl = 'https://hianimez.to/search?keyword=Solo%20Leveling';
  console.log('[1] RPI fetch HiAnime search page...');
  const params1 = new URLSearchParams({ url: searchUrl, key: RPI_KEY });
  const res1 = await fetch(`${RPI_URL}/animekai?${params1}`, { signal: AbortSignal.timeout(20000) });
  const text1 = await res1.text();
  console.log(`   Status: ${res1.status}`);
  console.log(`   Size: ${text1.length}`);
  console.log(`   Has results: ${text1.includes('dynamic-name')}`);
  console.log(`   Has CF challenge: ${text1.includes('challenge-platform') || text1.includes('Attention Required')}`);
  if (!text1.includes('dynamic-name')) {
    console.log(`   First 500: ${text1.substring(0, 500)}`);
  }

  // Test 2: AJAX endpoint
  const ajaxUrl = 'https://hianimez.to/ajax/v2/episode/list/18718';
  console.log('\n[2] RPI fetch HiAnime AJAX endpoint...');
  const params2 = new URLSearchParams({ url: ajaxUrl, key: RPI_KEY });
  const res2 = await fetch(`${RPI_URL}/animekai?${params2}`, { signal: AbortSignal.timeout(20000) });
  const text2 = await res2.text();
  console.log(`   Status: ${res2.status}`);
  console.log(`   Size: ${text2.length}`);
  console.log(`   Has episode data: ${text2.includes('data-number')}`);
  console.log(`   First 300: ${text2.substring(0, 300)}`);

  // Test 3: Anime detail page (for syncData/MAL ID)
  const detailUrl = 'https://hianimez.to/solo-leveling-18718';
  console.log('\n[3] RPI fetch HiAnime detail page...');
  const params3 = new URLSearchParams({ url: detailUrl, key: RPI_KEY });
  const res3 = await fetch(`${RPI_URL}/animekai?${params3}`, { signal: AbortSignal.timeout(20000) });
  const text3 = await res3.text();
  console.log(`   Status: ${res3.status}`);
  console.log(`   Size: ${text3.length}`);
  console.log(`   Has syncData: ${text3.includes('syncData')}`);
  if (text3.includes('syncData')) {
    const syncMatch = text3.match(/<div[^>]*id="syncData"[^>]*>([^<]*)<\/div>/);
    if (syncMatch) console.log(`   syncData: ${syncMatch[1].substring(0, 200)}`);
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
