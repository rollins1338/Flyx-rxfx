#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v46
 * 
 * NEW INSIGHT: The keystream might be computed DYNAMICALLY during decryption!
 * 
 * The encrypted bytes at position 33 are IDENTICAL (0xc7)
 * But the decrypted bytes differ ('l' vs 'c')
 * This means the keystream at position 33 differs (0xab vs 0xa4)
 * 
 * But all previous plaintext was identical!
 * 
 * Wait... let me re-check. Maybe the encrypted bytes are NOT identical?
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
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  
  console.log('Fetching encrypted data...\n');
  
  const working = await getEncryptedFromRPI(workingVideoId);
  await new Promise(r => setTimeout(r, 500));
  const failing = await getEncryptedFromRPI(failingVideoId);
  
  console.log(`Working encrypted: ${working.bytes.length} bytes`);
  console.log(`Failing encrypted: ${failing.bytes.length} bytes`);
  
  // Compare encrypted bytes
  console.log('\n=== Comparing ENCRYPTED bytes ===\n');
  
  let firstDiff = -1;
  for (let i = 0; i < Math.min(working.bytes.length, failing.bytes.length); i++) {
    if (working.bytes[i] !== failing.bytes[i]) {
      firstDiff = i;
      break;
    }
  }
  
  console.log(`First difference in encrypted bytes: position ${firstDiff}`);
  
  if (firstDiff > 0) {
    console.log('\nAround first difference:');
    for (let i = Math.max(0, firstDiff - 3); i < Math.min(firstDiff + 10, working.bytes.length); i++) {
      const wEnc = working.bytes[i];
      const fEnc = failing.bytes[i];
      const marker = i === firstDiff ? ' <-- FIRST DIFF' : '';
      console.log(`pos ${i.toString().padStart(3)}: working=0x${wEnc.toString(16).padStart(2,'0')} failing=0x${fEnc.toString(16).padStart(2,'0')}${marker}`);
    }
  }
  
  // Get decrypted data
  console.log('\nFetching decrypted data from API...\n');
  
  const wDecrypted = await getDecryptedFromAPI(working.raw);
  await new Promise(r => setTimeout(r, 500));
  const fDecrypted = await getDecryptedFromAPI(failing.raw);
  
  const wDecBytes = Buffer.from(wDecrypted, 'utf8');
  const fDecBytes = Buffer.from(fDecrypted, 'utf8');
  
  console.log(`Working decrypted: ${wDecBytes.length} bytes`);
  console.log(`Failing decrypted: ${fDecBytes.length} bytes`);
  
  // Compare decrypted bytes
  console.log('\n=== Comparing DECRYPTED bytes ===\n');
  
  let firstDecDiff = -1;
  for (let i = 0; i < Math.min(wDecBytes.length, fDecBytes.length); i++) {
    if (wDecBytes[i] !== fDecBytes[i]) {
      firstDecDiff = i;
      break;
    }
  }
  
  console.log(`First difference in decrypted bytes: position ${firstDecDiff}`);
  
  if (firstDecDiff > 0) {
    console.log('\nAround first difference:');
    for (let i = Math.max(0, firstDecDiff - 3); i < Math.min(firstDecDiff + 10, wDecBytes.length); i++) {
      const wDec = wDecBytes[i];
      const fDec = fDecBytes[i];
      const wChar = wDec >= 32 && wDec < 127 ? String.fromCharCode(wDec) : '?';
      const fChar = fDec >= 32 && fDec < 127 ? String.fromCharCode(fDec) : '?';
      const marker = i === firstDecDiff ? ' <-- FIRST DIFF' : '';
      console.log(`pos ${i.toString().padStart(3)}: working='${wChar}' (0x${wDec.toString(16).padStart(2,'0')}) failing='${fChar}' (0x${fDec.toString(16).padStart(2,'0')})${marker}`);
    }
  }
  
  // Now the key insight: if encrypted bytes differ at position X,
  // and decrypted bytes differ at position Y,
  // then the keystream must be the same up to min(X, Y)
  
  console.log('\n=== Analysis ===\n');
  console.log(`Encrypted bytes first differ at: ${firstDiff}`);
  console.log(`Decrypted bytes first differ at: ${firstDecDiff}`);
  
  if (firstDiff === firstDecDiff) {
    console.log('\nEncrypted and decrypted bytes differ at the SAME position!');
    console.log('This means the keystream is IDENTICAL for both videos.');
    console.log('The different decrypted output is simply because the encrypted input differs.');
    
    // Derive the keystream
    console.log('\n=== Deriving keystream ===\n');
    
    const keystream = [];
    for (let i = 0; i < wDecBytes.length; i++) {
      keystream.push(working.bytes[i] ^ wDecBytes[i]);
    }
    
    // Verify with failing video
    let matches = 0;
    for (let i = 0; i < fDecBytes.length; i++) {
      const predicted = failing.bytes[i] ^ keystream[i];
      if (predicted === fDecBytes[i]) matches++;
    }
    
    console.log(`Keystream verification: ${matches}/${fDecBytes.length} bytes match`);
    
    if (matches === fDecBytes.length) {
      console.log('\n*** KEYSTREAM IS IDENTICAL FOR BOTH VIDEOS! ***');
      console.log('The pre-computed keystream should work for ALL videos!');
      
      // Save the keystream
      const fs = require('fs');
      const ksHex = Buffer.from(keystream).toString('hex');
      console.log(`\nKeystream (${keystream.length} bytes):`);
      console.log(ksHex);
      
      fs.writeFileSync('megaup-keystream-final.json', JSON.stringify({
        ua: UA,
        length: keystream.length,
        hex: ksHex
      }, null, 2));
      
      console.log('\nSaved to megaup-keystream-final.json');
    }
  } else {
    console.log('\nEncrypted and decrypted bytes differ at DIFFERENT positions!');
    console.log('This suggests the keystream is video-specific.');
    
    // Let's see what's happening
    const minDiff = Math.min(firstDiff, firstDecDiff);
    const maxDiff = Math.max(firstDiff, firstDecDiff);
    
    console.log(`\nRange ${minDiff} to ${maxDiff}:`);
    for (let i = minDiff; i <= maxDiff + 5; i++) {
      const wEnc = working.bytes[i];
      const fEnc = failing.bytes[i];
      const wDec = wDecBytes[i];
      const fDec = fDecBytes[i];
      const wKey = wEnc ^ wDec;
      const fKey = fEnc ^ fDec;
      
      console.log(`pos ${i}: wEnc=0x${wEnc.toString(16).padStart(2,'0')} fEnc=0x${fEnc.toString(16).padStart(2,'0')} wDec='${String.fromCharCode(wDec)}' fDec='${String.fromCharCode(fDec)}' wKey=0x${wKey.toString(16).padStart(2,'0')} fKey=0x${fKey.toString(16).padStart(2,'0')}`);
    }
  }
}

main().catch(console.error);
