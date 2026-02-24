#!/usr/bin/env node
/**
 * Check if the pre-computed keystream is still valid by comparing
 * native decryption vs enc-dec.app API decryption.
 * Also derive a fresh keystream if the old one is stale.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const RUST_FETCH = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const OLD_KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';

function rustFetch(url) {
  const args = ['--url', url, '--timeout', '15', '--headers', JSON.stringify({ 'User-Agent': MEGAUP_UA })];
  try {
    return execFileSync(RUST_FETCH, args, { encoding: 'utf8', timeout: 20000, windowsHide: true }).trim();
  } catch (err) {
    if (err.stdout) return err.stdout.trim();
    throw err;
  }
}

async function main() {
  const embedUrl = 'https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const match = embedUrl.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
  const [, host, videoId] = match;
  const mediaUrl = `https://${host}/media/${videoId}`;

  console.log('=== Step 1: Fetch encrypted data via rust-fetch ===');
  const raw = rustFetch(mediaUrl);
  const mediaData = JSON.parse(raw);
  
  if (mediaData.status !== 200 || !mediaData.result) {
    console.log('FAIL: No encrypted result from MegaUp');
    return;
  }
  
  const encrypted = mediaData.result;
  console.log(`Encrypted (${encrypted.length} chars): ${encrypted.substring(0, 60)}...`);

  console.log('\n=== Step 2: Decrypt via enc-dec.app API (ground truth) ===');
  let apiDecrypted;
  try {
    const resp = await fetch('https://enc-dec.app/api/dec-mega', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: encrypted, agent: MEGAUP_UA }),
    });
    const apiResult = await resp.json();
    console.log(`API status: ${apiResult.status}`);
    
    if (apiResult.status === 200) {
      apiDecrypted = typeof apiResult.result === 'string' ? apiResult.result : JSON.stringify(apiResult.result);
      console.log(`API decrypted: ${apiDecrypted.substring(0, 150)}...`);
    } else {
      console.log('API decryption failed:', apiResult);
      console.log('\nTrying without enc-dec.app - deriving keystream from known plaintext...');
    }
  } catch (err) {
    console.log(`enc-dec.app error: ${err.message}`);
  }

  console.log('\n=== Step 3: Try old keystream ===');
  const oldKeystream = Buffer.from(OLD_KEYSTREAM_HEX, 'hex');
  const base64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  const decLen = Math.min(oldKeystream.length, encBytes.length);
  const oldDecBytes = Buffer.alloc(decLen);
  for (let i = 0; i < decLen; i++) {
    oldDecBytes[i] = encBytes[i] ^ oldKeystream[i];
  }
  const oldDecrypted = oldDecBytes.toString('utf8');
  console.log(`Old keystream decrypted (first 100): ${oldDecrypted.substring(0, 100)}`);
  
  let oldValid = false;
  try { JSON.parse(oldDecrypted); oldValid = true; } catch {}
  console.log(`Old keystream valid JSON: ${oldValid}`);

  if (apiDecrypted) {
    console.log('\n=== Step 4: Derive NEW keystream from API result ===');
    // XOR encrypted bytes with known plaintext to get keystream
    const plainBytes = Buffer.from(apiDecrypted, 'utf8');
    const newKeystreamLen = Math.min(plainBytes.length, encBytes.length);
    const newKeystream = Buffer.alloc(newKeystreamLen);
    
    for (let i = 0; i < newKeystreamLen; i++) {
      newKeystream[i] = encBytes[i] ^ plainBytes[i];
    }
    
    const newKeystreamHex = newKeystream.toString('hex');
    console.log(`New keystream length: ${newKeystreamLen} bytes`);
    console.log(`New keystream hex: ${newKeystreamHex}`);
    
    // Verify: does new keystream match old?
    const match = newKeystreamHex === OLD_KEYSTREAM_HEX.substring(0, newKeystreamHex.length);
    console.log(`\nKeystream match with old: ${match}`);
    
    if (!match) {
      console.log('\n*** KEYSTREAM HAS CHANGED! Update megaup-crypto.ts with: ***');
      console.log(`const MEGAUP_KEYSTREAM_HEX = '${newKeystreamHex}';`);
    }
    
    // Verify new keystream works
    console.log('\n=== Step 5: Verify new keystream ===');
    const verifyBytes = Buffer.alloc(newKeystreamLen);
    for (let i = 0; i < newKeystreamLen; i++) {
      verifyBytes[i] = encBytes[i] ^ newKeystream[i];
    }
    const verified = verifyBytes.toString('utf8');
    console.log(`Verified decryption: ${verified.substring(0, 150)}`);
    try {
      const parsed = JSON.parse(verified);
      const streamUrl = parsed.sources?.[0]?.file || parsed.file || '';
      console.log(`\nStream URL: ${streamUrl}`);
      console.log('SUCCESS!');
    } catch {
      console.log('Verification failed - not valid JSON');
    }
  }
}

main().catch(console.error);
