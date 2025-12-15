/**
 * Analyze playerjs to find how it handles streams
 */

async function main() {
  console.log('=== ANALYZING PLAYERJS ===\n');
  
  const resp = await fetch('https://player.smashystream.com/js/pljssd6.js', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  
  const js = await resp.text();
  console.log(`Script length: ${js.length} chars`);
  
  // Look for proxy-related code
  console.log('\n--- Searching for proxy patterns ---');
  
  const patterns = [
    /proxy[^a-z]/gi,
    /cors[^a-z]/gi,
    /crossorigin/gi,
    /withCredentials/gi,
    /xhrSetup/gi,
    /loader/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = js.match(pattern);
    if (matches) {
      console.log(`${pattern}: ${matches.length} matches`);
    }
  }
  
  // Look for URL manipulation
  console.log('\n--- URL manipulation patterns ---');
  
  // Find where file URLs are processed
  const fileProcessing = js.match(/file[^a-z].{0,100}/gi);
  if (fileProcessing) {
    console.log(`"file" references: ${fileProcessing.length}`);
    // Show unique patterns
    const unique = [...new Set(fileProcessing.slice(0, 10))];
    for (const p of unique) {
      console.log(`  ${p.substring(0, 80)}`);
    }
  }
  
  // Look for HLS configuration
  console.log('\n--- HLS configuration ---');
  
  const hlsConfig = js.match(/hlsconfig[^}]+}/gi);
  if (hlsConfig) {
    console.log(`hlsconfig references: ${hlsConfig.length}`);
  }
  
  // Look for fetch/XHR interception
  console.log('\n--- Request interception ---');
  
  if (js.includes('xhrSetup')) {
    const xhrSetup = js.match(/xhrSetup[^}]+}/gi);
    if (xhrSetup) {
      console.log('xhrSetup found:');
      for (const x of xhrSetup.slice(0, 3)) {
        console.log(`  ${x.substring(0, 100)}`);
      }
    }
  }
  
  // Look for custom loaders
  if (js.includes('pLoader') || js.includes('fLoader')) {
    console.log('Custom loaders found');
  }
  
  // Search for the stream domain
  console.log('\n--- Stream domain references ---');
  
  if (js.includes('kalis393fev')) {
    console.log('Contains stream domain reference!');
  }
  
  // Look for base64 or encoding
  console.log('\n--- Encoding patterns ---');
  
  if (js.includes('atob')) console.log('Uses atob (base64 decode)');
  if (js.includes('btoa')) console.log('Uses btoa (base64 encode)');
  if (js.includes('encodeURIComponent')) console.log('Uses encodeURIComponent');
  
  // Save a portion of the script for manual analysis
  console.log('\n--- Saving script sections ---');
  
  // Find the Playerjs class/function
  const playerjsMatch = js.match(/Playerjs[^{]*\{[^}]{0,5000}/i);
  if (playerjsMatch) {
    console.log('Playerjs definition found');
    require('fs').writeFileSync('source-testing/playerjs-section.txt', playerjsMatch[0]);
    console.log('Saved to playerjs-section.txt');
  }
}

main().catch(console.error);
