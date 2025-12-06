// Fetch cloudnestra scripts to analyze hash generation

async function main() {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  
  console.log('Fetching base64.js...');
  const base64 = await fetch('https://cloudnestra.com/base64.js', {
    headers: { 'User-Agent': UA }
  });
  const base64Text = await base64.text();
  await Bun.write('debug-cloudnestra-base64.js', base64Text);
  console.log(`base64.js: ${base64Text.length} chars`);
  console.log(base64Text.substring(0, 800));
  
  console.log('\n\nFetching sbx.js...');
  const sbx = await fetch('https://cloudnestra.com/sbx.js', {
    headers: { 'User-Agent': UA }
  });
  const sbxText = await sbx.text();
  await Bun.write('debug-cloudnestra-sbx.js', sbxText);
  console.log(`sbx.js: ${sbxText.length} chars`);
  console.log(sbxText.substring(0, 800));
}

main();
