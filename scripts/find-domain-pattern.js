/**
 * Find the domain pattern in stage2Key
 * 
 * We know:
 * - stage2Key[0:8] = header[0:8] XOR "https://" XOR hash[0:8] (computable)
 * - stage2Key[8:19] depends on the domain
 * 
 * Let's see if we can find a pattern for stage2Key[8:19]
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

console.log('=== Finding Domain Pattern ===\n');

// Sample 1: rapidshare.cc
// URL: https://rapidshare.cc/stream/[hash].m3u8
// Domain part (positions 8-18): "rapidshare."
const domain1 = 'rapidshare.';
const hash1 = '2457433dff948487f3bb6d58f9db2a11';
const hashHex1 = Buffer.from(hash1, 'hex');

// Sample 2: rapidairmax.site (FNAF2)
// URL: https://rrr.core36link.site/p267/c5/h[hash]/...
// Domain part (positions 8-18): "rrr.core36l"
const domain2 = 'rrr.core36l';
const hash2 = '2457433dff868594ecbf3b15e9f22a46efd70a';
const hashHex2 = Buffer.from(hash2, 'hex');

console.log('Sample 1:');
console.log('  Domain part:', domain1, `(${domain1.length} chars)`);
console.log('  Hash:', hash1);

console.log('\nSample 2:');
console.log('  Domain part:', domain2, `(${domain2.length} chars)`);
console.log('  Hash:', hash2);

// Compute stage2Key[8:19] for each sample
// stage2Key[i] = header[i] XOR URL[i] XOR hash[i]

console.log('\n=== Computing stage2Key[8:19] ===\n');

// Sample 1 (only 16 bytes of hash available)
const stage2Key1_8to16 = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  stage2Key1_8to16[i] = HEADER[8 + i] ^ domain1.charCodeAt(i) ^ hashHex1[8 + i];
}
console.log('Sample 1 stage2Key[8:16]:', stage2Key1_8to16.toString('hex'));

// Sample 2
const stage2Key2_8to19 = Buffer.alloc(11);
for (let i = 0; i < 11; i++) {
  stage2Key2_8to19[i] = HEADER[8 + i] ^ domain2.charCodeAt(i) ^ hashHex2[8 + i];
}
console.log('Sample 2 stage2Key[8:19]:', stage2Key2_8to19.toString('hex'));

// Compare the first 8 bytes
console.log('\nComparing stage2Key[8:16]:');
console.log('  Sample 1:', stage2Key1_8to16.toString('hex'));
console.log('  Sample 2:', stage2Key2_8to19.subarray(0, 8).toString('hex'));
console.log('  Match:', stage2Key1_8to16.toString('hex') === stage2Key2_8to19.subarray(0, 8).toString('hex'));

// They don't match because the domains are different!

// Let's see what stage2Key[8:19] XOR domain gives us
console.log('\n=== Analyzing stage2Key[8:19] ===\n');

// stage2Key[i] = header[i] XOR URL[i] XOR hash[i]
// stage2Key[i] XOR domain[i-8] = header[i] XOR hash[i]

const headerXorHash2 = Buffer.alloc(11);
for (let i = 0; i < 11; i++) {
  headerXorHash2[i] = HEADER[8 + i] ^ hashHex2[8 + i];
}
console.log('header[8:19] XOR hash[8:19]:', headerXorHash2.toString('hex'));

// Verify: stage2Key[8:19] XOR domain = header XOR hash
const stage2KeyXorDomain = Buffer.alloc(11);
for (let i = 0; i < 11; i++) {
  stage2KeyXorDomain[i] = stage2Key2_8to19[i] ^ domain2.charCodeAt(i);
}
console.log('stage2Key[8:19] XOR domain:', stage2KeyXorDomain.toString('hex'));
console.log('Match:', headerXorHash2.toString('hex') === stage2KeyXorDomain.toString('hex'));

// So: stage2Key[8:19] = (header[8:19] XOR hash[8:19]) XOR domain
// And: domain = stage2Key[8:19] XOR header[8:19] XOR hash[8:19]

// If we knew stage2Key[8:19], we could compute the domain!
// But stage2Key[8:19] depends on the domain... circular!

// HOWEVER: the domain might be predictable based on the embed domain!
// Let's check if there's a mapping

console.log('\n=== Domain Mapping ===\n');

// Embed domain -> HLS domain mapping:
// rapidshare.cc -> rapidshare.cc (same)
// rapidairmax.site -> rrr.core36link.site (different!)

console.log('Known mappings:');
console.log('  rapidshare.cc -> rapidshare.cc');
console.log('  rapidairmax.site -> rrr.core36link.site');

// The mapping might be:
// 1. Hardcoded in the app.js
// 2. Derived from the hash
// 3. Fetched from an API

// Let's check if the hash encodes the domain
console.log('\n=== Checking if hash encodes domain ===\n');

// The hashes are:
// rapidshare.cc: 2457433dff948487f3bb6d58f9db2a11 (16 bytes)
// rapidairmax.site: 2457433dff868594ecbf3b15e9f22a46efd70a (19 bytes)

// Common prefix: 2457433dff (5 bytes)
// This might be a version number

// The different parts:
// rapidshare.cc: 948487f3bb6d58f9db2a11
// rapidairmax.site: 868594ecbf3b15e9f22a46efd70a

console.log('Hash suffix (rapidshare.cc):', hash1.substring(10));
console.log('Hash suffix (rapidairmax.site):', hash2.substring(10));

// Let's see if the hash suffix encodes the domain
// XOR with domain bytes

const hashSuffix1 = Buffer.from(hash1.substring(10), 'hex');
const hashSuffix2 = Buffer.from(hash2.substring(10), 'hex');

console.log('\nHash suffix 1 (hex):', hashSuffix1.toString('hex'));
console.log('Hash suffix 2 (hex):', hashSuffix2.toString('hex'));

// XOR hash suffix with domain
const suffix2XorDomain = Buffer.alloc(11);
for (let i = 0; i < 11; i++) {
  suffix2XorDomain[i] = hashSuffix2[i] ^ domain2.charCodeAt(i);
}
console.log('Hash suffix 2 XOR domain:', suffix2XorDomain.toString('hex'));
console.log('As string:', suffix2XorDomain.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// The hash suffix doesn't directly encode the domain.

// Let's try a different approach: brute-force common domains
console.log('\n=== Brute-forcing common domains ===\n');

const commonDomains = [
  'rapidshare.',
  'rrr.core36l',
  'core36link.',
  'rapidairmax',
  'streamtape.',
  'vidcloud.co',
  'mixdrop.co/',
  'doodstream.',
];

console.log('Testing common domains for sample 2:');
commonDomains.forEach(domain => {
  // Compute what stage2Key[8:19] would be for this domain
  const testStage2Key = Buffer.alloc(11);
  for (let i = 0; i < 11; i++) {
    testStage2Key[i] = HEADER[8 + i] ^ domain.charCodeAt(i) ^ hashHex2[8 + i];
  }
  
  // Check if this matches the actual stage2Key
  const match = testStage2Key.toString('hex') === stage2Key2_8to19.toString('hex');
  console.log(`  ${domain}: ${match ? '✓ MATCH!' : '✗'}`);
});

console.log('\n=== Conclusion ===\n');
console.log('The domain is NOT directly encoded in the hash.');
console.log('The domain mapping must be:');
console.log('1. Hardcoded in the app.js (most likely)');
console.log('2. Or fetched from an API');
console.log('');
console.log('To fully decrypt, we need to:');
console.log('1. Reverse engineer the app.js to find the domain mapping');
console.log('2. Or try common domains until one works');
console.log('3. Or intercept the actual HLS request to get the domain');

console.log('\n=== Done ===');
