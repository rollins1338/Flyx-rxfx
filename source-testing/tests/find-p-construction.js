/**
 * Find how p is constructed in the 111movies bundle
 */

async function findPConstruction() {
  const res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.text();
  
  // Find 'let p=""'
  const idx = data.indexOf('let p=""');
  if (idx >= 0) {
    console.log('=== p CONSTRUCTION ===');
    console.log(data.substring(idx, idx + 500));
  }
  
  // Find the XOR loop
  const xorIdx = data.indexOf('t^n^n');
  if (xorIdx >= 0) {
    console.log('\n=== XOR LOOP ===');
    console.log(data.substring(Math.max(0, xorIdx - 100), xorIdx + 200));
  }
  
  // Find where p is used after construction
  const pUsageIdx = data.indexOf('(p,');
  if (pUsageIdx >= 0) {
    console.log('\n=== p USAGE ===');
    console.log(data.substring(Math.max(0, pUsageIdx - 50), pUsageIdx + 200));
  }
}

findPConstruction().catch(console.error);
