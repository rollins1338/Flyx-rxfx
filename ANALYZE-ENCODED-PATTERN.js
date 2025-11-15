/**
 * ANALYZE THE ENCODED PATTERN
 * Look for patterns in the encoded content
 */

const fs = require('fs');
const zlib = require('zlib');

const divContent = fs.readFileSync('hidden-div-content.txt', 'utf8');
const divId = fs.readFileSync('hidden-div-id.txt', 'utf8').trim();

console.log('🔍 ANALYZING ENCODED PATTERN\n');
console.log('Div ID:', divId);
console.log('Content length:', divContent.length);
console.log('Content preview:', divContent.substring(0, 100));
console.log('Content end:', divContent.substring(divContent.length - 100));

// Character frequency analysis
const charFreq = {};
for (const char of divContent) {
  charFreq[char] = (charFreq[char] || 0) + 1;
}

console.log('\n📊 Character frequency (top 20):');
const sorted = Object.entries(charFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);
sorted.forEach(([char, count]) => {
  const display = char === ' ' ? 'SPACE' : char === '\n' ? 'NEWLINE' : char;
  const pct = ((count / divContent.length) * 100).toFixed(2);
  console.log(`  ${display}: ${count} (${pct}%)`);
});

// Check for patterns
console.log('\n🔍 Pattern analysis:');
console.log('  Contains =:', divContent.includes('='));
console.log('  Starts with =:', divContent.startsWith('='));
console.log('  Contains +:', divContent.includes('+'));
console.log('  Contains /:', divContent.includes('/'));
console.log('  Contains -:', divContent.includes('-'));
console.log('  Contains _:', divContent.includes('_'));
console.log('  Contains .:', divContent.includes('.'));

// Try various decoding methods
console.log('\n🔓 Trying decoding methods...\n');

// Method 1: Direct base64
console.log('1️⃣  Direct base64 decode:');
try {
  const decoded = Buffer.from(divContent, 'base64').toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 2: Remove leading = and decode
console.log('\n2️⃣  Remove leading = and decode:');
try {
  const cleaned = divContent.replace(/^=+/, '');
  const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 3: Reverse and decode
console.log('\n3️⃣  Reverse and decode:');
try {
  const reversed = divContent.split('').reverse().join('');
  const decoded = Buffer.from(reversed, 'base64').toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 4: Replace . with + and _ with / (URL-safe base64)
console.log('\n4️⃣  URL-safe base64 (. → +, _ → /):');
try {
  const cleaned = divContent.replace(/\./g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 5: XOR with div ID
console.log('\n5️⃣  XOR with div ID:');
try {
  const buffer = Buffer.from(divContent);
  const xored = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
  }
  const decoded = xored.toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 6: Base64 decode then XOR
console.log('\n6️⃣  Base64 decode then XOR with div ID:');
try {
  const b64decoded = Buffer.from(divContent, 'base64');
  const xored = Buffer.alloc(b64decoded.length);
  for (let i = 0; i < b64decoded.length; i++) {
    xored[i] = b64decoded[i] ^ divId.charCodeAt(i % divId.length);
  }
  const decoded = xored.toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 7: Base64 decode then gzip decompress
console.log('\n7️⃣  Base64 decode then gzip decompress:');
try {
  const b64decoded = Buffer.from(divContent, 'base64');
  const decompressed = zlib.gunzipSync(b64decoded);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 8: Remove = prefix, base64 decode, gzip decompress
console.log('\n8️⃣  Remove =, base64 decode, gzip decompress:');
try {
  const cleaned = divContent.replace(/^=+/, '');
  const b64decoded = Buffer.from(cleaned, 'base64');
  const decompressed = zlib.gunzipSync(b64decoded);
  const decoded = decompressed.toString('utf8');
  console.log('  ✓ Decoded length:', decoded.length);
  console.log('  Preview:', decoded.substring(0, 100));
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('  🎯 CONTAINS URL!');
    console.log('  Full:', decoded);
  }
} catch (e) {
  console.log('  ✗ Failed:', e.message);
}

// Method 9: Character substitution then base64
console.log('\n9️⃣  Character substitution (various):');
const substitutions = [
  { from: '=', to: 'A', name: '= → A' },
  { from: '=', to: '+', name: '= → +' },
  { from: '=', to: '/', name: '= → /' },
];

for (const sub of substitutions) {
  try {
    const cleaned = divContent.replace(new RegExp(sub.from, 'g'), sub.to);
    const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
    console.log(`  ${sub.name}:`);
    console.log('    ✓ Decoded length:', decoded.length);
    console.log('    Preview:', decoded.substring(0, 50));
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log('    🎯 CONTAINS URL!');
      console.log('    Full:', decoded);
    }
  } catch (e) {
    console.log(`  ${sub.name}: ✗ Failed`);
  }
}

console.log('\n✅ Analysis complete!');
