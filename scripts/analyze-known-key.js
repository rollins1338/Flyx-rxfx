/**
 * Deep analysis of the known key bytes
 * 
 * Known key (29 bytes): b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70
 * 
 * Let's find patterns and relationships
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Deep Analysis of Known Key ===\n');

const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

console.log('Known key bytes:');
for (let i = 0; i < knownKey.length; i++) {
  const byte = knownKey[i];
  const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
  console.log(`  ${i.toString().padStart(2)}: 0x${byte.toString(16).padStart(2, '0')} = ${byte.toString().padStart(3)} = '${char}'`);
}

// Look for patterns
console.log('\n=== Pattern analysis ===\n');

// Check for repeating sequences
for (let period = 1; period <= 14; period++) {
  let repeats = true;
  for (let i = period; i < knownKey.length; i++) {
    if (knownKey[i] !== knownKey[i % period]) {
      repeats = false;
      break;
    }
  }
  if (repeats) {
    console.log(`Period ${period}: ${knownKey.slice(0, period).toString('hex')}`);
  }
}

// Check differences between consecutive bytes
console.log('\nConsecutive differences:');
const diffs = [];
for (let i = 1; i < knownKey.length; i++) {
  const diff = (knownKey[i] - knownKey[i-1] + 256) % 256;
  diffs.push(diff);
}
console.log(diffs.map(d => d.toString(16).padStart(2, '0')).join(' '));

// Check XOR with position
console.log('\nXOR with position:');
const xorPos = [];
for (let i = 0; i < knownKey.length; i++) {
  xorPos.push(knownKey[i] ^ i);
}
console.log(xorPos.map(d => d.toString(16).padStart(2, '0')).join(' '));

// Check if key bytes match any known string
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const cleanedPath = 'E2MVVBNGOWS2JCOLZFLPK7RXPCQ';

console.log('\n=== Comparing with known strings ===\n');

// XOR with embedId
console.log('Key XOR embedId:');
const xorEmbed = [];
for (let i = 0; i < knownKey.length; i++) {
  xorEmbed.push(knownKey[i] ^ embedId.charCodeAt(i % embedId.length));
}
console.log(xorEmbed.map(d => d.toString(16).padStart(2, '0')).join(' '));
console.log('As chars:', xorEmbed.map(d => d >= 32 && d <= 126 ? String.fromCharCode(d) : '.').join(''));

// XOR with cleanedPath
console.log('\nKey XOR cleanedPath:');
const xorClean = [];
for (let i = 0; i < knownKey.length; i++) {
  xorClean.push(knownKey[i] ^ cleanedPath.charCodeAt(i % cleanedPath.length));
}
console.log(xorClean.map(d => d.toString(16).padStart(2, '0')).join(' '));
console.log('As chars:', xorClean.map(d => d >= 32 && d <= 126 ? String.fromCharCode(d) : '.').join(''));

// The key might be derived from the decoded embed ID
const decodedEmbedId = Buffer.from(embedId.replace(/-/g, '+').replace(/_/g, '/') + '==', 'base64');
console.log('\nDecoded embed ID:', decodedEmbedId.toString('hex'));

console.log('\nKey XOR decodedEmbedId:');
const xorDecoded = [];
for (let i = 0; i < knownKey.length; i++) {
  xorDecoded.push(knownKey[i] ^ decodedEmbedId[i % decodedEmbedId.length]);
}
console.log(xorDecoded.map(d => d.toString(16).padStart(2, '0')).join(' '));

// Check if the XOR result is a known hash
console.log('\n=== Checking if XOR results match known hashes ===\n');

const hashInputs = [
  'rapidshare',
  'rapidshare.cc',
  'stream',
  '/stream/',
  embedId,
  cleanedPath,
  '/e/' + embedId,
];

hashInputs.forEach(input => {
  const md5 = crypto.createHash('md5').update(input).digest();
  
  // Check if md5 matches xorEmbed
  let matchEmbed = true;
  for (let i = 0; i < Math.min(xorEmbed.length, 16); i++) {
    if (xorEmbed[i] !== md5[i]) {
      matchEmbed = false;
      break;
    }
  }
  
  // Check if md5 matches xorClean
  let matchClean = true;
  for (let i = 0; i < Math.min(xorClean.length, 16); i++) {
    if (xorClean[i] !== md5[i]) {
      matchClean = false;
      break;
    }
  }
  
  if (matchEmbed) console.log(`MD5(${input}) matches key XOR embedId!`);
  if (matchClean) console.log(`MD5(${input}) matches key XOR cleanedPath!`);
});

// The key might be built from multiple components
console.log('\n=== Trying multi-component keys ===\n');

// key = embedId XOR md5(something) XOR constant
const md5Inputs = ['rapidshare', 'stream', embedId, cleanedPath];

md5Inputs.forEach(input => {
  const md5 = crypto.createHash('md5').update(input).digest();
  
  // Calculate: constant = key XOR embedId XOR md5
  const constant = Buffer.alloc(knownKey.length);
  for (let i = 0; i < knownKey.length; i++) {
    constant[i] = knownKey[i] ^ embedId.charCodeAt(i % embedId.length) ^ md5[i % md5.length];
  }
  
  // Check if constant is simple (all same byte or small values)
  const uniqueBytes = new Set(constant);
  if (uniqueBytes.size <= 4) {
    console.log(`key = embedId XOR MD5(${input}) XOR constant`);
    console.log(`  Constant: ${constant.toString('hex')}`);
    console.log(`  Unique bytes: ${[...uniqueBytes].map(b => '0x' + b.toString(16)).join(', ')}`);
  }
});

// Check if key is related to the PAGE_DATA header
console.log('\n=== Checking PAGE_DATA header ===\n');

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = Buffer.from(pageData.replace(/-/g, '+').replace(/_/g, '/') + '=', 'base64');
const header = decoded.slice(0, 19);

console.log('PAGE_DATA header:', header.toString('hex'));

// XOR key with header
console.log('\nKey XOR header:');
const xorHeader = [];
for (let i = 0; i < knownKey.length; i++) {
  xorHeader.push(knownKey[i] ^ header[i % header.length]);
}
console.log(xorHeader.map(d => d.toString(16).padStart(2, '0')).join(' '));

// The header might contain key derivation info
// First byte: 0xdf = 223
// This might be a version or type indicator

console.log('\nHeader analysis:');
console.log(`  First byte: 0x${header[0].toString(16)} = ${header[0]}`);
console.log(`  Bytes 1-4 (BE): ${header.readUInt32BE(1)}`);
console.log(`  Bytes 1-4 (LE): ${header.readUInt32LE(1)}`);

// The header might be an IV or nonce
// Try AES decryption with header as IV
console.log('\n=== Trying AES with header ===\n');

const aesKeys = [
  { name: 'MD5(embedId)', key: crypto.createHash('md5').update(embedId).digest() },
  { name: 'MD5(cleanedPath)', key: crypto.createHash('md5').update(cleanedPath).digest() },
  { name: 'MD5(rapidshare)', key: crypto.createHash('md5').update('rapidshare').digest() },
];

const encData = decoded.slice(19);
const iv = header.slice(0, 16);

aesKeys.forEach(({ name, key }) => {
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    // Pad encData to multiple of 16
    const padded = Buffer.concat([encData, Buffer.alloc(16 - (encData.length % 16), 0)]);
    const decrypted = Buffer.concat([decipher.update(padded), decipher.final()]);
    
    const str = decrypted.toString('utf8');
    if (str.includes('http') || /^[\x20-\x7e]+$/.test(str.slice(0, 20))) {
      console.log(`${name}: ${str.slice(0, 60)}`);
    }
  } catch (e) {
    // Ignore errors
  }
});

console.log('\n=== Done ===');
