/**
 * Fetch and analyze the tkk4.js token generation script
 */

const fs = require('fs');

async function main() {
  console.log('=== FETCHING TKK4.JS ===\n');
  
  // The script is loaded from player.smashystream.com
  const url = 'https://player.smashystream.com/js/tkk4.js';
  console.log(`URL: ${url}`);
  
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://player.smashystream.com/',
    }
  });
  
  console.log(`Status: ${resp.status}`);
  
  if (!resp.ok) {
    console.log('Failed to fetch');
    return;
  }
  
  const content = await resp.text();
  console.log(`Content length: ${content.length} chars`);
  
  // Save the content
  fs.writeFileSync('source-testing/smashystream-tkk4.js', content);
  console.log('Saved to smashystream-tkk4.js');
  
  // Analyze the content
  console.log('\n=== ANALYZING TKK4.JS ===\n');
  
  // Check if it's WASM
  if (content.includes('WebAssembly') || content.includes('wasm')) {
    console.log('Contains WebAssembly references');
  }
  
  // Look for function exports
  const exportMatches = content.match(/Module\[["'][^"']+["']\]/g);
  if (exportMatches) {
    console.log('\nModule exports:');
    const unique = [...new Set(exportMatches)];
    for (const e of unique.slice(0, 20)) {
      console.log(`  ${e}`);
    }
  }
  
  // Look for function definitions
  const funcMatches = content.match(/function\s+\w+\s*\([^)]*\)/g);
  if (funcMatches) {
    console.log(`\nFunction definitions: ${funcMatches.length}`);
    for (const f of funcMatches.slice(0, 20)) {
      console.log(`  ${f}`);
    }
  }
  
  // Look for the token generation function
  console.log('\n=== SEARCHING FOR TOKEN PATTERNS ===\n');
  
  const patterns = [
    /token/gi,
    /generate/gi,
    /encrypt/gi,
    /hash/gi,
    /sha/gi,
    /md5/gi,
    /hmac/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    console.log(`${pattern}: ${matches ? matches.length : 0} matches`);
  }
  
  // Show first 2000 chars
  console.log('\n=== FIRST 2000 CHARS ===\n');
  console.log(content.substring(0, 2000));
  
  // Show last 2000 chars
  console.log('\n=== LAST 2000 CHARS ===\n');
  console.log(content.substring(content.length - 2000));
}

main().catch(console.error);
