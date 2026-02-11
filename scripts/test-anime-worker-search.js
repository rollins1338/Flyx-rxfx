/**
 * Debug: Test if CF Worker can reach HiAnime search
 * We'll call the worker and also test what happens when CF fetches HiAnime
 */

async function main() {
  console.log('=== Testing CF Worker HiAnime Access ===\n');

  // Test 1: Can the CF worker reach HiAnime at all?
  // We'll use the worker's stream proxy to fetch the search page
  const searchUrl = 'https://hianimez.to/search?keyword=Solo%20Leveling';
  const proxyUrl = `https://media-proxy.vynx.workers.dev/hianime/stream?url=${encodeURIComponent(searchUrl)}`;
  
  console.log('[1] Testing CF Worker fetch of HiAnime search page via /hianime/stream...');
  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    console.log(`   Status: ${res.status}`);
    console.log(`   Size: ${text.length}`);
    console.log(`   Contains search results: ${text.includes('dynamic-name')}`);
    console.log(`   Contains CF challenge: ${text.includes('challenge-platform') || text.includes('Attention Required')}`);
    console.log(`   First 300: ${text.substring(0, 300)}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // Test 2: Direct test of HiAnime AJAX endpoints (what the worker actually calls)
  const ajaxUrl = 'https://hianimez.to/ajax/v2/episode/list/18718';
  const ajaxProxyUrl = `https://media-proxy.vynx.workers.dev/hianime/stream?url=${encodeURIComponent(ajaxUrl)}`;
  
  console.log('\n[2] Testing CF Worker fetch of HiAnime AJAX endpoint...');
  try {
    const res = await fetch(ajaxProxyUrl, { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    console.log(`   Status: ${res.status}`);
    console.log(`   Size: ${text.length}`);
    console.log(`   Contains episode data: ${text.includes('data-number')}`);
    console.log(`   Contains CF challenge: ${text.includes('challenge-platform') || text.includes('Attention Required')}`);
    console.log(`   First 300: ${text.substring(0, 300)}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
