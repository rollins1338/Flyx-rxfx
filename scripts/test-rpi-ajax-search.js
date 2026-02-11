const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function main() {
  // Test AJAX search suggest through RPI
  const ajaxUrl = 'https://hianimez.to/ajax/search/suggest?keyword=Solo+Leveling';
  const params = new URLSearchParams({ url: ajaxUrl, key: RPI_KEY });
  const res = await fetch(`${RPI_URL}/animekai?${params}`, { signal: AbortSignal.timeout(20000) });
  
  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('X-Proxied-By:', res.headers.get('x-proxied-by'));
  
  const text = await res.text();
  console.log('Size:', text.length);
  console.log('First 500:', text.substring(0, 500));
  
  // Try parsing as JSON
  try {
    const json = JSON.parse(text);
    console.log('\nParsed as JSON:', json.status);
    console.log('HTML length:', json.html?.length);
    
    // Parse results
    const itemRegex = /<a[^>]*href="\/([^"?]+)"[^>]*class="[^"]*nav-item[^"]*"[^>]*>/g;
    let m;
    const links = [];
    while ((m = itemRegex.exec(json.html)) !== null) links.push(m[1]);
    console.log('Links:', links);
  } catch (e) {
    console.log('\nFailed to parse as JSON:', e.message);
  }
}

main().catch(e => console.error(e));
