// Analyze the real encoded hash from Sonic 3
const divId = 'JoAHUMCLXV';
const encoded = '=sDe2AXM3ZHbvJDMERERENjZZRHRoZXazkWOodjViZkN4xmb7U';

console.log('='.repeat(70));
console.log('🔍 ANALYZING REAL HASH');
console.log('='.repeat(70));

console.log(`\nDiv ID: ${divId}`);
console.log(`Encoded: ${encoded}`);
console.log(`Length: ${encoded.length}`);

// Analyze character distribution
const chars = {};
for (const c of encoded) {
  chars[c] = (chars[c] || 0) + 1;
}

console.log(`\nCharacter distribution:`);
console.log(JSON.stringify(chars, null, 2));

// Check patterns
console.log(`\nPattern analysis:`);
console.log(`  Starts with '=': ${encoded.startsWith('=')}`);
console.log(`  Contains uppercase: ${/[A-Z]/.test(encoded)}`);
console.log(`  Contains lowercase: ${/[a-z]/.test(encoded)}`);
console.log(`  Contains digits: ${/[0-9]/.test(encoded)}`);
console.log(`  Contains +: ${encoded.includes('+')}`);
console.log(`  Contains /: ${encoded.includes('/')}`);
console.log(`  Contains =: ${encoded.includes('=')}`);

// This looks like URL-safe base64 but reversed or modified
console.log(`\n${'='.repeat(70)}`);
console.log('🔓 TRYING DECODERS');
console.log('='.repeat(70));

// Method 1: Standard base64
console.log(`\n[1] Standard Base64:`);
try {
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  console.log(`  Result: ${decoded.substring(0, 100)}`);
  if (decoded.includes('http')) {
    console.log(`  ✅ FOUND URL: ${decoded}`);
  }
} catch (e) {
  console.log(`  ❌ Failed: ${e.message}`);
}

// Method 2: Reverse then base64
console.log(`\n[2] Reverse + Base64:`);
try {
  const reversed = encoded.split('').reverse().join('');
  const decoded = Buffer.from(reversed, 'base64').toString('utf8');
  console.log(`  Reversed: ${reversed.substring(0, 50)}...`);
  console.log(`  Result: ${decoded.substring(0, 100)}`);
  if (decoded.includes('http')) {
    console.log(`  ✅ FOUND URL: ${decoded}`);
  }
} catch (e) {
  console.log(`  ❌ Failed: ${e.message}`);
}

// Method 3: Remove leading '=' then base64
console.log(`\n[3] Remove '=' + Base64:`);
try {
  const cleaned = encoded.replace(/^=+/, '');
  const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
  console.log(`  Cleaned: ${cleaned.substring(0, 50)}...`);
  console.log(`  Result: ${decoded.substring(0, 100)}`);
  if (decoded.includes('http')) {
    console.log(`  ✅ FOUND URL: ${decoded}`);
  }
} catch (e) {
  console.log(`  ❌ Failed: ${e.message}`);
}

// Method 4: Base64 + XOR with divId
console.log(`\n[4] Base64 + XOR with Div ID:`);
try {
  const decoded = Buffer.from(encoded, 'base64');
  const xored = Buffer.alloc(decoded.length);
  
  for (let i = 0; i < decoded.length; i++) {
    xored[i] = decoded[i] ^ divId.charCodeAt(i % divId.length);
  }
  
  const result = xored.toString('utf8');
  console.log(`  Result: ${result.substring(0, 100)}`);
  if (result.includes('http')) {
    console.log(`  ✅ FOUND URL: ${result}`);
  }
} catch (e) {
  console.log(`  ❌ Failed: ${e.message}`);
}

// Method 5: Caesar shift on the encoded string
console.log(`\n[5] Caesar Shifts:`);
for (let shift = -25; shift <= 25; shift++) {
  if (shift === 0) continue;
  
  const shifted = encoded.split('').map(c => {
    const code = c.charCodeAt(0);
    
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    }
    
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    
    return c;
  }).join('');
  
  try {
    const decoded = Buffer.from(shifted, 'base64').toString('utf8');
    if (decoded.includes('http')) {
      console.log(`  ✅ FOUND URL with shift ${shift}!`);
      console.log(`  Shifted: ${shifted.substring(0, 50)}...`);
      console.log(`  URL: ${decoded}`);
      break;
    }
  } catch (e) {
    // Continue
  }
}

// Method 6: Analyze as custom encoding
console.log(`\n[6] Custom Encoding Analysis:`);
console.log(`  The string looks like modified base64`);
console.log(`  Base64 alphabet: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=`);
console.log(`  This string uses: ${Object.keys(chars).sort().join('')}`);

// Check if it's a substitution cipher
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const uniqueChars = Object.keys(chars).sort().join('');
console.log(`  Uses ${Object.keys(chars).length} unique characters`);
console.log(`  Standard base64 uses 65 characters`);

console.log(`\n${'='.repeat(70)}`);
console.log('📊 CONCLUSION');
console.log('='.repeat(70));
console.log(`\nThe encoding appears to be a variant of base64.`);
console.log(`Next steps:`);
console.log(`1. Check if it's a custom base64 alphabet (substitution)`);
console.log(`2. Try XOR with different keys`);
console.log(`3. Look for patterns in multiple samples`);
