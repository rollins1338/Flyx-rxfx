#!/usr/bin/env node
/**
 * CRITICAL FINDING: The server's encryption is NOT a reversible substitution.
 * Multiple different chars map to the SAME cipher byte at each position.
 * This means the client uses a DIFFERENT decryption method.
 * 
 * Hypothesis: The server XORs the plaintext with a key, then applies the
 * substitution. The client reverses the substitution, then XORs with the key.
 * OR: The server uses a completely different cipher (XOR-based).
 * 
 * The page has window.__$ which is a base64 string. Let's test if it's the XOR key.
 */
const { execFileSync } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', 'fetch', '--timeout', '15',
    '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, {
      encoding: 'utf8', timeout: 25000,
      maxBuffer: 10*1024*1024, windowsHide: true
    }).trim();
  } catch(e) { return e.stdout?.trim() || ''; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

function b64decode(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - std.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

function cipherPos(i) {
  if (i === 0) return 0;
  if (i === 1) return 7;
  if (i === 2) return 11;
  if (i === 3) return 13;
  if (i === 4) return 15;
  if (i === 5) return 17;
  if (i === 6) return 19;
  return 20 + (i - 7);
}

const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

async function main() {
  console.log('=== Fetching AnimeKai page to get window.__$ key ===\n');
  
  // Get a watch page
  const searchHtml = rf('https://animekai.to/ajax/anime/search?keyword=bleach', {
    ...KAI_HDRS, 'Referer': 'https://animekai.to/'
  });
  const sd = JSON.parse(searchHtml);
  const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
  console.log('Slug:', slug);
  
  // Get the watch page
  const pageHtml = rf(`https://animekai.to/watch/${slug}`);
  
  // Extract window.__$
  const keyMatch = pageHtml.match(/window\.__\$\s*=\s*'([^']+)'/);
  const pageKey = keyMatch ? keyMatch[1] : null;
  console.log('window.__$:', pageKey ? `${pageKey.substring(0, 60)}... (${pageKey.length} chars)` : 'NOT FOUND');
  
  if (!pageKey) {
    // Try other patterns
    const altMatch = pageHtml.match(/window\.__\$\s*=\s*"([^"]+)"/);
    console.log('Alt pattern:', altMatch ? altMatch[1].substring(0, 60) : 'NOT FOUND');
    
    // Search for any large base64-like strings in script tags
    const scripts = pageHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    console.log(`Found ${scripts.length} script tags`);
    
    for (const script of scripts) {
      const b64s = script.match(/['"]([A-Za-z0-9+/=_-]{50,})['"]/g);
      if (b64s) {
        for (const b of b64s) {
          const val = b.slice(1, -1);
          console.log(`  Base64-like: ${val.substring(0, 60)}... (${val.length} chars)`);
        }
      }
    }
    
    // Also check for data attributes
    const dataAttrs = pageHtml.match(/data-[a-z-]+="([A-Za-z0-9+/=_-]{30,})"/g);
    if (dataAttrs) {
      for (const d of dataAttrs) {
        console.log(`  Data attr: ${d.substring(0, 80)}`);
      }
    }
  }
  
  // Get syncData
  const syncMatch = pageHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  const sync = syncMatch ? JSON.parse(syncMatch[1]) : null;
  console.log('syncData:', sync ? JSON.stringify(sync).substring(0, 100) : 'NOT FOUND');
  
  if (!sync) {
    console.log('\nFailed to get syncData. Page might be blocked.');
    console.log('Page length:', pageHtml.length);
    console.log('First 500 chars:', pageHtml.substring(0, 500));
    return;
  }
  
  const animeId = sync.anime_id;
  
  // Get an encrypted response
  const encId = kaiEncrypt(animeId);
  const epHtml = rf(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, {
    ...KAI_HDRS, 'Referer': 'https://animekai.to/'
  });
  const epData = JSON.parse(epHtml);
  const token = epData.result.match(/token="([^"]+)"/)[1];
  
  const encToken = kaiEncrypt(token);
  const srvHtml = rf(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, {
    ...KAI_HDRS, 'Referer': 'https://animekai.to/'
  });
  const srvData = JSON.parse(srvHtml);
  const lid = srvData.result.match(/data-lid="([^"]+)"/)[1];
  
  const encLid = kaiEncrypt(lid);
  const viewHtml = rf(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, {
    ...KAI_HDRS, 'Referer': 'https://animekai.to/'
  });
  const viewData = JSON.parse(viewHtml);
  const encrypted = viewData.result;
  
  console.log('\nEncrypted response:', encrypted.substring(0, 60) + '...');
  
  const buf = b64decode(encrypted);
  const header = buf.slice(0, 21);
  const data = buf.slice(21);
  const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
  
  console.log('Data length:', data.length, 'Estimated plaintext:', ptLen);
  
  // Extract cipher bytes at each position
  const cipherBytes = [];
  for (let i = 0; i < ptLen; i++) {
    const cp = cipherPos(i);
    if (cp < data.length) {
      cipherBytes.push(data[cp]);
    }
  }
  
  // The plaintext starts with: {"url":"https://
  const knownPrefix = '{"url":"https://';
  
  // Try XOR: if cipher = plaintext XOR key, then key = cipher XOR plaintext
  console.log('\n=== Deriving XOR key from known prefix ===');
  const derivedKey = [];
  for (let i = 0; i < knownPrefix.length; i++) {
    const xorByte = cipherBytes[i] ^ knownPrefix.charCodeAt(i);
    derivedKey.push(xorByte);
    console.log(`  pos ${i}: cipher=0x${cipherBytes[i].toString(16).padStart(2,'0')} XOR '${knownPrefix[i]}'(0x${knownPrefix.charCodeAt(i).toString(16).padStart(2,'0')}) = key=0x${xorByte.toString(16).padStart(2,'0')} ('${xorByte >= 32 && xorByte < 127 ? String.fromCharCode(xorByte) : '?'}')`);
  }
  
  console.log('\nDerived key bytes:', derivedKey.map(b => b.toString(16).padStart(2,'0')).join(' '));
  console.log('Derived key as string:', Buffer.from(derivedKey).toString('utf8'));
  
  // Now apply this key to the rest of the cipher to see if we get readable text
  console.log('\n=== Applying derived XOR key to full cipher ===');
  
  // If the key repeats, try different key lengths
  for (const keyLen of [16, 8, 4, 32, 64]) {
    const key = derivedKey.slice(0, keyLen);
    const decrypted = [];
    for (let i = 0; i < cipherBytes.length; i++) {
      decrypted.push(cipherBytes[i] ^ key[i % key.length]);
    }
    const result = Buffer.from(decrypted).toString('utf8');
    const readable = result.replace(/[^\x20-\x7e]/g, '?');
    const readableCount = result.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127).length;
    const pct = Math.round(readableCount / result.length * 100);
    console.log(`\nKey length ${keyLen}: ${pct}% readable`);
    console.log(`  First 100: ${readable.substring(0, 100)}`);
    if (pct > 80) {
      console.log(`  FULL: ${readable}`);
    }
  }
  
  // Also try: maybe the key is the page key (window.__$)
  if (pageKey) {
    const keyBuf = b64decode(pageKey);
    console.log('\n=== Trying window.__$ as XOR key ===');
    console.log('Key length:', keyBuf.length);
    
    const decrypted = [];
    for (let i = 0; i < cipherBytes.length; i++) {
      decrypted.push(cipherBytes[i] ^ keyBuf[i % keyBuf.length]);
    }
    const result = Buffer.from(decrypted).toString('utf8');
    const readable = result.replace(/[^\x20-\x7e]/g, '?');
    const readableCount = result.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127).length;
    const pct = Math.round(readableCount / result.length * 100);
    console.log(`Readability: ${pct}%`);
    console.log(`First 100: ${readable.substring(0, 100)}`);
    if (pct > 80) {
      console.log(`FULL: ${readable}`);
    }
  }
  
  // Try: maybe it's NOT XOR. Maybe the cipher bytes ARE the plaintext bytes
  // but shifted/rotated. Let's check if there's a constant offset.
  console.log('\n=== Checking constant offset ===');
  for (let i = 0; i < knownPrefix.length; i++) {
    const diff = (cipherBytes[i] - knownPrefix.charCodeAt(i) + 256) % 256;
    console.log(`  pos ${i}: diff = ${diff} (0x${diff.toString(16).padStart(2,'0')})`);
  }
  
  // Try: maybe the cipher uses the p_mLjDq permutation
  // p_mLjDq(129, 39, [129]) generates a permutation where:
  // For row k, position s = (n + 39*k) % 129
  // This means: to encrypt char n at position k, the cipher byte is at position s
  // Or: cipher[s] = plain[n] where s = (n + 39*k) % 129
  // To decrypt: plain[n] = cipher[s] where n = (s - 39*k + 129*many) % 129
  console.log('\n=== Trying p_mLjDq permutation decrypt ===');
  const decrypted2 = [];
  for (let k = 0; k < cipherBytes.length; k++) {
    const s = cipherBytes[k]; // cipher byte value
    // n = (s - 39*k) % 129, but need positive modulo
    let n = ((s - (39 * k) % 129) % 129 + 129) % 129;
    decrypted2.push(n);
  }
  const result2 = Buffer.from(decrypted2).toString('utf8');
  const readable2 = result2.replace(/[^\x20-\x7e]/g, '?');
  console.log(`First 100: ${readable2.substring(0, 100)}`);
  
  // Try with different parameters
  for (const seed of [39, 129, 1, 7, 13, 17, 23, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) {
    const dec = [];
    for (let k = 0; k < Math.min(16, cipherBytes.length); k++) {
      const s = cipherBytes[k];
      let n = ((s - (seed * k) % 256) % 256 + 256) % 256;
      dec.push(n);
    }
    const r = Buffer.from(dec).toString('utf8');
    if (r.startsWith('{"') || r.startsWith('http')) {
      console.log(`  Seed ${seed}: ${r}`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
