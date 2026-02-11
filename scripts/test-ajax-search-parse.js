const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

async function main() {
  const res = await fetch('https://hianimez.to/ajax/search/suggest?keyword=Solo+Leveling', {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' },
  });
  const json = await res.json();
  const html = json.html;
  
  // Print raw HTML to understand structure
  console.log('=== Raw HTML (first 2000 chars) ===');
  console.log(html.substring(0, 2000));
  
  console.log('\n=== Parsing ===');
  
  // Try nav-item links
  const itemRegex = /<a[^>]*href="\/([^"?]+)"[^>]*class="[^"]*nav-item[^"]*"[^>]*>/g;
  let m;
  const links = [];
  while ((m = itemRegex.exec(html)) !== null) links.push(m[1]);
  console.log('nav-item links:', links);
  
  // Try film-name
  const nameRegex = /<h3[^>]*class="[^"]*film-name[^"]*"[^>]*>([^<]*)<\/h3>/g;
  const names = [];
  while ((m = nameRegex.exec(html)) !== null) names.push(m[1].trim());
  console.log('film-names:', names);
  
  // Try any <a> with href
  const anyLink = /<a[^>]*href="\/([^"?#]+)"[^>]*>/g;
  const allLinks = [];
  while ((m = anyLink.exec(html)) !== null) allLinks.push(m[1]);
  console.log('all links:', [...new Set(allLinks)]);
}

main().catch(e => console.error(e));
