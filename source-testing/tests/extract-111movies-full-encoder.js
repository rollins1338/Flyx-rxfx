/**
 * Extract the full 111movies encoding function
 * 
 * Found in 860-58807119fccb267b.js:
 * - XOR encryption
 * - Custom alphabet: a-z, A-Z, 0-9, etc.
 * - Uses AES encryption ("createCipher" + "aes")
 */

async function extractFullEncoder() {
  console.log('=== EXTRACTING FULL ENCODER FROM 860 BUNDLE ===\n');
  
  const bundle = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text());
  
  console.log('Bundle size:', bundle.length);
  
  // Find the encryption section
  // Look for "createCipher" which indicates AES encryption
  const cipherIdx = bundle.indexOf('createCiph');
  if (cipherIdx >= 0) {
    console.log('\n=== CIPHER SECTION ===');
    const context = bundle.substring(Math.max(0, cipherIdx - 500), cipherIdx + 1500);
    console.log(context);
  }
  
  // Find the alphabet array
  const alphabetIdx = bundle.indexOf('["a","b","c","d","e","f"');
  if (alphabetIdx >= 0) {
    console.log('\n=== ALPHABET SECTION ===');
    const context = bundle.substring(alphabetIdx, alphabetIdx + 500);
    console.log(context);
  }
  
  // Find the XOR loop
  const xorIdx = bundle.indexOf('t^n^n');
  if (xorIdx >= 0) {
    console.log('\n=== XOR SECTION ===');
    const context = bundle.substring(Math.max(0, xorIdx - 200), xorIdx + 300);
    console.log(context);
  }
  
  // Find the full encoding function
  // Look for the function that uses all these components
  
  // The encoding likely:
  // 1. Takes page data
  // 2. Decrypts/transforms it
  // 3. Encodes with custom alphabet
  // 4. Adds 'p' delimiters
  
  // Search for the function that builds the API URL
  const apiUrlPatterns = [
    /fcd552c4/g,
    /\/sr/g,
  ];
  
  console.log('\n=== SEARCHING FOR API URL BUILDING ===');
  for (const pattern of apiUrlPatterns) {
    const matches = bundle.match(pattern);
    if (matches) {
      console.log(`Pattern ${pattern}: ${matches.length} matches`);
      
      // Find context
      let idx = bundle.indexOf(matches[0]);
      if (idx >= 0) {
        const context = bundle.substring(Math.max(0, idx - 300), idx + 300);
        console.log(`Context: ${context}`);
      }
    }
  }
}

async function analyzeEncodingAlgorithm() {
  console.log('\n=== ANALYZING ENCODING ALGORITHM ===\n');
  
  const bundle = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text());
  
  // The encoding uses:
  // 1. AES encryption (createCipher + "aes")
  // 2. XOR with a key
  // 3. Custom alphabet mapping
  
  // Let's find the key used for encryption
  // Look for Buffer.from or Uint8Array with numbers
  
  const keyPatterns = [
    /Buffer\.from\s*\(\s*\[[0-9,\s]+\]\s*\)/g,
    /Uint8Array\s*\(\s*\[[0-9,\s]+\]\s*\)/g,
    /\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*\d+\s*){4,}\]/g,
  ];
  
  console.log('Searching for encryption keys...');
  for (const pattern of keyPatterns) {
    const matches = bundle.match(pattern);
    if (matches) {
      console.log(`\nPattern ${pattern.toString().substring(0, 50)}:`);
      matches.slice(0, 5).forEach(m => console.log(`  ${m.substring(0, 100)}`));
    }
  }
  
  // Find the specific key arrays mentioned in the code
  // From earlier: [170,162,126,126,60,255,136,130,133]
  const keyArrayIdx = bundle.indexOf('[170,162,126,126');
  if (keyArrayIdx >= 0) {
    console.log('\n=== FOUND KEY ARRAY ===');
    const context = bundle.substring(Math.max(0, keyArrayIdx - 100), keyArrayIdx + 200);
    console.log(context);
  }
  
  // Find the IV (initialization vector) for AES
  // Look for arrays of 16 bytes
  const ivPattern = /\[\s*\d+\s*(?:,\s*\d+\s*){15}\]/g;
  const ivMatches = bundle.match(ivPattern);
  if (ivMatches) {
    console.log('\n=== POTENTIAL IV ARRAYS (16 bytes) ===');
    ivMatches.slice(0, 5).forEach(m => console.log(`  ${m}`));
  }
}

async function extractCompleteFunction() {
  console.log('\n=== EXTRACTING COMPLETE ENCODING FUNCTION ===\n');
  
  const bundle = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text());
  
  // Find the section that contains the encoding logic
  // Look for the pattern: function that takes data and returns encoded string
  
  // The encoding function likely:
  // 1. Receives page data (base64 encoded)
  // 2. Decodes it
  // 3. Encrypts with AES
  // 4. XORs the result
  // 5. Maps to custom alphabet
  // 6. Adds 'p' delimiters
  
  // Find the main encoding function by looking for the alphabet usage
  const alphabetUsageIdx = bundle.indexOf('h[');
  if (alphabetUsageIdx >= 0) {
    // Go back to find the function start
    let funcStart = alphabetUsageIdx;
    let braceCount = 0;
    let foundStart = false;
    
    while (funcStart > 0 && !foundStart) {
      if (bundle[funcStart] === '}') braceCount++;
      if (bundle[funcStart] === '{') {
        braceCount--;
        if (braceCount < 0) foundStart = true;
      }
      funcStart--;
    }
    
    // Go back more to find function keyword
    while (funcStart > 0 && !bundle.substring(funcStart - 50, funcStart).includes('function') && 
           !bundle.substring(funcStart - 50, funcStart).includes('=>')) {
      funcStart--;
    }
    
    // Find the function end
    let funcEnd = alphabetUsageIdx;
    braceCount = 0;
    while (funcEnd < bundle.length) {
      if (bundle[funcEnd] === '{') braceCount++;
      if (bundle[funcEnd] === '}') {
        braceCount--;
        if (braceCount === 0) break;
      }
      funcEnd++;
    }
    
    const funcCode = bundle.substring(Math.max(0, funcStart - 100), funcEnd + 100);
    console.log('Extracted function:');
    console.log(funcCode.substring(0, 2000));
  }
  
  // Also look for the specific encoding pattern
  // The output format: [chars]p[chars]p...
  // This suggests the function builds a string with 'p' separators
  
  // Find where 'p' is added to the result
  const pAddIdx = bundle.indexOf('+"p"');
  if (pAddIdx >= 0) {
    console.log('\n=== FOUND "p" ADDITION ===');
    const context = bundle.substring(Math.max(0, pAddIdx - 500), pAddIdx + 200);
    console.log(context);
  }
  
  // Alternative: look for 'p' in the alphabet array
  // The alphabet is: a-z, A-Z, 0-9, etc.
  // 'p' is at index 15 (0-indexed)
  
  // The encoding might use the alphabet index to encode values
  // Each value 0-63 maps to a character in the alphabet
  
  // Let's find where the alphabet is used for encoding
  const encodePatterns = [
    /h\[\s*\w+\s*%\s*\d+\s*\]/g,  // h[x % n]
    /h\[\s*\w+\s*&\s*\d+\s*\]/g,  // h[x & n]
    /h\[\s*\w+\s*>>\s*\d+\s*\]/g, // h[x >> n]
  ];
  
  console.log('\n=== ALPHABET ENCODING PATTERNS ===');
  for (const pattern of encodePatterns) {
    const matches = bundle.match(pattern);
    if (matches) {
      console.log(`Pattern ${pattern}: ${matches.length} matches`);
      matches.slice(0, 5).forEach(m => {
        const idx = bundle.indexOf(m);
        const context = bundle.substring(Math.max(0, idx - 100), idx + 100);
        console.log(`  Context: ${context.substring(0, 200)}`);
      });
    }
  }
}

async function main() {
  await extractFullEncoder();
  await analyzeEncodingAlgorithm();
  await extractCompleteFunction();
}

main().catch(console.error);
