#!/usr/bin/env node
/**
 * Deep analysis of the p_mLjDq permutation function and how it's used for decryption.
 * 
 * The function generates a 129x129 permutation matrix.
 * We need to understand how the client uses this to decrypt server responses.
 * 
 * Key facts:
 * - Positions 0-15: one-to-one substitution (known plaintext: '{"url":"https://')
 * - Positions 16+: many-to-one mapping (server discards info)
 * - The permutation is called with (129, 39, [129])
 * - The encrypted response is base64url encoded
 * - 21-byte header + data bytes with position mapping
 */

const { execFileSync } = require('child_process');
const path = require('path');

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

// Implement p_mLjDq exactly as in the obfuscated code
function p_mLjDq(h, r, e) {
  var K = [];
  var b, k, n;
  
  // Initialize: create h empty arrays
  b = 0;
  while (b < h) {
    K[b] = [];
    b++;
  }
  
  // Fill the permutation
  k = 0;
  while (k < h) {
    n = h - 1;
    while (n >= 0) {
      var c = 0, t = 0, i;
      // First iteration
      i = t;
      t = e[c];
      
      // Loop
      while (true) {
        var v = t - i;
        c++;
        if (n < t) break;
        
        var s = i + ((n - i + r * k) % v);
        K[k][s] = K[n]; // This is wrong - K[n] is an array, not a value
        n--;
      }
    }
    k++;
  }
  return K;
}

// Wait, let me re-read the deobfuscated code more carefully
// The switch-case state machine:
// case 2: K=[], var b,k,n
// case 14: b=0
// case 13: if b<h -> case 12, else -> case 10
// case 12: K[b]=[], b++
// case 10: k=0
// case 20: if k<h -> case 19, else -> case 33 (return K)
// case 19: n=h-1
// case 18: if n>=0 -> case 17, else -> case 34 (k++)
// case 17: c=0, t=0
// case 15: i=t
// case 27: i=t, t=e[c], v=t-i, c++
// case 25: v=t-i, c++
// case 23: if n>=t -> case 27, else -> case 22
// case 22: s = i + (n-i+r*k) % v, K[k][s] = K[n] ... wait

// Let me re-trace more carefully from the crypto region
// case 15: i=t (initially t=0, so i=0)
// Then jumps to case 27
// case 27: i=t; t=e[c]; (so i=0, t=e[0]=129)
// case 25: v=t-i; c++; (v=129-0=129, c=1)
// case 23: n>=t? Since n starts at 128 and t=129, 128>=129 is FALSE
// So goes to case 22
// case 22: s = i + (n-i+r*k) % v = 0 + (n-0+39*k) % 129 = (n+39*k) % 129
//          K[k][s] = K[n]... but K[n] is an array!

// Wait, I think K[k][s] is being SET, and K[n] might be... 
// Actually looking again: K[k][s] = K[n] doesn't make sense if K[n] is an array
// Unless this is building a permutation where row k maps position n to position s

// Actually wait - let me re-read case 22:
// case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; (then goes to case 35)
// case 35: n-=1; (then goes to case 18 to check n>=0)

// But K[n] at this point... K was initialized as K[b]=[] for each b
// So K[n] IS an empty array initially
// But as we fill in, K[k][s] = K[n] means... hmm

// Actually I think I'm misreading. Let me look at the ACTUAL deobfuscated code again
// The key line is: K[k][s]=K[n]
// But wait - maybe it's not K[n] (the array), but rather just n?
// Let me check if there's a typo in my extraction...

// Actually, looking at the original more carefully:
// case 22: s=i+(n-i+r*k)%v; K[k][s]=n; 
// No wait, the code says K[k][s]=K[n] but K[n] is an array...
// Unless the intent is K[k][s] = n (the index)

// Let me just try both interpretations and see which produces useful results

console.log('=== Testing p_mLjDq permutation ===\n');

// Interpretation 1: K[k][s] = n (position mapping)
function permutation1(h, r, e) {
  const K = [];
  for (let b = 0; b < h; b++) K[b] = new Array(h).fill(-1);
  
  for (let k = 0; k < h; k++) {
    for (let n = h - 1; n >= 0; n--) {
      let c = 0, t = 0, i, v;
      i = t;
      t = e[c];
      v = t - i;
      c++;
      // n < t is always true since n < 129 = t (well, n goes from 128 to 0, t=129)
      // Actually n=128 < 129=t, so we go to case 22
      let s = (i + ((n - i + r * k) % v + v) % v);  // ensure positive modulo
      K[k][s] = n;
      // n-- happens in the loop
    }
  }
  return K;
}

// Generate the permutation table
const perm = permutation1(129, 39, [129]);

// Print first few rows
console.log('Row 0 (first 20):', perm[0].slice(0, 20));
console.log('Row 1 (first 20):', perm[1].slice(0, 20));
console.log('Row 2 (first 20):', perm[2].slice(0, 20));

// Check: is row 0 the identity?
const isIdentity = perm[0].every((v, i) => v === i);
console.log('\nRow 0 is identity:', isIdentity);

// For encryption: at position k, plaintext byte n maps to cipher position s = (n + 39*k) % 129
// So: cipher[s] = plaintext[n] at position k
// For decryption: plaintext[n] = cipher[s] where n = perm[k][s]
// Or equivalently: n = (s - 39*k) % 129

// Let's verify with known data
// Position 0: plaintext '{' (123) -> cipher 0xd4 (212)
// s = (123 + 39*0) % 129 = 123 % 129 = 123
// So cipher byte at position 0 should be at index 123 in the permutation
// But the actual cipher byte is 212 (0xd4)
// This doesn't match - the permutation maps positions, not byte values

// Maybe the permutation is used differently:
// The permutation maps byte VALUES, not positions
// At position k, to encrypt byte value n:
//   cipher_value = perm[k][n]  (or perm[n][k], or some other indexing)

// Let's check: at position 0, plaintext '{' = 123, cipher = 212
// perm[0][123] = ?
console.log('\nperm[0][123] =', perm[0][123], '(expected 212 for encryption)');
console.log('perm[123][0] =', perm[123][0], '(alt indexing)');

// Check position 1: plaintext '"' = 34, cipher = 107
console.log('perm[1][34] =', perm[1][34], '(expected 107)');
console.log('perm[34][1] =', perm[34][1]);

// Hmm, let me think about this differently
// Maybe the permutation generates a LOOKUP table
// where perm[k] is a permutation of 0..128
// and encryption at position k is: cipher = perm[k][plaintext]
// and decryption is: plaintext = inversePerm[k][cipher]

// Let's check if perm[0] maps 123 -> 212
console.log('\n=== Checking if permutation maps plaintext to cipher ===');
const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

// Get a fresh encrypted response to verify
const searchHtml = rf('https://animekai.to/ajax/anime/search?keyword=bleach', {
  ...KAI_HDRS, 'Referer': 'https://animekai.to/'
});
const sd = JSON.parse(searchHtml);
const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];

const pageHtml = rf(`https://animekai.to/watch/${slug}`);
const syncMatch = pageHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
const sync = JSON.parse(syncMatch[1]);
const animeId = sync.anime_id;

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

// Get ALL server links
const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
console.log('Available lids:', lids.length);

// Get the first link's encrypted response
const lid = lids[0];
const encLid = kaiEncrypt(lid);
const viewHtml = rf(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, {
  ...KAI_HDRS, 'Referer': 'https://animekai.to/'
});
const viewData = JSON.parse(viewHtml);
const encrypted = viewData.result;

const buf = b64decode(encrypted);
const data = buf.subarray(21);
const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;

console.log('\nEncrypted base64:', encrypted.substring(0, 80));
console.log('Data length:', data.length, 'Estimated plaintext length:', ptLen);

// Extract cipher bytes at each position
const cipherBytes = [];
for (let i = 0; i < ptLen; i++) {
  const cp = cipherPos(i);
  if (cp < data.length) {
    cipherBytes.push(data[cp]);
  }
}

const knownPrefix = '{"url":"https://';
console.log('\n=== Position-by-position analysis ===');
for (let i = 0; i < knownPrefix.length; i++) {
  const pt = knownPrefix.charCodeAt(i);
  const ct = cipherBytes[i];
  // Check various permutation lookups
  const p_k_pt = perm[i] ? perm[i][pt] : '?';
  const p_pt_k = perm[pt] ? perm[pt][i] : '?';
  const p_k_ct = perm[i] ? perm[i][ct] : '?';
  
  // Also check: where does perm[i] map pt to?
  // And: what value in perm[i] equals ct?
  let invIdx = -1;
  if (perm[i]) {
    invIdx = perm[i].indexOf(ct);
  }
  
  console.log(`  pos ${i}: pt=${pt}(${knownPrefix[i]}) ct=${ct}(0x${ct.toString(16)}) | perm[${i}][${pt}]=${p_k_pt} | perm[${pt}][${i}]=${p_pt_k} | perm[${i}].indexOf(${ct})=${invIdx}`);
}

// Maybe the permutation is used with modular arithmetic on byte values
// Let's try: cipher = (plaintext + perm_offset[position]) % 256
// Or: cipher = perm[position % 129][plaintext % 129] + something

// Actually, let me reconsider. The permutation is 129x129.
// 129 is interesting because it's close to 128 (number of ASCII chars)
// Maybe the encryption works on values 0-128 (7-bit ASCII)

// Let's check if all cipher bytes and plaintext bytes are < 129
console.log('\n=== Checking value ranges ===');
console.log('Max cipher byte in first 16:', Math.max(...cipherBytes.slice(0, 16)));
console.log('Min cipher byte in first 16:', Math.min(...cipherBytes.slice(0, 16)));
console.log('All plaintext < 129:', knownPrefix.split('').every(c => c.charCodeAt(0) < 129));

// The cipher bytes go up to 247, well above 129
// So the permutation alone can't produce these values
// Unless there's a second step (like adding a constant or XOR)

// Let me check: maybe the encryption is:
// 1. Apply permutation: intermediate = perm[pos % 129][plaintext]
// 2. Then XOR or add something

// Or maybe the permutation is used to generate a KEY, not directly encrypt
// The key at position k could be: perm[k][some_seed] or similar

// Let me try another approach: look at the DIFFERENCE between cipher and plaintext
// at each position, and see if it matches any permutation value
console.log('\n=== Checking cipher-plaintext relationships ===');
for (let i = 0; i < knownPrefix.length; i++) {
  const pt = knownPrefix.charCodeAt(i);
  const ct = cipherBytes[i];
  const diff = (ct - pt + 256) % 256;
  const xor = ct ^ pt;
  const sum = (ct + pt) % 256;
  
  // Check if diff or xor appears in perm[i]
  const diffInPerm = perm[i % 129] ? perm[i % 129].indexOf(diff) : -1;
  const xorInPerm = perm[i % 129] ? perm[i % 129].indexOf(xor) : -1;
  
  console.log(`  pos ${i}: diff=${diff} xor=${xor} | diff@perm[${i}]=${diffInPerm} xor@perm[${i}]=${xorInPerm}`);
}

// Let me also check: maybe the permutation table is used as perm[pos][0], perm[pos][1], etc.
// to generate a keystream, and then XOR is applied
console.log('\n=== Permutation row values as potential keystream ===');
for (let i = 0; i < 16; i++) {
  const pt = knownPrefix.charCodeAt(i);
  const ct = cipherBytes[i];
  const xor = ct ^ pt;
  // Check perm[i][0], perm[i][1], etc.
  console.log(`  pos ${i}: xor_needed=${xor} | perm[${i}][0]=${perm[i][0]} perm[${i}][1]=${perm[i][1]} perm[${i}][${i}]=${perm[i][i]}`);
}
