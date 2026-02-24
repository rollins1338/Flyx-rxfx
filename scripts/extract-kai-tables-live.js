#!/usr/bin/env node
/**
 * Extract AnimeKai's LIVE encryption tables by:
 * 1. Encrypting every printable ASCII char at each position using the site's own JS
 * 2. Building the tables from observed input→output pairs
 * 
 * Strategy: We know the encrypt function takes plaintext and produces base64.
 * We can call it from the page context via the AJAX pattern.
 * 
 * Actually simpler: we know the encrypt works by position-dependent substitution.
 * We can encrypt single chars at each position and observe the cipher bytes.
 * 
 * Even simpler: We can encrypt known strings and compare cipher bytes to build tables.
 * For position N, encrypt a string of length N+1 where the last char varies.
 * The cipher byte at cipher_pos(N) will tell us the table entry.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

function rustExec(url, mode) {
  return execFileSync(RUST, ['--url', url, '--mode', mode], { encoding: 'utf8', timeout: 5000 }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };

async function main() {
  // The key insight: the server VALIDATES our encrypted tokens.
  // If we send encrypt("X") and the server accepts it, our table for that position is correct.
  // If it rejects, the table is wrong.
  
  // But we already know Rust encrypt WORKS (server accepts our tokens).
  // The issue is only with DECRYPT.
  
  // So the server uses DIFFERENT tables for encryption vs decryption?
  // Or the server encrypts with one set and we need to decrypt with the matching set?
  
  // Wait - let me re-think. The flow is:
  // 1. Client encrypts plaintext → sends as _ parameter → server validates
  // 2. Server encrypts response → client decrypts
  // 
  // If the server uses the SAME tables, then our encrypt tables should work for decrypt too.
  // But they don't. So either:
  // a) Server uses different tables for its encryption
  // b) The table mapping (position → table) is different for server-side encryption
  // c) There's an additional transformation we're missing
  
  // Let me test: encrypt a known string, then check if we can decrypt it back
  console.log('=== Roundtrip test ===');
  const testStr = 'hello';
  const enc = rustExec(testStr, 'kai-encrypt');
  const dec = rustExec(enc, 'kai-decrypt');
  console.log(`"${testStr}" → "${enc}" → "${dec}" ${dec === testStr ? '✓' : '✗'}`);
  
  // Roundtrip works! So our tables are self-consistent.
  // The problem is that the SERVER uses different tables.
  
  // Let me get a real server response and analyze it
  console.log('\n=== Getting real server response ===');
  const sr = await fetch('https://animekai.to/ajax/anime/search?keyword=bleach', KAI_HDRS);
  const sd = JSON.parse(sr.body);
  const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
  const wp = await fetch('https://animekai.to/watch/' + slug);
  const sync = JSON.parse(wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const animeId = sync.anime_id;
  
  // Also get the window.__$ key from the page
  const keyMatch = wp.body.match(/window\.__\$\s*=\s*'([^']+)'/);
  const pageKey = keyMatch ? keyMatch[1] : null;
  console.log('anime_id:', animeId);
  console.log('window.__$:', pageKey ? pageKey.substring(0, 40) + '...' : 'NOT FOUND');
  
  // Get episodes and a link view response
  const encId = rustExec(animeId, 'kai-encrypt');
  const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
  const epData = JSON.parse(epResp.body);
  const token = epData.result.match(/token="([^"]+)"/)[1];
  
  const encToken = rustExec(token, 'kai-encrypt');
  const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
  const srvData = JSON.parse(srvResp.body);
  const lid = srvData.result.match(/data-lid="([^"]+)"/)[1];
  
  const encLid = rustExec(lid, 'kai-encrypt');
  const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
  const viewData = JSON.parse(viewResp.body);
  const encrypted = viewData.result;
  
  console.log('Encrypted response:', encrypted.substring(0, 60) + '...');
  
  // Decode to raw bytes
  const b64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
  const header = buf.slice(0, 21);
  const data = buf.slice(21);
  
  console.log('Header:', header.toString('hex'));
  console.log('Data length:', data.length);
  
  // The cipher position mapping
  const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);
  
  // We know the plaintext should be JSON: {"url":"https://DOMAIN/e/VIDEO_ID","skip":{...}}
  // The domain from previous output was: 4spromax.site
  // Let's try to figure out the EXACT plaintext by trying different approaches
  
  // Approach: Use the window.__$ key as a XOR key or transformation key
  if (pageKey) {
    console.log('\n=== Testing window.__$ as transformation key ===');
    const keyBuf = Buffer.from(pageKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - pageKey.length % 4) % 4), 'base64');
    console.log('Key decoded length:', keyBuf.length);
    console.log('Key hex:', keyBuf.toString('hex').substring(0, 60));
    
    // Try XOR with key
    const xored = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      xored[i] = data[i] ^ keyBuf[i % keyBuf.length];
    }
    const xorResult = xored.toString('utf8');
    console.log('XOR with key:', JSON.stringify(xorResult.substring(0, 80)));
    const hasJson = xorResult.includes('{') && xorResult.includes('url');
    console.log('Looks like JSON:', hasJson);
    
    // Try XOR only on cipher positions (skip constant bytes)
    const constantPositions = new Set([1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 18]);
    const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
    const xored2 = [];
    for (let i = 0; i < ptLen; i++) {
      const cp = cipherPos(i);
      if (cp >= data.length) break;
      const byte = data[cp];
      const keyByte = keyBuf[i % keyBuf.length];
      xored2.push(byte ^ keyByte);
    }
    const xorResult2 = Buffer.from(xored2).toString('utf8');
    console.log('XOR on cipher positions:', JSON.stringify(xorResult2.substring(0, 80)));
    
    // Try: our decrypt tables + XOR with key
    // First decrypt with our tables, then XOR
    const rustDec = rustExec(encrypted, 'kai-decrypt');
    const rustBytes = Buffer.from(rustDec, 'utf8');
    const xored3 = Buffer.alloc(rustBytes.length);
    for (let i = 0; i < rustBytes.length; i++) {
      xored3[i] = rustBytes[i] ^ keyBuf[i % keyBuf.length];
    }
    console.log('Rust decrypt + XOR:', JSON.stringify(xored3.toString('utf8').substring(0, 80)));
  }
  
  // Approach: Maybe the tables are derived from window.__$ dynamically
  // Let's check if the key changes between page loads
  console.log('\n=== Checking if key changes between loads ===');
  const wp2 = await fetch('https://animekai.to/watch/' + slug);
  const keyMatch2 = wp2.body.match(/window\.__\$\s*=\s*'([^']+)'/);
  const pageKey2 = keyMatch2 ? keyMatch2[1] : null;
  console.log('Key 1:', pageKey?.substring(0, 40));
  console.log('Key 2:', pageKey2?.substring(0, 40));
  console.log('Same key:', pageKey === pageKey2);
  
  // Try a completely different page
  const wp3 = await fetch('https://animekai.to/watch/jujutsu-kaisen-4gm6');
  const keyMatch3 = wp3.body.match(/window\.__\$\s*=\s*'([^']+)'/);
  const pageKey3 = keyMatch3 ? keyMatch3[1] : null;
  console.log('Key 3 (different anime):', pageKey3?.substring(0, 40));
  console.log('Same as key 1:', pageKey === pageKey3);
}

main().catch(e => console.error('Fatal:', e));
