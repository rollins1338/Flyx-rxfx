// FINAL COMPREHENSIVE HASH CRACKER
const crypto = require('crypto');

// Real data from Sonic 3
const divId = 'sXnL9MQIry';
const encoded = '141c170a30620b137b355c5d2f2b210c09172d3a16523e0950';

console.log('='.repeat(70));
console.log('🔓 FINAL COMPREHENSIVE HASH CRACKER');
console.log('='.repeat(70));

console.log(`\nDiv ID: ${divId}`);
console.log(`Encoded: ${encoded.substring(0, 100)}...`);
console.log(`Length: ${encoded.length} (${encoded.length / 2} bytes when hex decoded)`);

// Hex decode
const hexBuffer = Buffer.from(encoded, 'hex');
console.log(`\nHex decoded: ${hexBuffer.length} bytes`);
console.log(`First 20 bytes (hex): ${hexBuffer.slice(0, 20).toString('hex')}`);
console.log(`First 20 bytes (dec): ${Array.from(hexBuffer.slice(0, 20)).join(', ')}`);

console.log(`\n${'='.repeat(70)}`);
console.log('🔓 TRYING ALL POSSIBLE DECODERS');
console.log('='.repeat(70));

let found = false;

// Method 1: XOR with divId
console.log(`\n[1] XOR with Div ID:`);
try {
  const xored = Buffer.alloc(hexBuffer.length);
  for (let i = 0; i < hexBuffer.length; i++) {
    xored[i] = hexBuffer[i] ^ divId.charCodeAt(i % divId.length);
  }
  const result = xored.toString('utf8');
  console.log(`  First 100 chars: ${result.substring(0, 100).replace(/[^\x20-\x7E]/g, '.')}`);
  if (result.includes('http')) {
    console.log(`  ✅ FOUND: ${result}`);
    found = true;
  }
} catch (e) {
  console.log(`  ❌ Error: ${e.message}`);
}

// Method 2: XOR with divId hash
if (!found) {
  console.log(`\n[2] XOR with Div ID (MD5 hash as key):`);
  try {
    const keyHash = crypto.createHash('md5').update(divId).digest();
    const xored = Buffer.alloc(hexBuffer.length);
    for (let i = 0; i < hexBuffer.length; i++) {
      xored[i] = hexBuffer[i] ^ keyHash[i % keyHash.length];
    }
    const result = xored.toString('utf8');
    console.log(`  First 100 chars: ${result.substring(0, 100).replace(/[^\x20-\x7E]/g, '.')}`);
    if (result.includes('http')) {
      console.log(`  ✅ FOUND: ${result}`);
      found = true;
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
  }
}

// Method 3: AES decryption with divId as key
if (!found) {
  console.log(`\n[3] AES-128-CBC with Div ID:`);
  try {
    // Pad divId to 16 bytes for AES-128
    const key = Buffer.alloc(16);
    Buffer.from(divId).copy(key);
    
    // Try with zero IV
    const iv = Buffer.alloc(16);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(hexBuffer), decipher.final()]);
    const result = decrypted.toString('utf8');
    console.log(`  First 100 chars: ${result.substring(0, 100).replace(/[^\x20-\x7E]/g, '.')}`);
    if (result.includes('http')) {
      console.log(`  ✅ FOUND: ${result}`);
      found = true;
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
  }
}

// Method 4: RC4 with divId
if (!found) {
  console.log(`\n[4] RC4 with Div ID:`);
  try {
    const decipher = crypto.createDecipheriv('rc4', Buffer.from(divId), '');
    const decrypted = Buffer.concat([decipher.update(hexBuffer), decipher.final()]);
    const result = decrypted.toString('utf8');
    console.log(`  First 100 chars: ${result.substring(0, 100).replace(/[^\x20-\x7E]/g, '.')}`);
    if (result.includes('http')) {
      console.log(`  ✅ FOUND: ${result}`);
      found = true;
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
  }
}

// Method 5: Simple byte manipulation
if (!found) {
  console.log(`\n[5] Byte Manipulation (subtract, add, etc):`);
  
  // Try subtracting a constant
  for (let offset = 1; offset <= 255; offset++) {
    const modified = Buffer.alloc(hexBuffer.length);
    for (let i = 0; i < hexBuffer.length; i++) {
      modified[i] = (hexBuffer[i] - offset + 256) % 256;
    }
    const result = modified.toString('utf8');
    if (result.includes('http')) {
      console.log(`  ✅ FOUND with offset -${offset}: ${result}`);
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log(`  ❌ No valid URL found with byte manipulation`);
  }
}

// Method 6: Check if it's double-encoded
if (!found) {
  console.log(`\n[6] Double Encoding Check:`);
  try {
    // Maybe the hex is actually ASCII hex characters that need another decode
    const asciiHex = hexBuffer.toString('utf8');
    console.log(`  As ASCII: ${asciiHex.substring(0, 50)}`);
    
    if (/^[0-9a-fA-F]+$/.test(asciiHex)) {
      console.log(`  Looks like hex! Decoding again...`);
      const doubleDecoded = Buffer.from(asciiHex, 'hex');
      console.log(`  Double decoded: ${doubleDecoded.toString('utf8').substring(0, 100)}`);
      
      if (doubleDecoded.toString('utf8').includes('http')) {
        console.log(`  ✅ FOUND with double decode: ${doubleDecoded.toString('utf8')}`);
        found = true;
      }
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
  }
}

// Method 7: Analyze byte patterns
if (!found) {
  console.log(`\n[7] Byte Pattern Analysis:`);
  
  // Calculate entropy
  const freq = new Map();
  for (const byte of hexBuffer) {
    freq.set(byte, (freq.get(byte) || 0) + 1);
  }
  
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / hexBuffer.length;
    entropy -= p * Math.log2(p);
  }
  
  console.log(`  Entropy: ${entropy.toFixed(2)} bits/byte`);
  console.log(`  (0-4: structured, 4-6: compressed, 6-8: encrypted)`);
  
  // Check for repeating patterns
  const first16 = hexBuffer.slice(0, 16).toString('hex');
  let repeatCount = 0;
  for (let i = 16; i < hexBuffer.length - 16; i += 16) {
    if (hexBuffer.slice(i, i + 16).toString('hex') === first16) {
      repeatCount++;
    }
  }
  
  console.log(`  Repeating 16-byte blocks: ${repeatCount}`);
  
  if (entropy > 7) {
    console.log(`  ⚠️  High entropy suggests strong encryption or compression`);
  }
}

if (!found) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('❌ ALL METHODS FAILED');
  console.log('='.repeat(70));
  console.log(`\nThe encoding is likely:`);
  console.log(`1. A custom cipher not in standard crypto libraries`);
  console.log(`2. Using a key derived from something other than divId`);
  console.log(`3. Using a complex multi-stage encoding`);
  console.log(`\nNext steps:`);
  console.log(`1. Analyze the PlayerJS code more carefully`);
  console.log(`2. Look for the actual decryption function in playerjs-main.js`);
  console.log(`3. Try to execute the PlayerJS decoder in a browser context`);
} else {
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ SUCCESS!');
  console.log('='.repeat(70));
}
