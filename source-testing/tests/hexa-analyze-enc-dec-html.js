/**
 * Analyze enc-dec.app HTML for clues
 */

async function analyzeHtml() {
  console.log('=== Analyzing enc-dec.app HTML ===\n');
  
  const response = await fetch('https://enc-dec.app/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  
  // Print the full HTML
  console.log('=== Full HTML ===\n');
  console.log(html);
  
  // Look for inline scripts
  console.log('\n=== Inline Scripts ===\n');
  const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  scriptMatches.forEach((script, i) => {
    console.log(`Script ${i + 1}:`);
    console.log(script.slice(0, 500));
    console.log('...\n');
  });
  
  // Look for any crypto-related strings
  console.log('\n=== Crypto Keywords ===\n');
  const keywords = ['chacha', 'aes', 'sodium', 'nacl', 'decrypt', 'encrypt', 'cipher', 'nonce'];
  for (const kw of keywords) {
    if (html.toLowerCase().includes(kw)) {
      console.log(`Found: ${kw}`);
      const idx = html.toLowerCase().indexOf(kw);
      console.log(`  Context: ${html.substring(Math.max(0, idx - 50), idx + 100)}`);
    }
  }
}

analyzeHtml().catch(console.error);
