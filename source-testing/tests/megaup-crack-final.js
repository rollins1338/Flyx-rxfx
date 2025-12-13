/**
 * MegaUp Decryption - Manual Reverse Engineering
 * 
 * From the obfuscated code analysis:
 * - XOR with 131
 * - (x - 131 + 256) % 256
 * - (x + 131) % 256  
 * - Bit rotations: <<2, <<3, <<4, <<5, >>2, >>3, >>4, >>5
 * 
 * The decryption chain found was a series of byte transformations.
 * The key is likely derived from the User-Agent.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

// Base64URL decode
function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

// Individual operations from the obfuscated code
const xor131 = b => b ^ 131;
const add131 = b => (b + 131) % 256;
const sub131 = b => (b - 131 + 256) % 256;
const add48 = b => (b + 48) % 256;
const sub48 = b => (b - 48 + 256) % 256;
const rotL2 = b => ((b << 2) | (b >>> 6)) & 0xFF;
const rotR2 = b => ((b >>> 2) | (b << 6)) & 0xFF;
const rotL3 = b => ((b << 3) | (b >>> 5)) & 0xFF;
const rotR3 = b => ((b >>> 3) | (b << 5)) & 0xFF;
const rotL4 = b => ((b << 4) | (b >>> 4)) & 0xFF;
const rotR4 = b => ((b >>> 4) | (b << 4)) & 0xFF;
const rotL5 = b => ((b << 5) | (b >>> 3)) & 0xFF;
const rotR5 = b => ((b >>> 5) | (b << 3)) & 0xFF;

// The decryption likely uses a combination based on byte position
// Let me analyze the pattern more carefully

async function main() {
  // Fetch fresh page data
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  const pageData = pageDataMatch[1];
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  const ua = uaMatch[1];
  
  console.log('PAGE_DATA:', pageData);
  console.log('UA:', ua);
  console.log('');
  
  const decoded = b64UrlDecode(pageData);
  const bytes = Array.from(decoded);
  
  console.log('Decoded length:', bytes.length);
  console.log('First 10 bytes:', bytes.slice(0, 10));
  console.log('');
  
  // The expected output is JSON starting with {"file":"https://...
  // { = 123, " = 34, f = 102, i = 105, l = 108, e = 101
  const expected = [123, 34, 102, 105, 108, 101, 34, 58, 34, 104]; // {"file":"h
  
  console.log('Expected first 10:', expected);
  console.log('');
  
  // For each position, find what operation transforms input to expected
  console.log('=== Analyzing byte transformations ===\n');
  
  for (let i = 0; i < Math.min(10, bytes.length); i++) {
    const input = bytes[i];
    const target = expected[i];
    const uaByte = ua.charCodeAt(i % ua.length);
    
    console.log(`Byte ${i}: input=${input}, target=${target}, ua[${i}]=${uaByte} ('${ua[i]}')`);
    
    // Try all single operations
    const ops = [
      ['xor131', xor131(input)],
      ['add131', add131(input)],
      ['sub131', sub131(input)],
      ['add48', add48(input)],
      ['sub48', sub48(input)],
      ['rotL2', rotL2(input)],
      ['rotR2', rotR2(input)],
      ['rotL3', rotL3(input)],
      ['rotR3', rotR3(input)],
      ['rotL4', rotL4(input)],
      ['rotR4', rotR4(input)],
      ['rotL5', rotL5(input)],
      ['rotR5', rotR5(input)],
      ['xor_ua', input ^ uaByte],
      ['xor131_xor_ua', xor131(input) ^ uaByte],
      ['xor_ua_xor131', xor131(input ^ uaByte)],
      ['sub131_xor_ua', sub131(input) ^ uaByte],
      ['xor_ua_sub131', sub131(input ^ uaByte)],
      ['rotR3_xor131', xor131(rotR3(input))],
      ['xor131_rotR3', rotR3(xor131(input))],
      ['rotR5_sub131', sub131(rotR5(input))],
      ['sub131_rotR5', rotR5(sub131(input))],
    ];
    
    for (const [name, result] of ops) {
      if (result === target) {
        console.log(`  ✓ ${name} = ${result}`);
      }
    }
    
    // Try with index-based operations
    const idxOps = [
      ['xor_idx', input ^ i],
      ['xor_idx_131', input ^ i ^ 131],
      ['sub_idx', (input - i + 256) % 256],
      ['add_idx', (input + i) % 256],
    ];
    
    for (const [name, result] of idxOps) {
      if (result === target) {
        console.log(`  ✓ ${name} = ${result}`);
      }
    }
    
    console.log('');
  }
  
  // Now let's try to find a pattern
  console.log('=== Trying systematic combinations ===\n');
  
  // The algorithm might use different operations based on position modulo something
  // Or it might be a simple RC4-like stream cipher
  
  // Let me try: each byte is XOR'd with a keystream derived from UA
  // Common pattern: RC4 or simple XOR with transformed UA
  
  // Try MD5-like mixing of UA to create keystream
  function simpleHash(str, len) {
    const result = [];
    let h = 0;
    for (let i = 0; i < len; i++) {
      h = (h * 31 + str.charCodeAt(i % str.length)) & 0xFF;
      result.push(h);
    }
    return result;
  }
  
  const keystream = simpleHash(ua, bytes.length);
  let result = bytes.map((b, i) => b ^ keystream[i]);
  console.log('Simple hash XOR:', String.fromCharCode(...result).substring(0, 50));
  
  // Try: XOR with UA, then apply fixed transform
  result = bytes.map((b, i) => {
    let x = b ^ ua.charCodeAt(i % ua.length);
    x = sub131(x);
    return x;
  });
  console.log('XOR UA + sub131:', String.fromCharCode(...result).substring(0, 50));
  
  // Try: Apply fixed transform, then XOR with UA
  result = bytes.map((b, i) => {
    let x = sub131(b);
    x ^= ua.charCodeAt(i % ua.length);
    return x;
  });
  console.log('sub131 + XOR UA:', String.fromCharCode(...result).substring(0, 50));
  
  // Try: Rotate then XOR
  result = bytes.map((b, i) => {
    let x = rotR3(b);
    x ^= ua.charCodeAt(i % ua.length);
    return x;
  });
  console.log('rotR3 + XOR UA:', String.fromCharCode(...result).substring(0, 50));
  
  // Try: XOR then rotate
  result = bytes.map((b, i) => {
    let x = b ^ ua.charCodeAt(i % ua.length);
    x = rotR3(x);
    return x;
  });
  console.log('XOR UA + rotR3:', String.fromCharCode(...result).substring(0, 50));
  
  // The key insight from the obfuscated code:
  // There's a chain of functions that each apply a transformation
  // Let me try the exact sequence from line 7536:
  // o2 -> n2 -> K -> v2 -> S -> b2 -> Q -> t2 -> H -> c2 -> h -> m
  
  // Each of these likely applies one of the byte operations
  // Based on the constants found (131, 48, rotations), let me try:
  
  console.log('\n=== Trying specific sequences ===\n');
  
  // Sequence based on the obfuscated code patterns
  const sequences = [
    [rotR5, sub131, xor131],
    [xor131, sub131, rotR5],
    [sub131, xor131, rotR5],
    [rotR3, xor131, sub131],
    [xor131, rotR3, sub131],
    [sub131, rotR3, xor131],
    [rotR5, xor131],
    [xor131, rotR5],
    [rotR3, sub131],
    [sub131, rotR3],
  ];
  
  for (const seq of sequences) {
    result = bytes.map(b => {
      let x = b;
      for (const op of seq) {
        x = op(x);
      }
      return x;
    });
    const str = String.fromCharCode(...result);
    if (str[0] === '{' || str.includes('http')) {
      console.log(`✓ [${seq.map(f => f.name).join(', ')}]:`, str.substring(0, 80));
    }
  }
  
  // Try with UA XOR at different positions in the chain
  for (const seq of sequences) {
    // UA XOR first
    result = bytes.map((b, i) => {
      let x = b ^ ua.charCodeAt(i % ua.length);
      for (const op of seq) {
        x = op(x);
      }
      return x;
    });
    let str = String.fromCharCode(...result);
    if (str[0] === '{' || str.includes('http')) {
      console.log(`✓ UA_XOR + [${seq.map(f => f.name).join(', ')}]:`, str.substring(0, 80));
    }
    
    // UA XOR last
    result = bytes.map((b, i) => {
      let x = b;
      for (const op of seq) {
        x = op(x);
      }
      return x ^ ua.charCodeAt(i % ua.length);
    });
    str = String.fromCharCode(...result);
    if (str[0] === '{' || str.includes('http')) {
      console.log(`✓ [${seq.map(f => f.name).join(', ')}] + UA_XOR:`, str.substring(0, 80));
    }
  }
}

main().catch(console.error);
