/**
 * Extract 111movies encryption keys and algorithm
 */

async function extractKeys() {
  const res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.text();
  
  console.log('Bundle size:', data.length);
  
  // Find the AES key (32 bytes)
  const aesKeyMatch = data.match(/\[3,75,207,198[^\]]+\]/);
  if (aesKeyMatch) {
    console.log('\n=== AES KEY (32 bytes) ===');
    console.log(aesKeyMatch[0]);
  }
  
  // Find the IV (16 bytes)
  const ivMatch = data.match(/\[162,231,173,134[^\]]+\]/);
  if (ivMatch) {
    console.log('\n=== IV (16 bytes) ===');
    console.log(ivMatch[0]);
  }
  
  // Find the XOR key (9 bytes)
  const xorMatch = data.match(/\[170,162,126,126[^\]]+\]/);
  if (xorMatch) {
    console.log('\n=== XOR KEY (9 bytes) ===');
    console.log(xorMatch[0]);
  }
  
  // Find the standard alphabet
  const stdAlphaIdx = data.indexOf('["a","b","c","d","e","f"');
  if (stdAlphaIdx >= 0) {
    const endIdx = data.indexOf(']', stdAlphaIdx);
    console.log('\n=== STANDARD ALPHABET (h) ===');
    console.log(data.substring(stdAlphaIdx, endIdx + 1));
  }
  
  // Find the shuffled alphabet
  const shuffledIdx = data.indexOf('["T","u","z","H"');
  if (shuffledIdx >= 0) {
    const endIdx = data.indexOf(']', shuffledIdx);
    console.log('\n=== SHUFFLED ALPHABET (m) ===');
    console.log(data.substring(shuffledIdx, endIdx + 1));
  }
  
  // Find the encoding logic
  const encodeIdx = data.indexOf('replace(/\\+/g');
  if (encodeIdx >= 0) {
    console.log('\n=== ENCODING LOGIC ===');
    console.log(data.substring(encodeIdx - 100, encodeIdx + 300));
  }
  
  // Find the full encoding function context
  const cipherIdx = data.indexOf('createCiph');
  if (cipherIdx >= 0) {
    console.log('\n=== FULL CIPHER CONTEXT ===');
    console.log(data.substring(cipherIdx - 200, cipherIdx + 2000));
  }
}

extractKeys().catch(console.error);
