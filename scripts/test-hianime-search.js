const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const DOMAIN = 'hianimez.to';

async function main() {
  // Test 1: Regular search page (seems to return trending, not actual results)
  console.log('[1] Regular search page...');
  const res1 = await fetch(`https://${DOMAIN}/search?keyword=Solo+Leveling`, {
    headers: { 'User-Agent': UA },
  });
  console.log('   Status:', res1.status);
  const html1 = await res1.text();
  // Check if there's an AJAX search suggestion endpoint
  console.log('   Has "ajax/search":', html1.includes('ajax/search'));
  
  // Test 2: AJAX search suggestion (common pattern for anime sites)
  console.log('\n[2] AJAX search suggestion...');
  const res2 = await fetch(`https://${DOMAIN}/ajax/search/suggest?keyword=Solo+Leveling`, {
    headers: { 
      'User-Agent': UA, 
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://${DOMAIN}/`,
    },
  });
  console.log('   Status:', res2.status);
  const text2 = await res2.text();
  console.log('   Size:', text2.length);
  console.log('   Has "solo":', text2.toLowerCase().includes('solo'));
  // Try to parse as JSON
  try {
    const json2 = JSON.parse(text2);
    console.log('   JSON keys:', Object.keys(json2));
    if (json2.html) {
      // Parse results from HTML
      const re = /<a[^>]*href="\/([^"?]+)"[^>]*>/g;
      let m, results = [];
      while ((m = re.exec(json2.html)) !== null) results.push(m[1]);
      console.log('   Links found:', results.length);
      results.slice(0, 5).forEach(r => console.log('     ', r));
    }
  } catch {
    console.log('   First 500:', text2.substring(0, 500));
  }

  // Test 3: AJAX search/list (another common pattern)
  console.log('\n[3] AJAX search list...');
  const res3 = await fetch(`https://${DOMAIN}/ajax/search/list?keyword=Solo+Leveling`, {
    headers: { 
      'User-Agent': UA, 
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://${DOMAIN}/search?keyword=Solo+Leveling`,
    },
  });
  console.log('   Status:', res3.status);
  if (res3.ok) {
    const text3 = await res3.text();
    console.log('   Size:', text3.length);
    console.log('   First 300:', text3.substring(0, 300));
  }

  // Test 4: Filter search (HiAnime uses filter-based search)
  console.log('\n[4] Filter search...');
  const res4 = await fetch(`https://${DOMAIN}/filter?keyword=Solo+Leveling`, {
    headers: { 'User-Agent': UA },
  });
  console.log('   Status:', res4.status);
  const html4 = await res4.text();
  const re4 = /<a[^>]*href="\/([^"?]+)"[^>]*class="[^"]*dynamic-name[^"]*"[^>]*data-jname="([^"]*)"[^>]*>([^<]*)<\/a>/g;
  let m4, results4 = [];
  while ((m4 = re4.exec(html4)) !== null) results4.push({ id: m4[1], name: m4[3].trim() });
  console.log('   Results:', results4.length);
  results4.slice(0, 5).forEach(r => console.log('     ', r.id, '-', r.name));
}

main().catch(e => console.error(e));
