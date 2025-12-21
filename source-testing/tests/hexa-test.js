/**
 * Test Hexa.su API with enc-dec.app decryption
 * Based on the Python script provided
 */

const crypto = require('crypto');

async function testHexa() {
  console.log('=== Testing Hexa.su API ===\n');
  
  // Generate 32-byte hex key (64 hex chars)
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Generated key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  // Test with Cyberpunk Edgerunners
  const tmdbId = '105248';
  const season = '1';
  const episode = '1';
  
  const url = `https://themoviedb.hexa.su/api/tmdb/tv/${tmdbId}/season/${season}/episode/${episode}/images`;
  
  console.log('Fetching:', url);
  
  // Get encrypted text
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  console.log('Encrypted response length:', encrypted.length);
  console.log('Encrypted preview:', encrypted.slice(0, 100));
  
  // Decrypt using enc-dec.app
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  
  const decResult = await decResponse.json();
  
  console.log('\n=== Decrypted Result ===\n');
  console.log(decResult.result);
  
  // Parse the result
  try {
    const parsed = JSON.parse(decResult.result);
    console.log('\n=== Parsed JSON ===\n');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('Not valid JSON');
  }
  
  return { encrypted, key, decrypted: decResult.result };
}

testHexa().catch(console.error);
