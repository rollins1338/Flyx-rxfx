/**
 * Brute force MegaUp decryption by trying all combinations of operations
 * 
 * Known operations from the obfuscated code:
 * - XOR with 131
 * - Add 131 mod 256
 * - Subtract 131 mod 256
 * - Add 48 mod 256
 * - Subtract 48 mod 256
 * - Rotate left 2, 3, 4, 5 bits
 * - Rotate right 2, 3, 4, 5 bits
 */

// Base64URL decode
function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

// Operations
const ops = {
  xor131: b => b ^ 131,
  add131: b => (b + 131) % 256,
  sub131: b => (b - 131 + 256) % 256,
  add48: b => (b + 48) % 256,
  sub48: b => (b - 48 + 256) % 256,
  rotL2: b => ((b << 2) | (b >>> 6)) & 0xFF,
  rotR2: b => ((b >>> 2) | (b << 6)) & 0xFF,
  rotL3: b => ((b << 3) | (b >>> 5)) & 0xFF,
  rotR3: b => ((b >>> 3) | (b << 5)) & 0xFF,
  rotL4: b => ((b << 4) | (b >>> 4)) & 0xFF,
  rotR4: b => ((b >>> 4) | (b << 4)) & 0xFF,
  rotL5: b => ((b << 5) | (b >>> 3)) & 0xFF,
  rotR5: b => ((b >>> 5) | (b << 3)) & 0xFF,
};

// Apply operation to all bytes
function applyOp(bytes, opName) {
  const op = ops[opName];
  return bytes.map(b => op(b));
}

// Check if result looks like JSON
function looksLikeJSON(bytes) {
  // JSON should start with { (123) and end with } (125)
  if (bytes[0] !== 123) return false;
  if (bytes[bytes.length - 1] !== 125) return false;
  
  // Should contain "file" or "sources"
  const str = String.fromCharCode(...bytes);
  return str.includes('"file"') || str.includes('"sources"') || str.includes('http');
}

// Check if result is printable ASCII
function isPrintable(bytes) {
  return bytes.every(b => b >= 32 && b <= 126);
}

// Try single operations
function trySingle(decoded) {
  console.log('=== Trying single operations ===\n');
  
  const bytes = Array.from(decoded);
  
  for (const [name, op] of Object.entries(ops)) {
    const result = bytes.map(b => op(b));
    const str = String.fromCharCode(...result);
    
    if (result[0] === 123) { // Starts with {
      console.log(`${name}: ${str.substring(0, 80)}`);
    }
  }
}

// Try pairs of operations
function tryPairs(decoded) {
  console.log('\n=== Trying pairs of operations ===\n');
  
  const bytes = Array.from(decoded);
  const opNames = Object.keys(ops);
  
  for (const op1 of opNames) {
    for (const op2 of opNames) {
      let result = bytes.map(b => ops[op1](b));
      result = result.map(b => ops[op2](b));
      
      if (result[0] === 123) { // Starts with {
        const str = String.fromCharCode(...result);
        if (str.includes('"') || str.includes('http')) {
          console.log(`${op1} -> ${op2}: ${str.substring(0, 100)}`);
        }
      }
    }
  }
}

// Try triples of operations
function tryTriples(decoded) {
  console.log('\n=== Trying triples of operations ===\n');
  
  const bytes = Array.from(decoded);
  const opNames = Object.keys(ops);
  
  let found = 0;
  for (const op1 of opNames) {
    for (const op2 of opNames) {
      for (const op3 of opNames) {
        let result = bytes.map(b => ops[op1](b));
        result = result.map(b => ops[op2](b));
        result = result.map(b => ops[op3](b));
        
        if (result[0] === 123 && result[result.length - 1] === 125) {
          const str = String.fromCharCode(...result);
          if (str.includes('"file"') || str.includes('http')) {
            console.log(`✓ ${op1} -> ${op2} -> ${op3}:`);
            console.log(str);
            found++;
            if (found >= 5) return;
          }
        }
      }
    }
  }
}

// Try with per-byte index-based operations (like XOR with position)
function tryIndexBased(decoded) {
  console.log('\n=== Trying index-based operations ===\n');
  
  const bytes = Array.from(decoded);
  
  // XOR with index
  let result = bytes.map((b, i) => b ^ (i % 256));
  let str = String.fromCharCode(...result);
  console.log('XOR with index:', str.substring(0, 80));
  
  // XOR with index + constant
  for (const c of [131, 48, 83, 85, 73, 123]) {
    result = bytes.map((b, i) => b ^ ((i + c) % 256));
    str = String.fromCharCode(...result);
    if (str[0] === '{') {
      console.log(`XOR with (index + ${c}):`, str.substring(0, 80));
    }
  }
  
  // Subtract index
  result = bytes.map((b, i) => (b - i + 256) % 256);
  str = String.fromCharCode(...result);
  console.log('Subtract index:', str.substring(0, 80));
}

// The decryption chain from the code was complex
// Let me try the specific sequence found in the obfuscated code
function trySpecificSequence(decoded) {
  console.log('\n=== Trying specific sequences from obfuscated code ===\n');
  
  let bytes = Array.from(decoded);
  
  // Sequence 1: Based on the constants found (131, 48, rotations)
  // The code had: o2 -> n2 -> K -> v2 -> S -> b2 -> Q -> t2 -> H -> c2 -> h
  
  // Try: rotR5 -> sub131 -> xor131
  let result = bytes.map(b => ops.rotR5(b));
  result = result.map(b => ops.sub131(b));
  result = result.map(b => ops.xor131(b));
  console.log('rotR5 -> sub131 -> xor131:', String.fromCharCode(...result).substring(0, 80));
  
  // Try: xor131 -> rotR5 -> sub131
  result = bytes.map(b => ops.xor131(b));
  result = result.map(b => ops.rotR5(b));
  result = result.map(b => ops.sub131(b));
  console.log('xor131 -> rotR5 -> sub131:', String.fromCharCode(...result).substring(0, 80));
  
  // Try: sub131 -> xor131 -> rotR5
  result = bytes.map(b => ops.sub131(b));
  result = result.map(b => ops.xor131(b));
  result = result.map(b => ops.rotR5(b));
  console.log('sub131 -> xor131 -> rotR5:', String.fromCharCode(...result).substring(0, 80));
  
  // Try with 48 instead
  result = bytes.map(b => ops.sub48(b));
  result = result.map(b => ops.xor131(b));
  console.log('sub48 -> xor131:', String.fromCharCode(...result).substring(0, 80));
  
  // Try: xor131 -> sub48
  result = bytes.map(b => ops.xor131(b));
  result = result.map(b => ops.sub48(b));
  console.log('xor131 -> sub48:', String.fromCharCode(...result).substring(0, 80));
}

async function main() {
  const encrypted = '3wMOLPOCFprWglc038GT4eurZQDTypKLMDMT4A0mzCCgb6yyhTIuEFpOeciU9-isScEP94g4uw4';
  const decoded = b64UrlDecode(encrypted);
  
  console.log('Encrypted:', encrypted);
  console.log('Decoded length:', decoded.length);
  console.log('First 10 bytes:', Array.from(decoded.slice(0, 10)));
  console.log('');
  
  trySingle(decoded);
  tryPairs(decoded);
  tryTriples(decoded);
  tryIndexBased(decoded);
  trySpecificSequence(decoded);
}

main().catch(console.error);
