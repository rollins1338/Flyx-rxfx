/**
 * Find where the hash in the API URL comes from
 */

async function findHash() {
  const res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.text();
  
  // Find fcd552c4
  const idx = data.indexOf('fcd552c4');
  if (idx >= 0) {
    console.log('=== fcd552c4 CONTEXT ===');
    console.log(data.substring(Math.max(0, idx - 500), idx + 500));
  }
  
  // Look for the hash construction
  // The hash is 56 chars (28 bytes hex) - could be SHA-224 or truncated SHA-256
  
  // Search for hash-related patterns
  const patterns = [
    'createHash',
    'sha256',
    'sha224',
    'md5',
    'digest',
    'c4c0', // end of the constant
  ];
  
  for (const pattern of patterns) {
    const patternIdx = data.indexOf(pattern);
    if (patternIdx >= 0) {
      console.log(`\n=== ${pattern} CONTEXT ===`);
      console.log(data.substring(Math.max(0, patternIdx - 200), patternIdx + 300));
    }
  }
  
  // The hash might be constructed from multiple parts
  // Look for string concatenation near fcd552c4
  const concatIdx = data.indexOf('fcd552c4');
  if (concatIdx >= 0) {
    // Look for + or concat nearby
    const context = data.substring(Math.max(0, concatIdx - 100), concatIdx + 200);
    console.log('\n=== CONCATENATION CONTEXT ===');
    console.log(context);
  }
}

findHash().catch(console.error);
