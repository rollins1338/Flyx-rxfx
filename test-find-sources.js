// Find actual source names in the JS bundle

async function findSources() {
  const jsUrl = 'https://w1.moviesapi.to/assets/index-BHd4R3tU.js';
  console.log('Fetching JS bundle...');
  
  const res = await fetch(jsUrl);
  const js = await res.text();
  
  // Look for source names in the code
  // The code shows: m=async(A,R,C)=> where A is the source name
  
  // Find all string literals that could be source names
  const sourcePatterns = [
    /Checking\s+([A-Za-z]+)/g,
    /"([A-Za-z]+)"\s*:\s*"(online|offline)"/g,
    /source:\s*["']([^"']+)["']/g,
    /checkSource\s*\(\s*["']([^"']+)["']/g,
  ];
  
  for (const pattern of sourcePatterns) {
    const matches = [...js.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`\nPattern ${pattern.source}:`);
      const unique = [...new Set(matches.map(m => m[1]))];
      unique.forEach(s => console.log('  ', s));
    }
  }
  
  // Look for the source checking code
  const checkingIdx = js.indexOf('Checking');
  if (checkingIdx > -1) {
    console.log('\n=== Checking context ===');
    console.log(js.substring(checkingIdx - 200, checkingIdx + 500));
  }
  
  // Look for online/offline status
  const onlineIdx = js.indexOf('"online"');
  if (onlineIdx > -1) {
    console.log('\n=== Online status context ===');
    console.log(js.substring(onlineIdx - 300, onlineIdx + 300));
  }
  
  // Look for source array/list
  const sourcesArrayMatch = js.match(/sources?\s*[=:]\s*\[["'][^"']+["']/g);
  if (sourcesArrayMatch) {
    console.log('\nSources arrays:');
    sourcesArrayMatch.forEach(s => console.log('  ', s));
  }
  
  // Look for the v function that calls m
  const vFuncIdx = js.indexOf('const v=async');
  if (vFuncIdx > -1) {
    console.log('\n=== v function context ===');
    console.log(js.substring(vFuncIdx, vFuncIdx + 2000));
  }
  
  // Search for specific source names
  const knownSources = ['Apollo', 'Nexon', 'Alpha', 'Orion', 'Nova', 'Viper', 'Titan', 'Zeus', 'Hera', 'Athena'];
  console.log('\n=== Known source search ===');
  for (const source of knownSources) {
    const idx = js.indexOf(`"${source}"`);
    if (idx > -1) {
      console.log(`Found "${source}" at index ${idx}`);
      console.log(js.substring(idx - 50, idx + 100));
    }
  }
}

findSources().catch(console.error);
