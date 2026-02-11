const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function main() {
  // Test detail page (for syncData)
  const detailUrl = 'https://hianimez.to/one-piece-100';
  const params = new URLSearchParams({ url: detailUrl, key: RPI_KEY });
  const res = await fetch(`${RPI_URL}/animekai?${params}`, { signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  
  console.log('Status:', res.status);
  console.log('Size:', html.length);
  console.log('Has syncData:', html.includes('syncData'));
  console.log('Has CF challenge:', html.includes('challenge-platform') || html.includes('Just a moment'));
  console.log('Has title:', html.includes('<title>'));
  
  // Check title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  console.log('Title:', titleMatch?.[1] || 'not found');
  
  // Now test direct fetch (from this machine)
  console.log('\n--- Direct fetch ---');
  const directRes = await fetch(detailUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36' },
  });
  const directHtml = await directRes.text();
  console.log('Status:', directRes.status);
  console.log('Size:', directHtml.length);
  console.log('Has syncData:', directHtml.includes('syncData'));
  console.log('Has CF challenge:', directHtml.includes('challenge-platform') || directHtml.includes('Just a moment'));
  const directTitle = directHtml.match(/<title>([^<]*)<\/title>/);
  console.log('Title:', directTitle?.[1] || 'not found');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
