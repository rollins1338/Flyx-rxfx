/**
 * Reverse engineer from expected output format
 * 
 * The decrypted PAGE_DATA should contain:
 * - An m3u8 URL like: https://domain.com/path/to/video.m3u8
 * - Or a JSON object with video info
 * 
 * Let's analyze what the output format should be and work backwards
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Reverse Engineering from Output ===\n');

// PAGE_DATA samples
const samples = [
  {
    pageData: '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4',
    embedId: '2MvvbnGoWS2JcOLzFLpK7RXpCQ',
    domain: 'rapidshare.cc',
    title: 'Five.Nights.at.Freddy-s.2.2025.720p.TS.ES.EN-RGB.mp4'
  }
];

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const sample = samples[0];
const decoded = urlSafeBase64Decode(sample.pageData);

console.log('Decoded PAGE_DATA:');
console.log(`  Length: ${decoded.length} bytes`);
console.log(`  Hex: ${decoded.toString('hex')}`);
console.log('');

// The output is likely a URL
// URLs start with "http" which is: 0x68 0x74 0x74 0x70

// If the first byte of output is 'h' (0x68), then:
// decoded[0] XOR key[0] = 0x68
// key[0] = decoded[0] XOR 0x68 = 0xdf XOR 0x68 = 0xb7

// Let's assume the output starts with "https://"
const expectedStart = 'https://';
const expectedBytes = Buffer.from(expectedStart);

console.log('If output starts with "https://":');
const derivedKey = Buffer.alloc(expectedBytes.length);
for (let i = 0; i < expectedBytes.length; i++) {
  derivedKey[i] = decoded[i] ^ expectedBytes[i];
}
console.log(`  Derived key bytes: ${derivedKey.toString('hex')}`);
console.log(`  Derived key ASCII: ${derivedKey.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`);

// Check if this key pattern repeats
console.log('\nChecking if key pattern repeats...');
for (let keyLen = 1; keyLen <= 32; keyLen++) {
  const key = derivedKey.slice(0, keyLen);
  let matches = true;
  
  // Check if using this key length produces valid output
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i % key.length];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://') || str.startsWith('http://')) {
    console.log(`Key length ${keyLen} produces URL: ${str.substring(0, 60)}`);
  }
}

// The PAGE_DATA might not start with the URL directly
// It might have a header or be structured differently

// Let's try different offsets
console.log('\n=== Trying different offsets ===\n');

for (let offset = 0; offset <= 20; offset++) {
  const data = decoded.slice(offset);
  
  // Try to find "http" anywhere in the decrypted data
  for (let keyLen = 1; keyLen <= 32; keyLen++) {
    // Derive key assuming output starts with "http"
    if (data.length < 4) continue;
    
    const key = Buffer.alloc(keyLen);
    for (let i = 0; i < Math.min(keyLen, 4); i++) {
      key[i] = data[i] ^ expectedBytes[i];
    }
    // Repeat the pattern
    for (let i = 4; i < keyLen; i++) {
      key[i] = key[i % 4];
    }
    
    // Decrypt
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length];
    }
    
    const str = result.toString('utf8');
    if (str.includes('http') && str.includes('://')) {
      console.log(`Offset ${offset}, key length ${keyLen}:`);
      console.log(`  Key: ${key.toString('hex')}`);
      console.log(`  Result: ${str.substring(0, 80)}`);
    }
  }
}

// The embed ID might be the key or part of it
console.log('\n=== Analyzing embed ID ===\n');

const embedId = sample.embedId;
console.log(`Embed ID: ${embedId}`);
console.log(`Length: ${embedId.length}`);

// The embed ID looks like base64
try {
  const decodedId = urlSafeBase64Decode(embedId);
  console.log(`Decoded embed ID: ${decodedId.toString('hex')}`);
  console.log(`Decoded length: ${decodedId.length} bytes`);
  
  // Try using decoded embed ID as key
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ decodedId[i % decodedId.length];
  }
  console.log(`XOR with decoded embedId: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
} catch (e) {
  console.log(`Embed ID decode error: ${e.message}`);
}

// The PAGE_DATA might be structured as:
// [type byte][length][encrypted data]
// or
// [IV][encrypted data]

console.log('\n=== Analyzing structure ===\n');

// First byte might be a type indicator
console.log(`First byte: 0x${decoded[0].toString(16)} = ${decoded[0]}`);

// Bytes 1-4 might be length or timestamp
const len1 = decoded.readUInt32BE(1);
const len2 = decoded.readUInt32LE(1);
console.log(`Bytes 1-4 as BE uint32: ${len1}`);
console.log(`Bytes 1-4 as LE uint32: ${len2}`);

// The structure might be:
// [19 bytes header][37 bytes data]
// Header might contain IV or key derivation info

const header = decoded.slice(0, 19);
const data = decoded.slice(19);

console.log(`\nHeader (19 bytes): ${header.toString('hex')}`);
console.log(`Data (37 bytes): ${data.toString('hex')}`);

// Try AES decryption with header as IV
console.log('\n=== Trying AES with header as IV ===\n');

const aesKeys = [
  crypto.createHash('md5').update(embedId).digest(),
  crypto.createHash('md5').update(sample.domain).digest(),
  crypto.createHash('md5').update('rapidshare').digest(),
  Buffer.from(embedId.slice(0, 16)),
];

// Pad data to 48 bytes for AES
const paddedData = Buffer.concat([data, Buffer.alloc(48 - data.length, 0)]);

aesKeys.forEach((key, idx) => {
  try {
    // Use first 16 bytes of header as IV
    const iv = header.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(paddedData), decipher.final()]);
    const str = decrypted.toString('utf8');
    if (str.includes('http') || /^[\x20-\x7e]+$/.test(str.substring(0, 20))) {
      console.log(`AES key ${idx}: ${str.substring(0, 60)}`);
    }
  } catch (e) {
    // Ignore decryption errors
  }
});

// The encryption might be simpler - just XOR with a derived key
// Let's try to find the key by analyzing multiple samples

console.log('\n=== Comparing samples ===\n');

// If we had multiple PAGE_DATA samples for the same video,
// we could XOR them to find the key pattern

// For now, let's try common key derivation patterns
const keyDerivations = [
  { name: 'embedId chars', key: Buffer.from(embedId) },
  { name: 'embedId upper', key: Buffer.from(embedId.toUpperCase()) },
  { name: 'embedId reversed', key: Buffer.from(embedId.split('').reverse().join('')) },
  { name: 'domain', key: Buffer.from(sample.domain) },
  { name: 'title', key: Buffer.from(sample.title.slice(0, 32)) },
];

keyDerivations.forEach(({ name, key }) => {
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i % key.length];
  }
  const str = result.toString('utf8');
  console.log(`${name}: ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
});

console.log('\n=== Done ===');
