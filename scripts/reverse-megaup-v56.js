#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v56
 * 
 * KEY DISCOVERY: The encrypted data has a 196-byte TAIL that differs between videos!
 * 
 * Structure:
 * - First (length - 196) bytes: Ciphertext
 * - Last 196 bytes: Key material / metadata
 * 
 * The 196-byte tail might be used to derive the video-specific keystream!
 * 
 * Let me analyze the tail and see if it can be used to derive the keystream.
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

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
  return Buffer.from(base64, 'base64');
}

async function main() {
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  
  const wEnc = await getEncryptedFromRPI(workingVideoId);
  await new Promise(r => setTimeout(r, 500));
  const fEnc = await getEncryptedFromRPI(failingVideoId);
  
  // Extract ciphertext and tail
  const wCiphertext = wEnc.slice(0, -196);
  const wTail = wEnc.slice(-196);
  const fCiphertext = fEnc.slice(0, -196);
  const fTail = fEnc.slice(-196);
  
  console.log('=== Encrypted data structure ===\n');
  console.log(`Working: ${wCiphertext.length} bytes ciphertext + ${wTail.length} bytes tail`);
  console.log(`Failing: ${fCiphertext.length} bytes ciphertext + ${fTail.length} bytes tail`);
  
  // Verify ciphertext length matches decrypted length
  console.log(`\nCiphertext matches decrypted: working=${wCiphertext.length === wDec.length}, failing=${fCiphertext.length === fDec.length}`);
  
  // Analyze the tail
  console.log('\n=== Analyzing the 196-byte tail ===\n');
  
  console.log('Working tail (hex):');
  console.log(wTail.toString('hex'));
  
  console.log('\nFailing tail (hex):');
  console.log(fTail.toString('hex'));
  
  // Check if the tail is related to the keystream
  console.log('\n=== Checking if tail is related to keystream ===\n');
  
  // The tail is 196 bytes, but the keystream is 521+ bytes.
  // Maybe the tail is used to seed a PRNG that generates the keystream?
  
  // Or maybe the tail is XOR'd with something to produce the keystream?
  
  // Let's see if any part of the tail matches any part of the keystream.
  
  // Check if tail XOR'd with something gives the keystream
  // Try: keystream[i] = tail[i % 196] XOR something
  
  // First, let's see if the tail repeats in the keystream
  let tailInKs = false;
  for (let offset = 0; offset < wKs.length - 196; offset++) {
    let match = true;
    for (let i = 0; i < 196; i++) {
      if (wKs[offset + i] !== wTail[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`Tail found in keystream at offset ${offset}!`);
      tailInKs = true;
      break;
    }
  }
  
  if (!tailInKs) {
    console.log('Tail not found directly in keystream.');
  }
  
  // Let's see if the tail XOR'd with the UA gives the keystream
  const uaBytes = Buffer.from(UA, 'utf8');
  console.log(`\nUA length: ${uaBytes.length} bytes`);
  
  // Try: keystream[i] = tail[i % 196] XOR ua[i % ua.length]
  let xorMatches = 0;
  for (let i = 0; i < wKs.length; i++) {
    const predicted = wTail[i % 196] ^ uaBytes[i % uaBytes.length];
    if (predicted === wKs[i]) xorMatches++;
  }
  console.log(`tail XOR ua matches: ${xorMatches}/${wKs.length}`);
  
  // Try: keystream[i] = tail[i % 196] XOR tail[(i + some_offset) % 196]
  for (let offset = 1; offset < 196; offset++) {
    let matches = 0;
    for (let i = 0; i < wKs.length; i++) {
      const predicted = wTail[i % 196] ^ wTail[(i + offset) % 196];
      if (predicted === wKs[i]) matches++;
    }
    if (matches > wKs.length * 0.5) {
      console.log(`tail XOR tail[+${offset}] matches: ${matches}/${wKs.length}`);
    }
  }
  
  // Let's look at the relationship between the two tails
  console.log('\n=== Comparing tails ===\n');
  
  // XOR the two tails
  const tailXor = [];
  for (let i = 0; i < 196; i++) {
    tailXor.push(wTail[i] ^ fTail[i]);
  }
  
  console.log('Tail XOR (first 50 bytes):');
  console.log(Buffer.from(tailXor.slice(0, 50)).toString('hex'));
  
  // Check if tail XOR is related to keystream XOR
  const ksXor = [];
  for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
    ksXor.push(wKs[i] ^ fKs[i]);
  }
  
  console.log('\nKeystream XOR (first 50 bytes):');
  console.log(Buffer.from(ksXor.slice(0, 50)).toString('hex'));
  
  // Check if tail XOR repeats in keystream XOR
  let tailXorInKsXor = false;
  for (let offset = 0; offset < ksXor.length - 196; offset++) {
    let match = true;
    for (let i = 0; i < 196; i++) {
      if (ksXor[offset + i] !== tailXor[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`Tail XOR found in keystream XOR at offset ${offset}!`);
      tailXorInKsXor = true;
      break;
    }
  }
  
  if (!tailXorInKsXor) {
    console.log('\nTail XOR not found in keystream XOR.');
  }
  
  // Let's try a different approach: maybe the tail is the keystream itself,
  // but repeated/extended somehow.
  
  console.log('\n=== Checking if tail is the keystream seed ===\n');
  
  // If the keystream is generated by repeating the tail:
  // keystream[i] = tail[i % 196]
  
  let repeatMatches = 0;
  for (let i = 0; i < wKs.length; i++) {
    if (wKs[i] === wTail[i % 196]) repeatMatches++;
  }
  console.log(`Simple repeat matches: ${repeatMatches}/${wKs.length}`);
  
  // Maybe the keystream is generated by some transformation of the tail
  // Let's see if there's a pattern
  
  // Check the first 196 bytes of the keystream vs the tail
  console.log('\nFirst 196 bytes of keystream vs tail:');
  let first196Matches = 0;
  for (let i = 0; i < 196; i++) {
    if (wKs[i] === wTail[i]) first196Matches++;
  }
  console.log(`Matches: ${first196Matches}/196`);
  
  // Check if keystream[i] = tail[i] XOR something_constant
  const xorDiffs = [];
  for (let i = 0; i < 196; i++) {
    xorDiffs.push(wKs[i] ^ wTail[i]);
  }
  
  // Check if xorDiffs is constant
  const uniqueXorDiffs = new Set(xorDiffs);
  console.log(`Unique XOR diffs: ${uniqueXorDiffs.size}`);
  
  if (uniqueXorDiffs.size < 10) {
    console.log('XOR diffs:', Array.from(uniqueXorDiffs).map(d => '0x' + d.toString(16)).join(', '));
  }
  
  // Let's try to find the base keystream by using the enc-dec.app API
  // with a known plaintext attack.
  
  console.log('\n=== Attempting known plaintext attack ===\n');
  
  // We know the plaintext for both videos.
  // We can compute the keystream as: keystream[i] = ciphertext[i] XOR plaintext[i]
  
  // The keystream should be derivable from the tail + UA.
  
  // Let's see if there's a simple relationship.
  
  // Hypothesis: keystream = RC4(tail, UA)
  // Let's implement RC4 and test.
  
  function rc4(key, data) {
    // RC4 key scheduling
    const S = new Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) & 0xFF;
      [S[i], S[j]] = [S[j], S[i]];
    }
    
    // RC4 PRGA
    const output = [];
    let i = 0;
    j = 0;
    for (let k = 0; k < data; k++) {
      i = (i + 1) & 0xFF;
      j = (j + S[i]) & 0xFF;
      [S[i], S[j]] = [S[j], S[i]];
      output.push(S[(S[i] + S[j]) & 0xFF]);
    }
    
    return output;
  }
  
  // Try RC4 with tail as key
  const rc4Ks = rc4(wTail, wKs.length);
  let rc4Matches = 0;
  for (let i = 0; i < wKs.length; i++) {
    if (rc4Ks[i] === wKs[i]) rc4Matches++;
  }
  console.log(`RC4(tail) matches: ${rc4Matches}/${wKs.length}`);
  
  // Try RC4 with UA as key
  const rc4UaKs = rc4(uaBytes, wKs.length);
  let rc4UaMatches = 0;
  for (let i = 0; i < wKs.length; i++) {
    if (rc4UaKs[i] === wKs[i]) rc4UaMatches++;
  }
  console.log(`RC4(UA) matches: ${rc4UaMatches}/${wKs.length}`);
  
  // Try RC4 with tail + UA concatenated
  const tailUa = Buffer.concat([wTail, uaBytes]);
  const rc4TailUaKs = rc4(tailUa, wKs.length);
  let rc4TailUaMatches = 0;
  for (let i = 0; i < wKs.length; i++) {
    if (rc4TailUaKs[i] === wKs[i]) rc4TailUaMatches++;
  }
  console.log(`RC4(tail+UA) matches: ${rc4TailUaMatches}/${wKs.length}`);
  
  // Try RC4 with UA + tail concatenated
  const uaTail = Buffer.concat([uaBytes, wTail]);
  const rc4UaTailKs = rc4(uaTail, wKs.length);
  let rc4UaTailMatches = 0;
  for (let i = 0; i < wKs.length; i++) {
    if (rc4UaTailKs[i] === wKs[i]) rc4UaTailMatches++;
  }
  console.log(`RC4(UA+tail) matches: ${rc4UaTailMatches}/${wKs.length}`);
}

main().catch(console.error);
