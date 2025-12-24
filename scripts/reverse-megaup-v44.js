#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v44
 * 
 * KEY INSIGHT: The keystream uses PLAINTEXT FEEDBACK
 * - First ~100 bytes decrypt correctly with static keystream
 * - After that, the keystream diverges based on the plaintext
 * 
 * Let's analyze the exact feedback mechanism by comparing
 * working vs failing videos byte-by-byte.
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Working keystream (derived from working video)
const KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const keystream = Buffer.from(KEYSTREAM_HEX, 'hex');

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

async function getDecryptedFromAPI(encrypted) {
  const response = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      text: encrypted.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
      agent: UA 
    }),
  });
  const result = await response.json();
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
}

async function analyzeVideo(videoId, label) {
  console.log(`\n=== Analyzing ${label}: ${videoId} ===\n`);
  
  const encBytes = await getEncryptedFromRPI(videoId);
  const decrypted = await getDecryptedFromAPI(encBytes);
  const decBytes = Buffer.from(decrypted, 'utf8');
  
  console.log(`Encrypted: ${encBytes.length} bytes`);
  console.log(`Decrypted: ${decBytes.length} bytes`);
  console.log(`Decrypted preview: ${decrypted.substring(0, 100)}...`);
  
  // Derive the actual keystream for this video
  const actualKeystream = [];
  for (let i = 0; i < decBytes.length; i++) {
    actualKeystream.push(encBytes[i] ^ decBytes[i]);
  }
  
  return { encBytes, decBytes, actualKeystream, decrypted };
}

async function main() {
  // Test videos
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';  // O5 suffix - works
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';  // M6 suffix - fails
  
  const working = await analyzeVideo(workingVideoId, 'WORKING');
  await new Promise(r => setTimeout(r, 500));
  const failing = await analyzeVideo(failingVideoId, 'FAILING');
  
  console.log('\n=== Comparing keystrams ===\n');
  
  // Find where they diverge
  let divergePos = -1;
  for (let i = 0; i < Math.min(working.actualKeystream.length, failing.actualKeystream.length); i++) {
    if (working.actualKeystream[i] !== failing.actualKeystream[i]) {
      divergePos = i;
      break;
    }
  }
  
  console.log(`Keystrams diverge at position: ${divergePos}`);
  
  if (divergePos > 0) {
    console.log('\n=== Around divergence point ===\n');
    console.log('Pos  W-key  F-key  W-enc  F-enc  W-dec  F-dec');
    console.log('---  -----  -----  -----  -----  -----  -----');
    
    for (let i = Math.max(0, divergePos - 5); i < Math.min(divergePos + 20, working.actualKeystream.length); i++) {
      const wKey = working.actualKeystream[i];
      const fKey = failing.actualKeystream[i];
      const wEnc = working.encBytes[i];
      const fEnc = failing.encBytes[i];
      const wDec = working.decBytes[i];
      const fDec = failing.decBytes[i];
      
      const wChar = wDec >= 32 && wDec < 127 ? String.fromCharCode(wDec) : '?';
      const fChar = fDec >= 32 && fDec < 127 ? String.fromCharCode(fDec) : '?';
      
      const marker = i === divergePos ? ' <-- DIVERGE' : '';
      
      console.log(`${i.toString().padStart(3)}  0x${wKey.toString(16).padStart(2,'0')}   0x${fKey.toString(16).padStart(2,'0')}   0x${wEnc.toString(16).padStart(2,'0')}   0x${fEnc.toString(16).padStart(2,'0')}   '${wChar}'    '${fChar}'${marker}`);
    }
  }
  
  // Analyze the feedback mechanism
  console.log('\n=== Analyzing feedback mechanism ===\n');
  
  // Hypothesis: keystream[i] = f(keystream[i-1], plaintext[i-1])
  // Let's test various feedback functions
  
  const wKs = working.actualKeystream;
  const wDec = working.decBytes;
  const fKs = failing.actualKeystream;
  const fDec = failing.decBytes;
  
  // Test: keystream[i] = keystream[i-1] XOR plaintext[i-1]
  let xorMatches = 0;
  for (let i = 1; i < wKs.length; i++) {
    const predicted = wKs[i-1] ^ wDec[i-1];
    if (predicted === wKs[i]) xorMatches++;
  }
  console.log(`XOR feedback: ${xorMatches}/${wKs.length-1} matches`);
  
  // Test: keystream[i] = (keystream[i-1] + plaintext[i-1]) mod 256
  let addMatches = 0;
  for (let i = 1; i < wKs.length; i++) {
    const predicted = (wKs[i-1] + wDec[i-1]) & 0xFF;
    if (predicted === wKs[i]) addMatches++;
  }
  console.log(`ADD feedback: ${addMatches}/${wKs.length-1} matches`);
  
  // Test: keystream[i] = (keystream[i-1] - plaintext[i-1]) mod 256
  let subMatches = 0;
  for (let i = 1; i < wKs.length; i++) {
    const predicted = (wKs[i-1] - wDec[i-1] + 256) & 0xFF;
    if (predicted === wKs[i]) subMatches++;
  }
  console.log(`SUB feedback: ${subMatches}/${wKs.length-1} matches`);
  
  // Test: keystream[i] = keystream[i-1] XOR ciphertext[i-1] (CFB-like)
  let cfbMatches = 0;
  for (let i = 1; i < wKs.length; i++) {
    const predicted = wKs[i-1] ^ working.encBytes[i-1];
    if (predicted === wKs[i]) cfbMatches++;
  }
  console.log(`CFB feedback: ${cfbMatches}/${wKs.length-1} matches`);
  
  // Let's look at the actual differences
  console.log('\n=== Keystream differences (first 20) ===\n');
  
  for (let i = 1; i < Math.min(21, wKs.length); i++) {
    const diff = (wKs[i] - wKs[i-1] + 256) & 0xFF;
    const xorDiff = wKs[i] ^ wKs[i-1];
    const plainPrev = wDec[i-1];
    const encPrev = working.encBytes[i-1];
    
    console.log(`i=${i.toString().padStart(2)}: ks[i]=0x${wKs[i].toString(16).padStart(2,'0')} ks[i-1]=0x${wKs[i-1].toString(16).padStart(2,'0')} diff=${diff.toString().padStart(3)} xor=0x${xorDiff.toString(16).padStart(2,'0')} plain[i-1]=0x${plainPrev.toString(16).padStart(2,'0')}('${String.fromCharCode(plainPrev)}') enc[i-1]=0x${encPrev.toString(16).padStart(2,'0')}`);
  }
  
  // Save the keystrams for further analysis
  const fs = require('fs');
  fs.writeFileSync('megaup-keystream-working.json', JSON.stringify({
    videoId: workingVideoId,
    keystream: working.actualKeystream,
    decrypted: working.decrypted
  }, null, 2));
  
  fs.writeFileSync('megaup-keystream-failing.json', JSON.stringify({
    videoId: failingVideoId,
    keystream: failing.actualKeystream,
    decrypted: failing.decrypted
  }, null, 2));
  
  console.log('\nSaved keystrams to megaup-keystream-working.json and megaup-keystream-failing.json');
}

main().catch(console.error);
