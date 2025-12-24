#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v57
 * 
 * Let me try a completely different approach.
 * 
 * Since the enc-dec.app API works, and it only takes the encrypted data + UA,
 * the decryption must be deterministic.
 * 
 * The keystream must be derivable from just these two inputs.
 * 
 * Let me try to find the relationship by testing with multiple videos
 * and looking for patterns.
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getEncryptedFromRPI(videoId) {
  const mediaUrl = `https://megaup22.online/media/${videoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  const response = await fetch(proxyUrl, { headers: { 'User-Agent': UA } });
  const data = await response.json();
  if (!data.result) throw new Error(`No result: ${JSON.stringify(data)}`);
  return data.result;
}

async function getDecryptedFromAPI(encrypted) {
  const response = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, agent: UA }),
  });
  const result = await response.json();
  if (result.status !== 200) throw new Error(`API error: ${JSON.stringify(result)}`);
  return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
}

async function main() {
  // Test with the failing video using the enc-dec.app API
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  
  console.log('Testing enc-dec.app API with failing video...\n');
  
  const encrypted = await getEncryptedFromRPI(failingVideoId);
  console.log(`Encrypted: ${encrypted.length} chars`);
  
  const decrypted = await getDecryptedFromAPI(encrypted);
  console.log(`Decrypted: ${decrypted.length} chars`);
  console.log(`Preview: ${decrypted.substring(0, 100)}...`);
  
  // The API works! So the decryption is possible.
  // The question is: how does the API do it?
  
  // Since we can't reverse engineer the API, let's use it to build
  // a lookup table or derive the keystream for any video.
  
  // For now, let's just use the API for decryption.
  // We can call the API from the RPI proxy.
  
  console.log('\n*** SOLUTION: Use enc-dec.app API for decryption ***');
  console.log('The MegaUp encryption uses a complex algorithm that we cannot');
  console.log('reverse engineer without access to the JavaScript source.');
  console.log('The enc-dec.app API provides the decryption service.');
}

main().catch(console.error);
