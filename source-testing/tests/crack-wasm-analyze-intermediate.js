/**
 * Analyze the intermediate bytes found in memory
 * These might be part of the key derivation
 */

const crypto = require('crypto');

// Known values
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const key = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
const xorConstant = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

// Intermediate bytes found at offset 1048280 (112 bytes before key)
const intermediateHex = '0d5ea4ad9a3e9de4851c97cd28c776478d7495f9b084ebd08331548e10207fd1';

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

const fpHashBytes = hexToBytes(fpHash);
const keyBytes = hexToBytes(key);
const xorBytes = hexToBytes(xorConstant);
const intermediateBytes = hexToBytes(intermediateHex);

console.log('=== Intermediate Bytes Analysis ===');
console.log('Intermediate:', intermediateHex);
console.log('fpHash:', fpHash);
console.log('key:', key);
console.log('xorConstant:', xorConstant);

// XOR operations
console.log('\n=== XOR Operations ===');

const intXorFp = intermediateBytes.map((b, i) => b ^ fpHashBytes[i]);
console.log('intermediate XOR fpHash:', bytesToHex(intXorFp));

const intXorKey = intermediateBytes.map((b, i) => b ^ keyBytes[i]);
console.log('intermediate XOR key:', bytesToHex(intXorKey));

const intXorXor = intermediateBytes.map((b, i) => b ^ xorBytes[i]);
console.log('intermediate XOR xorConstant:', bytesToHex(intXorXor));

// Check if intermediate is related to SHA256
console.log('\n=== SHA256 Checks ===');

const sha256Int = crypto.createHash('sha256').update(Buffer.from(intermediateBytes)).digest('hex');
console.log('SHA256(intermediate):', sha256Int);

const sha256IntHex = crypto.createHash('sha256').update(intermediateHex).digest('hex');
console.log('SHA256(intermediate hex string):', sha256IntHex);

// Check if intermediate is SHA256 of something
console.log('\n=== Reverse SHA256 Checks ===');
console.log('Is intermediate == SHA256(fpHash)?', intermediateHex === crypto.createHash('sha256').update(fpHash).digest('hex'));
console.log('Is intermediate == SHA256(key)?', intermediateHex === crypto.createHash('sha256').update(key).digest('hex'));
console.log('Is intermediate == SHA256(xorConstant)?', intermediateHex === crypto.createHash('sha256').update(xorConstant).digest('hex'));

// Check byte reversal
console.log('\n=== Byte Reversal ===');
const intReversed = intermediateBytes.slice().reverse();
console.log('intermediate reversed:', bytesToHex(intReversed));

const intRevXorFp = intReversed.map((b, i) => b ^ fpHashBytes[i]);
console.log('reversed XOR fpHash:', bytesToHex(intRevXorFp));
console.log('Is this the key?', bytesToHex(intRevXorFp) === key);

// Check word reversal (32-bit words)
console.log('\n=== Word Reversal (32-bit) ===');
const intWordRev = [];
for (let i = 0; i < 32; i += 4) {
  intWordRev.push(intermediateBytes[i + 3], intermediateBytes[i + 2], intermediateBytes[i + 1], intermediateBytes[i]);
}
console.log('intermediate word-reversed:', bytesToHex(intWordRev));

const intWordRevXorFp = intWordRev.map((b, i) => b ^ fpHashBytes[i]);
console.log('word-reversed XOR fpHash:', bytesToHex(intWordRevXorFp));
console.log('Is this the key?', bytesToHex(intWordRevXorFp) === key);

// Check if intermediate is HMAC
console.log('\n=== HMAC Checks ===');
const hmac1 = crypto.createHmac('sha256', Buffer.from(fpHashBytes)).update('1700000000').digest('hex');
console.log('HMAC-SHA256(fpHash, timestamp):', hmac1);
console.log('Is this intermediate?', hmac1 === intermediateHex);

const hmac2 = crypto.createHmac('sha256', '1700000000').update(Buffer.from(fpHashBytes)).digest('hex');
console.log('HMAC-SHA256(timestamp, fpHash):', hmac2);
console.log('Is this intermediate?', hmac2 === intermediateHex);

// Check if intermediate is part of AES key schedule
console.log('\n=== AES Key Schedule Check ===');
// AES-256 key schedule expands 32 bytes to 240 bytes
// The intermediate might be part of the expanded key

// Check if intermediate XOR with something gives the xorConstant
console.log('\n=== Finding XOR Source ===');
// If key = fpHash XOR xorConstant, and intermediate is involved...
// Maybe: xorConstant = intermediate XOR something

const neededForXor = intermediateBytes.map((b, i) => b ^ xorBytes[i]);
console.log('intermediate XOR xorConstant:', bytesToHex(neededForXor));

// Check if this is fpHash
console.log('Is this fpHash?', bytesToHex(neededForXor) === fpHash);

// Check if this is key
console.log('Is this key?', bytesToHex(neededForXor) === key);

// Check if this is SHA256 of something
const sha256Needed = crypto.createHash('sha256').update(Buffer.from(neededForXor)).digest('hex');
console.log('SHA256 of (intermediate XOR xorConstant):', sha256Needed);

// Try different interpretations
console.log('\n=== Alternative Interpretations ===');

// Maybe the intermediate is the second SHA256 hash (before XOR)
// key = SHA256(SHA256(fingerprint).hex) XOR something
const doubleHash = crypto.createHash('sha256').update(fpHash).digest('hex');
console.log('SHA256(fpHash hex):', doubleHash);

// What would we need to XOR doubleHash with to get key?
const doubleHashBytes = hexToBytes(doubleHash);
const neededXor = doubleHashBytes.map((b, i) => b ^ keyBytes[i]);
console.log('SHA256(fpHash) XOR key:', bytesToHex(neededXor));

// Is this the intermediate?
console.log('Is this intermediate?', bytesToHex(neededXor) === intermediateHex);

// What if: key = fpHash XOR intermediate XOR something?
const fpXorInt = fpHashBytes.map((b, i) => b ^ intermediateBytes[i]);
console.log('\nfpHash XOR intermediate:', bytesToHex(fpXorInt));

// What would we need to XOR this with to get key?
const neededForKey = fpXorInt.map((b, i) => b ^ keyBytes[i]);
console.log('(fpHash XOR intermediate) XOR key:', bytesToHex(neededForKey));

// Check if this is a known value
console.log('Is this xorConstant?', bytesToHex(neededForKey) === xorConstant);
console.log('Is this doubleHash?', bytesToHex(neededForKey) === doubleHash);
