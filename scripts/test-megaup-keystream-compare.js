#!/usr/bin/env node
/**
 * Compare keystreams derived from two different videos to see if they match.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const RUST_FETCH = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function rustFetch(url) {
  const args = ['--url', url, '--timeout', '15', '--headers', JSON.stringify({ 'User-Agent': MEGAUP_UA })];
  try {
    return execFileSync(RUST_FETCH, args, { encoding: 'utf8', timeout: 20000, windowsHide: true }).trim();
  } catch (err) {
    if (err.stdout) return err.stdout.trim();
    throw err;
  }
}

async function deriveKeystream(name, mediaUrl) {
  console.log(`\n=== ${name} ===`);
  const raw = rustFetch(mediaUrl);
  const mediaData = JSON.parse(raw);
  const encrypted = mediaData.result;
  
  // Get ground truth from enc-dec.app
  const resp = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, agent: MEGAUP_UA }),
  });
  const apiResult = await resp.json();
  if (apiResult.status !== 200) {
    console.log('API failed:', apiResult);
    return null;
  }
  
  const plaintext = typeof apiResult.result === 'string' ? apiResult.result : JSON.stringify(apiResult.result);
  console.log(`Plaintext (first 80): ${plaintext.substring(0, 80)}`);
  
  const base64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  const plainBytes = Buffer.from(plaintext, 'utf8');
  
  const len = Math.min(encBytes.length, plainBytes.length);
  const keystream = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    keystream[i] = encBytes[i] ^ plainBytes[i];
  }
  
  console.log(`Encrypted bytes: ${encBytes.length}, Plaintext bytes: ${plainBytes.length}, Keystream: ${len}`);
  return keystream;
}

async function main() {
  const ks1 = await deriveKeystream('Gachiakuta', 'https://megaup22.online/media/jIrrLzj-WS2JcOLzF79O5xvpCQ');
  const ks2 = await deriveKeystream('Naruto', 'https://megaup22.online/media/k5OoeWapWS2JcOLzF79O5xvpCQ');
  
  if (!ks1 || !ks2) return;
  
  const minLen = Math.min(ks1.length, ks2.length);
  let firstDiff = -1;
  for (let i = 0; i < minLen; i++) {
    if (ks1[i] !== ks2[i]) {
      firstDiff = i;
      break;
    }
  }
  
  console.log(`\n=== Comparison ===`);
  console.log(`KS1 length: ${ks1.length}, KS2 length: ${ks2.length}`);
  console.log(`First difference at byte: ${firstDiff}`);
  if (firstDiff === -1) {
    console.log('KEYSTREAMS ARE IDENTICAL (up to min length)');
  } else {
    console.log(`KS1[${firstDiff}] = 0x${ks1[firstDiff].toString(16)}, KS2[${firstDiff}] = 0x${ks2[firstDiff].toString(16)}`);
  }
}

main().catch(console.error);
