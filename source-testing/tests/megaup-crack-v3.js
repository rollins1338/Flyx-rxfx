/**
 * MegaUp Decryption - Found the pattern!
 * 
 * Byte 0: rotR5 then sub131 gives us '{'
 * Let me verify this works for all bytes
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

// Operations
const xor131 = b => b ^ 131;
const sub131 = b => (b - 131 + 256) % 256;
const add131 = b => (b + 131) % 256;
const rotL5 = b => ((b << 5) | (b >>> 3)) & 0xFF;
const rotR5 = b => ((b >>> 5) | (b << 3)) & 0xFF;
const rotL3 = b => ((b << 3) | (b >>> 5)) & 0xFF;
const rotR3 = b => ((b >>> 3) | (b << 5)) & 0xFF;

async function main() {
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  const pageData = pageDataMatch[1];
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  const ua = uaMatch[1];
  
  const decoded = b64UrlDecode(pageData);
  const bytes = Array.from(decoded);
  
  console.log('Testing rotR5 + sub131...');
  let result = bytes.map(b => sub131(rotR5(b)));
  console.log('Result:', String.fromCharCode(...result));
  console.log('');
  
  // That didn't work for all bytes. Let me find what works for each byte
  console.log('Finding operation for each byte position...\n');
  
  const expected = '{"file":"https://';
  const expectedBytes = expected.split('').map(c => c.charCodeAt(0));
  
  // All possible single and double operations
  const singleOps = [
    ['identity', b => b],
    ['xor131', xor131],
    ['sub131', sub131],
    ['add131', add131],
    ['rotL5', rotL5],
    ['rotR5', rotR5],
    ['rotL3', rotL3],
    ['rotR3', rotR3],
  ];
  
  const doubleOps = [];
  for (const [n1, o1] of singleOps) {
    for (const [n2, o2] of singleOps) {
      doubleOps.push([`${n1}_${n2}`, b => o2(o1(b))]);
    }
  }
  
  const tripleOps = [];
  for (const [n1, o1] of singleOps) {
    for (const [n2, o2] of singleOps) {
      for (const [n3, o3] of singleOps) {
        tripleOps.push([`${n1}_${n2}_${n3}`, b => o3(o2(o1(b)))]);
      }
    }
  }
  
  // For each byte position, find what operation works
  const foundOps = [];
  
  for (let i = 0; i < Math.min(expectedBytes.length, bytes.length); i++) {
    const input = bytes[i];
    const target = expectedBytes[i];
    let found = false;
    
    // Try single ops
    for (const [name, op] of singleOps) {
      if (op(input) === target) {
        foundOps.push({ pos: i, op: name, input, target });
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Try double ops
      for (const [name, op] of doubleOps) {
        if (op(input) === target) {
          foundOps.push({ pos: i, op: name, input, target });
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      // Try triple ops
      for (const [name, op] of tripleOps) {
        if (op(input) === target) {
          foundOps.push({ pos: i, op: name, input, target });
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      // Try with UA XOR
      const uaByte = ua.charCodeAt(i % ua.length);
      for (const [name, op] of singleOps) {
        if ((op(input) ^ uaByte) === target) {
          foundOps.push({ pos: i, op: `${name}_xorUA`, input, target, uaByte });
          found = true;
          break;
        }
        if (op(input ^ uaByte) === target) {
          foundOps.push({ pos: i, op: `xorUA_${name}`, input, target, uaByte });
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      foundOps.push({ pos: i, op: 'NOT_FOUND', input, target });
    }
  }
  
  console.log('Found operations:');
  foundOps.forEach(f => {
    console.log(`  Pos ${f.pos}: ${f.op} (${f.input} -> ${f.target})`);
  });
  
  // Look for a pattern in the operations
  console.log('\n=== Looking for pattern ===\n');
  
  const opCounts = {};
  foundOps.forEach(f => {
    opCounts[f.op] = (opCounts[f.op] || 0) + 1;
  });
  console.log('Operation frequency:', opCounts);
  
  // Check if there's a position-based pattern
  console.log('\nPosition mod patterns:');
  for (let mod = 2; mod <= 8; mod++) {
    const byMod = {};
    foundOps.forEach(f => {
      const key = f.pos % mod;
      if (!byMod[key]) byMod[key] = [];
      byMod[key].push(f.op);
    });
    
    let consistent = true;
    for (const [key, ops] of Object.entries(byMod)) {
      const unique = [...new Set(ops)];
      if (unique.length > 1) consistent = false;
    }
    
    if (consistent) {
      console.log(`  mod ${mod}: CONSISTENT!`, byMod);
    }
  }
}

main().catch(console.error);
