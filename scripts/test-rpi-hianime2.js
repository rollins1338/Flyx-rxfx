/**
 * Deeper test: What exactly does RPI return for HiAnime search?
 */
const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function main() {
  // Test search and parse results exactly like the CF worker does
  const searchUrl = 'https://hianimez.to/search?keyword=Solo%20Leveling';
  const params = new URLSearchParams({ url: searchUrl, key: RPI_KEY });
  const res = await fetch(`${RPI_URL}/animekai?${params}`, { signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  
  console.log('Status:', res.status);
  console.log('Size:', html.length);
  console.log('Content-Type:', res.headers.get('content-type'));
  
  // Try the exact same regex the CF worker uses
  const itemRegex = /<a[^>]*href="\/([^"?]+)"[^>]*class="[^"]*dynamic-name[^"]*"[^>]*data-jname="([^"]*)"[^>]*>([^<]*)<\/a>/g;
  let match;
  const results = [];
  while ((match = itemRegex.exec(html)) !== null) {
    const id = match[1];
    const name = match[3].trim();
    const numId = id.match(/-(\d+)$/)?.[1] || null;
    results.push({ id, name, hianimeId: numId });
  }
  
  console.log('\nParsed results:', results.length);
  results.slice(0, 10).forEach(r => console.log(`  ${r.id} - ${r.name} (hianimeId: ${r.hianimeId})`));
  
  if (results.length === 0) {
    // Check what's in the HTML
    console.log('\nNo results parsed. Checking HTML content...');
    console.log('Has "dynamic-name":', html.includes('dynamic-name'));
    console.log('Has "data-jname":', html.includes('data-jname'));
    console.log('Has "flw-item":', html.includes('flw-item'));
    console.log('Has "challenge-platform":', html.includes('challenge-platform'));
    console.log('Has "Attention Required":', html.includes('Attention Required'));
    console.log('Has "Just a moment":', html.includes('Just a moment'));
    
    // Find any <a> tags with dynamic-name
    const anyDynamic = html.match(/<a[^>]*dynamic-name[^>]*>/g);
    console.log('\nAny dynamic-name <a> tags:', anyDynamic?.length || 0);
    if (anyDynamic?.length) {
      console.log('First match:', anyDynamic[0].substring(0, 200));
    }
  }
  
  // Also test: what does the CF worker's rpiFetch actually get?
  // The CF worker calls: rpiFetch(url, headers) which calls RPI /animekai?url=X&key=Y
  // But the RPI /animekai endpoint uses https.request with its own headers
  // The headers passed to rpiFetch are NOT forwarded to the target
  
  // Test MAL ID lookup for first result
  if (results.length > 0) {
    console.log('\nTesting MAL ID lookup for first result...');
    const detailUrl = `https://hianimez.to/${results[0].id}`;
    const params2 = new URLSearchParams({ url: detailUrl, key: RPI_KEY });
    const res2 = await fetch(`${RPI_URL}/animekai?${params2}`, { signal: AbortSignal.timeout(20000) });
    const html2 = await res2.text();
    const syncMatch = html2.match(/<div[^>]*id="syncData"[^>]*>([^<]*)<\/div>/);
    if (syncMatch) {
      try {
        const syncData = JSON.parse(syncMatch[1]);
        console.log('syncData:', JSON.stringify(syncData));
        console.log('MAL ID:', syncData.mal_id);
      } catch (e) {
        console.log('Failed to parse syncData:', e.message);
      }
    } else {
      console.log('No syncData found in detail page');
    }
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
