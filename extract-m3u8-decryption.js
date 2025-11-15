// Extract M3U8 AES-128 decryption logic from playerjs
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('=== Extracting M3U8 Decryption Logic ===\n');

// Find the software decrypt function
const softwareDecryptMatch = content.match(/softwareDecrypt[^}]+function[^}]+{[^}]+}/g);
if (softwareDecryptMatch) {
  console.log('✓ Found softwareDecrypt function:');
  console.log(softwareDecryptMatch[0]);
  console.log('\n');
}

// Find AES-128 handling
const aes128Matches = content.match(/.{0,500}AES-128.{0,500}/gi);
if (aes128Matches) {
  console.log('✓ Found AES-128 handling contexts:');
  aes128Matches.forEach((match, i) => {
    console.log(`\n--- Context ${i + 1} ---`);
    console.log(match);
  });
}

// Find key loading logic
const keyLoadMatches = content.match(/.{0,300}keyLoad.{0,300}/gi);
if (keyLoadMatches) {
  console.log('\n\n✓ Found key loading logic:');
  keyLoadMatches.slice(0, 3).forEach((match, i) => {
    console.log(`\n--- Key Load ${i + 1} ---`);
    console.log(match);
  });
}

// Find EXT-X-KEY parsing
const extKeyMatches = content.match(/.{0,400}EXT-X-KEY.{0,400}/gi);
if (extKeyMatches) {
  console.log('\n\n✓ Found EXT-X-KEY parsing:');
  extKeyMatches.forEach((match, i) => {
    console.log(`\n--- EXT-X-KEY ${i + 1} ---`);
    console.log(match);
  });
}

// Look for decrypt implementation
const decryptImplMatches = content.match(/decrypt[^(]*\([^)]*\)[^{]*{[^}]{50,500}}/gi);
if (decryptImplMatches) {
  console.log('\n\n✓ Found decrypt implementations:');
  decryptImplMatches.slice(0, 5).forEach((match, i) => {
    console.log(`\n--- Decrypt ${i + 1} ---`);
    console.log(match);
  });
}

// Find IV (initialization vector) handling
const ivMatches = content.match(/.{0,200}currentIV.{0,200}/gi);
if (ivMatches) {
  console.log('\n\n✓ Found IV handling:');
  ivMatches.slice(0, 3).forEach((match, i) => {
    console.log(`\n--- IV ${i + 1} ---`);
    console.log(match);
  });
}

console.log('\n\n=== Summary ===');
console.log('The playerjs uses HLS.js library for m3u8 playback.');
console.log('It includes AES-128-CBC decryption for encrypted segments.');
console.log('Key points:');
console.log('1. EXT-X-KEY tags are parsed from m3u8 playlists');
console.log('2. Decryption keys are loaded from the URI specified in EXT-X-KEY');
console.log('3. AES-128-CBC is used with an IV (initialization vector)');
console.log('4. Software decryption fallback is available');
