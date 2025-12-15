/**
 * Deobfuscate 111movies encoding to find the hash construction
 */

async function deobfuscate() {
  const res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.text();
  
  // Find the section with f and g variables
  const c4c0Idx = data.indexOf('c4c0');
  const section = data.substring(c4c0Idx - 500, c4c0Idx + 2000);
  
  console.log('=== SECTION AROUND c4c0 ===');
  console.log(section);
  
  // Look for fetch calls
  console.log('\n\n=== LOOKING FOR FETCH CALLS ===');
  let fetchIdx = 0;
  let count = 0;
  while (count < 10) {
    fetchIdx = data.indexOf('fetch(', fetchIdx + 1);
    if (fetchIdx < 0) break;
    
    const context = data.substring(fetchIdx, fetchIdx + 500);
    console.log(`\n--- Fetch #${count} ---`);
    console.log(context.substring(0, 300));
    count++;
  }
  
  // Look for URL construction with template literals
  console.log('\n\n=== LOOKING FOR URL TEMPLATES ===');
  const templateIdx = data.indexOf('`/');
  if (templateIdx >= 0) {
    console.log(data.substring(templateIdx, templateIdx + 200));
  }
  
  // Look for concat with f
  console.log('\n\n=== LOOKING FOR f USAGE ===');
  const fUsageIdx = data.indexOf('+f+');
  if (fUsageIdx >= 0) {
    console.log(data.substring(Math.max(0, fUsageIdx - 100), fUsageIdx + 200));
  }
  
  // The hash might be: fcd552c4 + some_hash + c4c0
  // Let's check if the hash is static or dynamic
  
  // Look for the full URL pattern
  console.log('\n\n=== LOOKING FOR URL PATTERN ===');
  const urlPatterns = ['/sr', 'fcd552c4'];
  for (const pattern of urlPatterns) {
    let idx = 0;
    while (idx < data.length) {
      idx = data.indexOf(pattern, idx + 1);
      if (idx < 0) break;
      
      const context = data.substring(Math.max(0, idx - 100), idx + 100);
      if (context.includes('fetch') || context.includes('http') || context.includes('concat') || context.includes('+')) {
        console.log(`\n--- ${pattern} context ---`);
        console.log(context);
      }
    }
  }
}

deobfuscate().catch(console.error);
