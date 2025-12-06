/**
 * Analyze PAGE_DATA structure to find embedded key
 * 
 * The PAGE_DATA might contain:
 * 1. A header with key derivation info
 * 2. The encrypted URL
 * 3. A checksum or signature
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Analyzing PAGE_DATA Structure ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// Multiple PAGE_DATA samples
const samples = [
  {
    pageData: '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4',
    embedId: '2MvvbnGoWS2JcOLzFLpK7RXpCQ',
    domain: 'rapidshare.cc'
  },
  {
    pageData: '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4',
    embedId: '2MvvbnGoWS2JcOLzFLpK7RXpCQ',
    domain: 'rapidairmax.site'
  }
];

// Decode both samples
const decoded1 = urlSafeBase64Decode(samples[0].pageData);
const decoded2 = urlSafeBase64Decode(samples[1].pageData);

console.log('Sample 1:');
console.log(`  Hex: ${decoded1.toString('hex')}`);
console.log(`  Length: ${decoded1.length}`);

console.log('\nSample 2:');
console.log(`  Hex: ${decoded2.toString('hex')}`);
console.log(`  Length: ${decoded2.length}`);

// Find differences
console.log('\n=== Differences ===\n');

const diffs = [];
for (let i = 0; i < decoded1.length; i++) {
  if (decoded1[i] !== decoded2[i]) {
    diffs.push({ pos: i, val1: decoded1[i], val2: decoded2[i] });
  }
}

console.log(`${diffs.length} bytes differ`);
console.log('First difference at byte', diffs[0]?.pos);
console.log('Last difference at byte', diffs[diffs.length - 1]?.pos);

// The common prefix might be a header
const commonPrefixLen = diffs[0]?.pos || decoded1.length;
const header = decoded1.slice(0, commonPrefixLen);
console.log(`\nCommon prefix (${commonPrefixLen} bytes): ${header.toString('hex')}`);

// The differing part is the encrypted data
const encData1 = decoded1.slice(commonPrefixLen);
const encData2 = decoded2.slice(commonPrefixLen);

console.log(`\nEncrypted data 1 (${encData1.length} bytes): ${encData1.toString('hex')}`);
console.log(`Encrypted data 2 (${encData2.length} bytes): ${encData2.toString('hex')}`);

// XOR the two encrypted parts to see the key difference
const xorDiff = Buffer.alloc(encData1.length);
for (let i = 0; i < encData1.length; i++) {
  xorDiff[i] = encData1[i] ^ encData2[i];
}
console.log(`\nXOR of encrypted parts: ${xorDiff.toString('hex')}`);

// If both samples decrypt to URLs on the same domain,
// the XOR difference should reveal the plaintext difference

// Assuming both URLs are:
// https://rapidshare.cc/stream/[hash].m3u8
// https://rapidairmax.site/stream/[hash].m3u8

// The domain difference is:
// "rapidshare.cc" vs "rapidairmax.site"
// Starting at position 8 (after "https://")

const domain1 = 'rapidshare.cc';
const domain2 = 'rapidairmax.site';

console.log('\n=== Domain analysis ===\n');
console.log(`Domain 1: ${domain1} (${domain1.length} chars)`);
console.log(`Domain 2: ${domain2} (${domain2.length} chars)`);

// XOR the domains
const domainXor = Buffer.alloc(Math.max(domain1.length, domain2.length));
for (let i = 0; i < domainXor.length; i++) {
  const c1 = i < domain1.length ? domain1.charCodeAt(i) : 0;
  const c2 = i < domain2.length ? domain2.charCodeAt(i) : 0;
  domainXor[i] = c1 ^ c2;
}
console.log(`Domain XOR: ${domainXor.toString('hex')}`);

// Check if this matches part of our encrypted XOR diff
// The domain starts at position 8 in the URL
// So in the encrypted data (after 19-byte header), it would be at position 8-19 = -11
// Wait, the header is 19 bytes, so the URL starts at byte 0 of encrypted data

// Actually, let's reconsider the structure
// The full decoded data is 56 bytes
// If the URL is "https://rapidshare.cc/stream/[22-char-hash].m3u8" = 56 chars
// Then the entire decoded data IS the encrypted URL

console.log('\n=== Full URL analysis ===\n');

// The URL structure:
// "https://" = 8 chars
// domain = variable
// "/stream/" = 8 chars
// hash = variable
// ".m3u8" = 5 chars

// For rapidshare.cc (13 chars): 8 + 13 + 8 + hash + 5 = 34 + hash
// Total 56, so hash = 22 chars

// For rapidairmax.site (16 chars): 8 + 16 + 8 + hash + 5 = 37 + hash
// Total 56, so hash = 19 chars

// But wait, both samples have the same length (56 bytes)
// And the same embed ID
// So the URLs should be the same length

// Let me check if the domains are actually different in the output
// or if both samples decrypt to the same URL

// If both decrypt to the same URL, then the key must be different
// And the key is derived from the domain

console.log('Both samples have same embed ID:', samples[0].embedId === samples[1].embedId);
console.log('Both samples have same length:', decoded1.length === decoded2.length);

// The key might be: MD5(domain) or similar
const md5Domain1 = crypto.createHash('md5').update(domain1).digest();
const md5Domain2 = crypto.createHash('md5').update(domain2).digest();

console.log(`\nMD5(${domain1}): ${md5Domain1.toString('hex')}`);
console.log(`MD5(${domain2}): ${md5Domain2.toString('hex')}`);

// Try decrypting with domain-based keys
console.log('\n=== Trying domain-based decryption ===\n');

// If key = MD5(domain), then:
// plaintext = ciphertext XOR key

let result1 = Buffer.alloc(decoded1.length);
for (let i = 0; i < decoded1.length; i++) {
  result1[i] = decoded1[i] ^ md5Domain1[i % md5Domain1.length];
}
console.log(`Sample 1 XOR MD5(domain1): ${result1.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

let result2 = Buffer.alloc(decoded2.length);
for (let i = 0; i < decoded2.length; i++) {
  result2[i] = decoded2[i] ^ md5Domain2[i % md5Domain2.length];
}
console.log(`Sample 2 XOR MD5(domain2): ${result2.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

// Try with embed ID + domain
const embedId = samples[0].embedId;
const key1 = crypto.createHash('md5').update(embedId + domain1).digest();
const key2 = crypto.createHash('md5').update(embedId + domain2).digest();

result1 = Buffer.alloc(decoded1.length);
for (let i = 0; i < decoded1.length; i++) {
  result1[i] = decoded1[i] ^ key1[i % key1.length];
}
console.log(`\nSample 1 XOR MD5(embedId+domain1): ${result1.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

result2 = Buffer.alloc(decoded2.length);
for (let i = 0; i < decoded2.length; i++) {
  result2[i] = decoded2[i] ^ key2[i % key2.length];
}
console.log(`Sample 2 XOR MD5(embedId+domain2): ${result2.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

// The key might involve the app.js path hash
const appHash1 = '2457433dff948487f3bb6d58f9db2a11';
const appHash2 = '2457433dff868594ecbf3b15e9f22a46efd70a';

const key3 = crypto.createHash('md5').update(appHash1).digest();
const key4 = crypto.createHash('md5').update(appHash2).digest();

result1 = Buffer.alloc(decoded1.length);
for (let i = 0; i < decoded1.length; i++) {
  result1[i] = decoded1[i] ^ key3[i % key3.length];
}
console.log(`\nSample 1 XOR MD5(appHash1): ${result1.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

result2 = Buffer.alloc(decoded2.length);
for (let i = 0; i < decoded2.length; i++) {
  result2[i] = decoded2[i] ^ key4[i % key4.length];
}
console.log(`Sample 2 XOR MD5(appHash2): ${result2.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

console.log('\n=== Done ===');
