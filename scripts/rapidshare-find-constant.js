/**
 * Find the pattern in the "constant" = cipherDiff XOR plainDiff
 * 
 * If this constant can be derived from something other than plaintext,
 * we can decrypt without knowing the URL!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// FNAF2 data
const FNAF2_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const FNAF2_URL = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866';
const FNAF2_APP_HASH = '2457433dff868594ecbf3b15e9f22a46efd70a';

const fnaf2Cipher = urlSafeBase64Decode(FNAF2_PAGE_DATA);
const fnaf2Plain = Buffer.from(FNAF2_URL, 'utf8');

// Compute the "constants" for FNAF2
console.log('=== FNAF2 Constants Analysis ===\n');

const constants = [];
for (let i = 19; i < fnaf2Cipher.length; i++) {
  const cipherDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const plainDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  const constant = cipherDiff ^ plainDiff;
  constants.push(constant);
}

console.log('Constants (hex):', constants.map(c => c.toString(16).padStart(2, '0')).join(' '));
console.log('Constants as string:', Buffer.from(constants).toString('utf8'));

// Check if constants relate to app.js hash
const appHashBytes = Buffer.from(FNAF2_APP_HASH, 'hex');
console.log('\nApp.js hash (hex):', appHashBytes.toString('hex'));
console.log('App.js hash length:', appHashBytes.length);

// XOR constants with app hash
console.log('\nConstants XOR app hash:');
for (let i = 0; i < constants.length && i < appHashBytes.length; i++) {
  const xor = constants[i] ^ appHashBytes[i];
  process.stdout.write(xor.toString(16).padStart(2, '0') + ' ');
}
console.log();

// Check if constants relate to the key
const fnaf2Key = Buffer.alloc(fnaf2Cipher.length);
for (let i = 0; i < fnaf2Cipher.length; i++) {
  fnaf2Key[i] = fnaf2Cipher[i] ^ fnaf2Plain[i];
}

console.log('\nFNAF2 Key (hex):', fnaf2Key.toString('hex'));

// The constant IS the key difference!
// constant[i-19] = key[i] XOR key[i-19]
console.log('\nVerifying: constant = key[i] XOR key[i-19]');
for (let i = 19; i < fnaf2Key.length; i++) {
  const keyDiff = fnaf2Key[i] ^ fnaf2Key[i - 19];
  const constant = constants[i - 19];
  console.log(`i=${i}: keyDiff=${keyDiff.toString(16).padStart(2,'0')} constant=${constant.toString(16).padStart(2,'0')} match=${keyDiff === constant}`);
}

// So the "constant" is actually the key difference!
// key[i] = key[i-19] XOR constant[i-19]
// 
// If we can find a pattern in the key, we can decrypt!

console.log('\n=== Key Pattern Analysis ===\n');

// Check if key has a repeating pattern
console.log('Key bytes:');
for (let i = 0; i < fnaf2Key.length; i++) {
  console.log(`key[${i}] = ${fnaf2Key[i].toString(16).padStart(2, '0')} (${String.fromCharCode(fnaf2Key[i]).replace(/[^\x20-\x7E]/g, '?')})`);
}

// Check if key[i] relates to HEADER[i % 19]
console.log('\n=== Key vs HEADER relationship ===');
for (let i = 0; i < fnaf2Key.length; i++) {
  const headerByte = HEADER[i % 19];
  const xor = fnaf2Key[i] ^ headerByte;
  console.log(`i=${i}: key=${fnaf2Key[i].toString(16).padStart(2,'0')} header[${i%19}]=${headerByte.toString(16).padStart(2,'0')} xor=${xor.toString(16).padStart(2,'0')} (${String.fromCharCode(xor).replace(/[^\x20-\x7E]/g, '?')})`);
}

// AH HA! key[i] XOR HEADER[i % 19] should give us the plaintext!
// Because: key[i] = HEADER[i % 19] XOR plain[i] (for i < 19)
// And the recurrence maintains this relationship!

console.log('\n=== Verifying: key XOR HEADER = plain ===');
for (let i = 0; i < fnaf2Key.length; i++) {
  const headerByte = HEADER[i % 19];
  const computed = fnaf2Key[i] ^ headerByte;
  const actual = fnaf2Plain[i];
  console.log(`i=${i}: computed=${computed} actual=${actual} char='${String.fromCharCode(computed)}' match=${computed === actual}`);
}

// If this works, then we can decrypt ANY ciphertext by:
// 1. key[i] = cipher[i] XOR plain[i]
// 2. plain[i] = key[i] XOR HEADER[i % 19]
// 3. Substituting: plain[i] = (cipher[i] XOR plain[i]) XOR HEADER[i % 19]
// 4. plain[i] XOR plain[i] = cipher[i] XOR HEADER[i % 19]
// 5. 0 = cipher[i] XOR HEADER[i % 19]
// 6. cipher[i] = HEADER[i % 19]
//
// This would mean cipher is just HEADER repeated! Let's check...

console.log('\n=== Checking if cipher = HEADER repeated ===');
for (let i = 0; i < fnaf2Cipher.length; i++) {
  const headerByte = HEADER[i % 19];
  console.log(`i=${i}: cipher=${fnaf2Cipher[i].toString(16).padStart(2,'0')} header[${i%19}]=${headerByte.toString(16).padStart(2,'0')} match=${fnaf2Cipher[i] === headerByte}`);
}

// They don't match after position 19! So the relationship is more complex.
