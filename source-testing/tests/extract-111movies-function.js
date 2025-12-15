/**
 * Extract the full encoding function from 111movies
 */

async function extractFunction() {
  const res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.text();
  
  // Find the encoding function by looking for the cipher creation
  const cipherIdx = data.indexOf('createCiph');
  
  // Go back to find the function start
  let funcStart = cipherIdx;
  let braceCount = 0;
  let foundAsync = false;
  
  // Look for async function or arrow function
  while (funcStart > 0 && !foundAsync) {
    if (data.substring(funcStart - 10, funcStart).includes('async')) {
      foundAsync = true;
      funcStart -= 10;
    }
    funcStart--;
  }
  
  // Find the useEffect that contains this code
  const useEffectIdx = data.lastIndexOf('useEffect', cipherIdx);
  if (useEffectIdx >= 0) {
    console.log('=== useEffect CONTEXT ===');
    console.log(data.substring(useEffectIdx, useEffectIdx + 3000));
  }
  
  // Look for where n is defined
  const nDefIdx = data.lastIndexOf('let n=', cipherIdx);
  if (nDefIdx >= 0) {
    console.log('\n=== n DEFINITION ===');
    console.log(data.substring(nDefIdx, nDefIdx + 200));
  }
  
  // Look for where _data is set
  const dataSetIdx = data.indexOf('._data=');
  if (dataSetIdx >= 0) {
    console.log('\n=== _data ASSIGNMENT ===');
    console.log(data.substring(Math.max(0, dataSetIdx - 100), dataSetIdx + 200));
  }
  
  // Look for the full encoding flow
  // The pattern is: n._data -> cipher.update -> hex -> XOR -> base64 -> char substitution
  
  // Find where the result is used (API call)
  const apiCallIdx = data.indexOf('fcd552c4');
  if (apiCallIdx >= 0) {
    console.log('\n=== API CALL CONTEXT ===');
    console.log(data.substring(Math.max(0, apiCallIdx - 200), apiCallIdx + 500));
  }
  
  // Look for the fetch call that uses the encoded data
  const fetchIdx = data.indexOf('fetch(');
  let fetchCount = 0;
  let searchIdx = 0;
  while (searchIdx < data.length && fetchCount < 10) {
    const idx = data.indexOf('fetch(', searchIdx);
    if (idx < 0) break;
    
    const context = data.substring(idx, idx + 300);
    if (context.includes('fcd552c4') || context.includes('/sr')) {
      console.log('\n=== FETCH CALL #' + fetchCount + ' ===');
      console.log(data.substring(Math.max(0, idx - 100), idx + 400));
    }
    
    searchIdx = idx + 1;
    fetchCount++;
  }
}

extractFunction().catch(console.error);
