#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v49
 * 
 * BREAKTHROUGH: keystream_w XOR keystream_f = plaintext_w XOR plaintext_f
 * 
 * This means the ciphertext is IDENTICAL for both videos at positions 0-99!
 * (We already knew this from the encrypted bytes comparison)
 * 
 * The keystream must be computed from the CIPHERTEXT, not the plaintext.
 * This is a CFB-like (Cipher Feedback) mode!
 * 
 * In CFB mode:
 *   keystream[i] = E(key, ciphertext[i-1])
 *   plaintext[i] = ciphertext[i] XOR keystream[i]
 * 
 * But MegaUp might use a simpler variant:
 *   keystream[i] = f(keystream[i-1], ciphertext[i-1])
 * 
 * Let's test this!
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getEncryptedFromRPI(videoId) {
  const mediaUrl = `https://megaup22.online/media/${videoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl, {
    headers: { 'User-Agent': UA }
  });
  const data = await response.json();
  
  if (!data.result) {
    throw new Error(`No result for ${videoId}: ${JSON.stringify(data)}`);
  }
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  return { raw: data.result, bytes: Buffer.from(base64, 'base64') };
}

async function getDecryptedFromAPI(encryptedBase64) {
  const response = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encryptedBase64, agent: UA }),
  });
  const result = await response.json();
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
}

async function main() {
  const videoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  
  console.log('Fetching data...\n');
  
  const encrypted = await getEncryptedFromRPI(videoId);
  const decrypted = await getDecryptedFromAPI(encrypted.raw);
  
  const encBytes = encrypted.bytes;
  const decBytes = Buffer.from(decrypted, 'utf8');
  
  // Derive keystream
  const keystream = [];
  for (let i = 0; i < decBytes.length; i++) {
    keystream.push(encBytes[i] ^ decBytes[i]);
  }
  
  console.log(`Encrypted: ${encBytes.length} bytes`);
  console.log(`Decrypted: ${decBytes.length} bytes`);
  console.log(`Keystream: ${keystream.length} bytes`);
  
  console.log('\n=== Testing CFB-like feedback ===\n');
  
  // Test: keystream[i] = f(keystream[i-1], ciphertext[i-1])
  
  // Try XOR
  let xorMatches = 0;
  for (let i = 1; i < keystream.length; i++) {
    const predicted = keystream[i-1] ^ encBytes[i-1];
    if (predicted === keystream[i]) xorMatches++;
  }
  console.log(`keystream[i] = keystream[i-1] XOR ciphertext[i-1]: ${xorMatches}/${keystream.length-1} matches`);
  
  // Try ADD
  let addMatches = 0;
  for (let i = 1; i < keystream.length; i++) {
    const predicted = (keystream[i-1] + encBytes[i-1]) & 0xFF;
    if (predicted === keystream[i]) addMatches++;
  }
  console.log(`keystream[i] = (keystream[i-1] + ciphertext[i-1]) mod 256: ${addMatches}/${keystream.length-1} matches`);
  
  // Try SUB
  let subMatches = 0;
  for (let i = 1; i < keystream.length; i++) {
    const predicted = (keystream[i-1] - encBytes[i-1] + 256) & 0xFF;
    if (predicted === keystream[i]) subMatches++;
  }
  console.log(`keystream[i] = (keystream[i-1] - ciphertext[i-1]) mod 256: ${subMatches}/${keystream.length-1} matches`);
  
  // Try with plaintext instead
  console.log('\n=== Testing plaintext feedback ===\n');
  
  xorMatches = 0;
  for (let i = 1; i < keystream.length; i++) {
    const predicted = keystream[i-1] ^ decBytes[i-1];
    if (predicted === keystream[i]) xorMatches++;
  }
  console.log(`keystream[i] = keystream[i-1] XOR plaintext[i-1]: ${xorMatches}/${keystream.length-1} matches`);
  
  addMatches = 0;
  for (let i = 1; i < keystream.length; i++) {
    const predicted = (keystream[i-1] + decBytes[i-1]) & 0xFF;
    if (predicted === keystream[i]) addMatches++;
  }
  console.log(`keystream[i] = (keystream[i-1] + plaintext[i-1]) mod 256: ${addMatches}/${keystream.length-1} matches`);
  
  // The feedback is clearly more complex. Let's look at the actual values.
  console.log('\n=== Analyzing keystream generation ===\n');
  
  // Maybe it's RC4-like with state modification
  // RC4: j = (j + S[i] + key[i mod keylen]) mod 256; swap S[i], S[j]; output S[(S[i]+S[j]) mod 256]
  
  // Let's see if we can find any pattern by looking at consecutive keystream bytes
  console.log('First 30 keystream transitions:');
  console.log('i | ks[i-1] | ks[i] | diff | enc[i-1] | dec[i-1]');
  console.log('--|---------|-------|------|----------|----------');
  
  for (let i = 1; i < 31; i++) {
    const diff = (keystream[i] - keystream[i-1] + 256) & 0xFF;
    console.log(`${i.toString().padStart(2)} | 0x${keystream[i-1].toString(16).padStart(2,'0')}    | 0x${keystream[i].toString(16).padStart(2,'0')}  | ${diff.toString().padStart(4)} | 0x${encBytes[i-1].toString(16).padStart(2,'0')}     | 0x${decBytes[i-1].toString(16).padStart(2,'0')} ('${String.fromCharCode(decBytes[i-1])}')`);
  }
  
  // Let's try to find if there's a lookup table involved
  console.log('\n=== Looking for S-box patterns ===\n');
  
  // If there's an S-box, the keystream might be: S[f(i, ciphertext)]
  // Let's see if the same input produces the same output
  
  const inputToOutput = new Map();
  for (let i = 1; i < keystream.length; i++) {
    // Try various input combinations
    const input1 = encBytes[i-1];
    const input2 = (keystream[i-1] + encBytes[i-1]) & 0xFF;
    const input3 = keystream[i-1] ^ encBytes[i-1];
    
    const key = `${input1},${input2},${input3}`;
    if (!inputToOutput.has(key)) {
      inputToOutput.set(key, []);
    }
    inputToOutput.get(key).push({ i, output: keystream[i] });
  }
  
  // Check if same input always produces same output
  let consistent = 0;
  let inconsistent = 0;
  for (const [key, outputs] of inputToOutput) {
    if (outputs.length > 1) {
      const allSame = outputs.every(o => o.output === outputs[0].output);
      if (allSame) consistent++;
      else inconsistent++;
    }
  }
  
  console.log(`Input combinations with multiple occurrences: ${consistent + inconsistent}`);
  console.log(`Consistent (same output): ${consistent}`);
  console.log(`Inconsistent (different output): ${inconsistent}`);
  
  // The keystream is likely generated by a PRNG seeded with the User-Agent
  // and the state is updated based on the ciphertext/plaintext
  
  // Let's try a different approach: assume the keystream is pre-computed
  // and then XORed with a running value based on plaintext
  
  console.log('\n=== Testing pre-computed keystream with plaintext XOR ===\n');
  
  // Hypothesis: actual_keystream[i] = base_keystream[i] XOR running_xor
  // where running_xor = XOR of all previous plaintext bytes
  
  let runningXor = 0;
  const baseKeystream = [];
  
  for (let i = 0; i < keystream.length; i++) {
    baseKeystream.push(keystream[i] ^ runningXor);
    runningXor ^= decBytes[i];
  }
  
  console.log('Base keystream (first 50 bytes):');
  console.log(baseKeystream.slice(0, 50).map(k => k.toString(16).padStart(2, '0')).join(' '));
  
  // Now let's verify this with the failing video
  const fs = require('fs');
  const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));
  const fKs = failing.keystream;
  const fDec = Buffer.from(failing.decrypted, 'utf8');
  
  // Compute base keystream for failing video
  runningXor = 0;
  const fBaseKeystream = [];
  
  for (let i = 0; i < fKs.length; i++) {
    fBaseKeystream.push(fKs[i] ^ runningXor);
    runningXor ^= fDec[i];
  }
  
  console.log('\nFailing base keystream (first 50 bytes):');
  console.log(fBaseKeystream.slice(0, 50).map(k => k.toString(16).padStart(2, '0')).join(' '));
  
  // Compare
  let baseMatches = 0;
  for (let i = 0; i < Math.min(baseKeystream.length, fBaseKeystream.length); i++) {
    if (baseKeystream[i] === fBaseKeystream[i]) baseMatches++;
  }
  
  console.log(`\nBase keystream matches: ${baseMatches}/${Math.min(baseKeystream.length, fBaseKeystream.length)}`);
  
  if (baseMatches === Math.min(baseKeystream.length, fBaseKeystream.length)) {
    console.log('\n*** BASE KEYSTREAM IS IDENTICAL! ***');
    console.log('The cipher is: plaintext[i] = ciphertext[i] XOR base_keystream[i] XOR running_xor');
    console.log('where running_xor = XOR of plaintext[0:i-1]');
    
    // Save the base keystream
    const ksHex = Buffer.from(baseKeystream).toString('hex');
    fs.writeFileSync('megaup-base-keystream.json', JSON.stringify({
      ua: UA,
      length: baseKeystream.length,
      hex: ksHex,
      algorithm: 'plaintext[i] = ciphertext[i] XOR base_keystream[i] XOR xor(plaintext[0:i-1])'
    }, null, 2));
    
    console.log('\nSaved base keystream to megaup-base-keystream.json');
  }
}

main().catch(console.error);
