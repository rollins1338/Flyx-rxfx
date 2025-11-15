/**
 * REVERSE THEN DECODE
 * The == at the start is actually base64 padding at the END!
 */

const fs = require('fs');
const zlib = require('zlib');

const divContent = fs.readFileSync('hidden-div-content.txt', 'utf8');
const divId = fs.readFileSync('hidden-div-id.txt', 'utf8').trim();

console.log('🔥 REVERSE THEN DECODE TEST\n');
console.log('Div ID:', divId);
console.log('Content length:', divContent.length);
console.log('Starts with:', divContent.substring(0, 20));
console.log('Ends with:', divContent.substring(divContent.length - 20));

// REVERSE THE STRING
console.log('\n🔄 Reversing the string...');
const reversed = divContent.split('').reverse().join('');
console.log('Reversed starts with:', reversed.substring(0, 20));
console.log('Reversed ends with:', reversed.substring(reversed.length - 20));

// Now try decoding methods on the REVERSED string
console.log('\n🔓 Trying decoding methods on REVERSED string...\n');

// Method 1: Direct base64 decode
console.log('1️⃣  Direct base64 decode:');
try {
  const decoded = Buffer.from(reversed, 'base64').toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 2: Base64 decode then gzip decompress
console.log('\n2️⃣  Base64 decode then gzip decompress:');
try {
  const b64decoded = Buffer.from(reversed, 'base64');
  console.log('  Base64 decoded length:', b64decoded.length);
  const decompressed = zlib.gunzipSync(b64decoded);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decompressed length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 3: Base64 decode then inflate
console.log('\n3️⃣  Base64 decode then inflate:');
try {
  const b64decoded = Buffer.from(reversed, 'base64');
  const decompressed = zlib.inflateSync(b64decoded);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decompressed length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 4: Base64 decode then inflateRaw
console.log('\n4️⃣  Base64 decode then inflateRaw:');
try {
  const b64decoded = Buffer.from(reversed, 'base64');
  const decompressed = zlib.inflateRawSync(b64decoded);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decompressed length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 5: URL-safe base64 (replace . with + and _ with /)
console.log('\n5️⃣  URL-safe base64 decode:');
try {
  const cleaned = reversed.replace(/\./g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 6: URL-safe base64 + gzip
console.log('\n6️⃣  URL-safe base64 + gzip:');
try {
  const cleaned = reversed.replace(/\./g, '+').replace(/_/g, '/');
  const b64decoded = Buffer.from(cleaned, 'base64');
  const decompressed = zlib.gunzipSync(b64decoded);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decompressed length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 7: XOR with div ID after base64 decode
console.log('\n7️⃣  Base64 decode then XOR with div ID:');
try {
  const b64decoded = Buffer.from(reversed, 'base64');
  const xored = Buffer.alloc(b64decoded.length);
  for (let i = 0; i < b64decoded.length; i++) {
    xored[i] = b64decoded[i] ^ divId.charCodeAt(i % divId.length);
  }
  const decoded = xored.toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 8: XOR then decompress
console.log('\n8️⃣  Base64 decode, XOR with div ID, then gzip:');
try {
  const b64decoded = Buffer.from(reversed, 'base64');
  const xored = Buffer.alloc(b64decoded.length);
  for (let i = 0; i < b64decoded.length; i++) {
    xored[i] = b64decoded[i] ^ divId.charCodeAt(i % divId.length);
  }
  const decompressed = zlib.gunzipSync(xored);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decompressed length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 🎯 🎯 CONTAINS URL! 🎯 🎯 🎯');
    console.log('  Full:', decoded);
    fs.writeFileSync('DECODED-SUCCESS.txt', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

console.log('\n✅ Test complete!');
