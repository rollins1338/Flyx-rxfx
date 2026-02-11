const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

async function search(query) {
  const res = await fetch(`https://hianimez.to/search?keyword=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA },
  });
  const html = await res.text();
  const re = /<a[^>]*href="\/([^"?]+)"[^>]*class="[^"]*dynamic-name[^"]*"[^>]*data-jname="([^"]*)"[^>]*>([^<]*)<\/a>/g;
  let m, results = [];
  while ((m = re.exec(html)) !== null) results.push({ id: m[1], jname: m[2], name: m[3].trim() });
  return results;
}

async function main() {
  // Search with different queries
  for (const q of ['Solo Leveling', 'Ore dake Level Up na Ken', 'solo leveling season 1']) {
    console.log(`\nSearch: "${q}"`);
    const results = await search(q);
    console.log(`  Found ${results.length} results:`);
    results.slice(0, 5).forEach(r => console.log(`    ${r.id} - ${r.name} (${r.jname})`));
  }
  
  // Check Solo Leveling S1 directly
  console.log('\n\nDirect check: solo-leveling-18718');
  const res = await fetch('https://hianimez.to/solo-leveling-18718', { headers: { 'User-Agent': UA } });
  const html = await res.text();
  const syncMatch = html.match(/<div[^>]*id="syncData"[^>]*>([^<]*)<\/div>/);
  if (syncMatch) {
    const syncData = JSON.parse(syncMatch[1]);
    console.log('  MAL ID:', syncData.mal_id);
    console.log('  Title:', html.match(/<title>([^<]*)<\/title>/)?.[1]);
  }
}

main().catch(e => console.error(e));
