#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v52
 * 
 * NEW HYPOTHESIS: The keystream is seeded with the video ID!
 * 
 * The video IDs are:
 * - Working: jIrrLzj-WS2JcOLzF79O5xvpCQ
 * - Failing: jKfJZ2GHWS2JcOLzF79M6RvpCQ
 * 
 * They share a common prefix: "j" and suffix: "WS2JcOLzF79...xvpCQ"
 * The middle part differs.
 * 
 * But wait - if the keystream is seeded with the video ID, then the
 * keystream should be completely different from the start, not just
 * from position 33!
 * 
 * Let me re-examine the data...
 * 
 * Actually, I think I've been overcomplicating this. Let me go back to basics.
 * 
 * The enc-dec.app API takes:
 * - text: the encrypted base64 string
 * - agent: the User-Agent
 * 
 * And returns the decrypted JSON.
 * 
 * The API doesn't take the video ID as input! So the decryption must be
 * deterministic given just the encrypted data and User-Agent.
 * 
 * This means the keystream is derived from:
 * 1. The User-Agent (we know this)
 * 2. Something in the encrypted data itself
 * 
 * The encrypted data might contain:
 * - A nonce/IV at the beginning
 * - The video ID embedded somewhere
 * - Some other metadata
 * 
 * Let me look at the encrypted data more carefully.
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
  
  return data.result;
}

async function main() {
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  
  console.log('Fetching encrypted data...\n');
  
  const workingEnc = await getEncryptedFromRPI(workingVideoId);
  await new Promise(r => setTimeout(r, 500));
  const failingEnc = await getEncryptedFromRPI(failingVideoId);
  
  console.log(`Working encrypted (base64): ${workingEnc.length} chars`);
  console.log(`Failing encrypted (base64): ${failingEnc.length} chars`);
  
  // Convert to bytes
  const wBytes = Buffer.from(workingEnc.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const fBytes = Buffer.from(failingEnc.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  
  console.log(`\nWorking encrypted (bytes): ${wBytes.length}`);
  console.log(`Failing encrypted (bytes): ${fBytes.length}`);
  
  // The encrypted data is 717 vs 720 bytes
  // The decrypted data is 521 vs 524 bytes
  // Difference: 196 bytes (same for both)
  
  // This 196-byte overhead might be:
  // - A header with metadata
  // - Padding
  // - A MAC/signature
  
  console.log('\n=== Analyzing encrypted data structure ===\n');
  
  // Look at the first 50 bytes
  console.log('First 50 bytes (working):');
  console.log(wBytes.slice(0, 50).toString('hex'));
  console.log('\nFirst 50 bytes (failing):');
  console.log(fBytes.slice(0, 50).toString('hex'));
  
  // Find first difference
  let firstDiff = -1;
  for (let i = 0; i < Math.min(wBytes.length, fBytes.length); i++) {
    if (wBytes[i] !== fBytes[i]) {
      firstDiff = i;
      break;
    }
  }
  console.log(`\nFirst byte difference at position: ${firstDiff}`);
  
  // Look at the last 50 bytes
  console.log('\nLast 50 bytes (working):');
  console.log(wBytes.slice(-50).toString('hex'));
  console.log('\nLast 50 bytes (failing):');
  console.log(fBytes.slice(-50).toString('hex'));
  
  // The encrypted data might have a structure like:
  // [header/IV] [encrypted payload] [MAC/padding]
  
  // Let's see if the first 196 bytes are different or the same
  console.log('\n=== Comparing first 196 bytes (overhead) ===\n');
  
  let overheadDiffs = 0;
  for (let i = 0; i < 196; i++) {
    if (wBytes[i] !== fBytes[i]) {
      overheadDiffs++;
      if (overheadDiffs <= 10) {
        console.log(`Diff at ${i}: working=0x${wBytes[i].toString(16).padStart(2,'0')} failing=0x${fBytes[i].toString(16).padStart(2,'0')}`);
      }
    }
  }
  console.log(`Total differences in first 196 bytes: ${overheadDiffs}`);
  
  // Let's see if the overhead is at the beginning or end
  console.log('\n=== Checking if overhead is at beginning or end ===\n');
  
  // If overhead is at the beginning, then bytes 196+ should be the ciphertext
  // If overhead is at the end, then bytes 0 to (length-196) should be the ciphertext
  
  // We know the ciphertext is identical for positions 0-99 (of the decrypted data)
  // So let's see where that maps to in the encrypted data
  
  // Actually, let me just try decrypting with different offsets
  
  // First, let's see if there's a pattern in the encrypted data
  // that might indicate where the actual ciphertext starts
  
  console.log('\n=== Looking for patterns ===\n');
  
  // Check if any bytes repeat in a pattern
  const byteFreq = new Array(256).fill(0);
  for (const b of wBytes) {
    byteFreq[b]++;
  }
  
  // Find most common bytes
  const sorted = byteFreq.map((count, byte) => ({ byte, count }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
  
  console.log('Most common bytes in working encrypted data:');
  for (let i = 0; i < 10; i++) {
    console.log(`  0x${sorted[i].byte.toString(16).padStart(2,'0')}: ${sorted[i].count} times`);
  }
  
  // The encrypted data should look random if it's properly encrypted
  // Let's check the entropy
  const total = wBytes.length;
  let entropy = 0;
  for (const { count } of sorted) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }
  console.log(`\nEntropy: ${entropy.toFixed(2)} bits (max 8)`);
  
  // High entropy suggests good encryption
  // Let's see if there's any structure we can exploit
  
  // Actually, let me try a different approach.
  // The enc-dec.app API must be doing something to derive the keystream.
  // Let me see if I can figure out what by testing with different inputs.
  
  console.log('\n=== Testing enc-dec.app API behavior ===\n');
  
  // Test 1: Same encrypted data, different UA
  const ua2 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  const response1 = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: workingEnc, agent: UA }),
  });
  const result1 = await response1.json();
  
  await new Promise(r => setTimeout(r, 500));
  
  const response2 = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: workingEnc, agent: ua2 }),
  });
  const result2 = await response2.json();
  
  console.log('Same encrypted data, different UA:');
  console.log(`  UA1 (short): ${result1.status === 200 ? 'Success' : 'Failed'}`);
  console.log(`  UA2 (long):  ${result2.status === 200 ? 'Success' : 'Failed'}`);
  
  if (result1.status === 200 && result2.status === 200) {
    const dec1 = typeof result1.result === 'string' ? result1.result : JSON.stringify(result1.result);
    const dec2 = typeof result2.result === 'string' ? result2.result : JSON.stringify(result2.result);
    
    console.log(`  UA1 decrypted: ${dec1.substring(0, 50)}...`);
    console.log(`  UA2 decrypted: ${dec2.substring(0, 50)}...`);
    
    if (dec1 === dec2) {
      console.log('  Result: SAME (UA doesn\'t matter!)');
    } else {
      console.log('  Result: DIFFERENT (UA affects decryption)');
    }
  }
  
  // Test 2: Modified encrypted data
  console.log('\nModified encrypted data (flip one bit):');
  
  const modifiedEnc = workingEnc.substring(0, 10) + 
    String.fromCharCode(workingEnc.charCodeAt(10) ^ 1) + 
    workingEnc.substring(11);
  
  const response3 = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: modifiedEnc, agent: UA }),
  });
  const result3 = await response3.json();
  
  console.log(`  Modified: ${result3.status === 200 ? 'Success' : 'Failed'}`);
  if (result3.status === 200) {
    const dec3 = typeof result3.result === 'string' ? result3.result : JSON.stringify(result3.result);
    console.log(`  Decrypted: ${dec3.substring(0, 50)}...`);
  }
}

main().catch(console.error);
