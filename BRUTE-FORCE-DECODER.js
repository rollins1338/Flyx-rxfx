/**
 * BRUTE FORCE ALL POSSIBLE COMBINATIONS
 * Try every possible transformation combination
 */

const fs = require('fs');
const zlib = require('zlib');

const divContent = fs.readFileSync('hidden-div-content.txt', 'utf8');
const divId = fs.readFileSync('hidden-div-id.txt', 'utf8').trim();

console.log('🔥 BRUTE FORCE DECODER\n');
console.log('Div ID:', divId);
console.log('Content length:', divContent.length);

let successCount = 0;

// Character substitution mappings to try
const substitutions = [
  { name: 'None', fn: (s) => s },
  { name: '= → A', fn: (s) => s.replace(/=/g, 'A') },
  { name: '= → +', fn: (s) => s.replace(/=/g, '+') },
  { name: '= → /', fn: (s) => s.replace(/=/g, '/') },
  { name: '. → +, _ → /', fn: (s) => s.replace(/\./g, '+').replace(/_/g, '/') },
  { name: '- → +, _ → /', fn: (s) => s.replace(/-/g, '+').replace(/_/g, '/') },
];

// Transformation steps
const transforms = [
  { name: 'None', fn: (s) => s },
  { name: 'Reverse', fn: (s) => s.split('').reverse().join('') },
];

// Decoding methods
const decoders = [
  { 
    name: 'Base64', 
    fn: (s) => Buffer.from(s, 'base64').toString('utf8')
  },
  { 
    name: 'Base64 + Gzip', 
    fn: (s) => {
      const b64 = Buffer.from(s, 'base64');
      return zlib.gunzipSync(b64).toString('utf8');
    }
  },
  { 
    name: 'Base64 + Inflate', 
    fn: (s) => {
      const b64 = Buffer.from(s, 'base64');
      return zlib.inflateSync(b64).toString('utf8');
    }
  },
  { 
    name: 'Base64 + InflateRaw', 
    fn: (s) => {
      const b64 = Buffer.from(s, 'base64');
      return zlib.inflateRawSync(b64).toString('utf8');
    }
  },
  { 
    name: 'Base64 + XOR', 
    fn: (s) => {
      const b64 = Buffer.from(s, 'base64');
      const xored = Buffer.alloc(b64.length);
      for (let i = 0; i < b64.length; i++) {
        xored[i] = b64[i] ^ divId.charCodeAt(i % divId.length);
      }
      return xored.toString('utf8');
    }
  },
  { 
    name: 'Base64 + XOR + Gzip', 
    fn: (s) => {
      const b64 = Buffer.from(s, 'base64');
      const xored = Buffer.alloc(b64.length);
      for (let i = 0; i < b64.length; i++) {
        xored[i] = b64[i] ^ divId.charCodeAt(i % divId.length);
      }
      return zlib.gunzipSync(xored).toString('utf8');
    }
  },
];

console.log('Testing combinations...\n');

let testCount = 0;
for (const sub of substitutions) {
  for (const transform of transforms) {
    for (const decoder of decoders) {
      testCount++;
      
      try {
        // Apply transformations
        let data = divContent;
        data = sub.fn(data);
        data = transform.fn(data);
        const result = decoder.fn(data);
        
        // Check if result contains URL
        if (result && (result.includes('http://') || result.includes('https://') || result.includes('.m3u8'))) {
          successCount++;
          console.log(`\n🎯 SUCCESS #${successCount}!`);
          console.log(`Combination: ${sub.name} → ${transform.name} → ${decoder.name}`);
          console.log(`Result: ${result}`);
          console.log(`Length: ${result.length}`);
          
          // Save the result
          fs.writeFileSync(`DECODED-${successCount}.txt`, result);
          fs.writeFileSync(`DECODED-${successCount}-method.txt`, 
            `Substitution: ${sub.name}\nTransform: ${transform.name}\nDecoder: ${decoder.name}`
          );
        }
      } catch (e) {
        // Silent fail, try next combination
      }
      
      // Progress indicator
      if (testCount % 10 === 0) {
        process.stdout.write(`\rTested: ${testCount} combinations...`);
      }
    }
  }
}

console.log(`\n\n✅ Complete! Tested ${testCount} combinations.`);
console.log(`🎯 Found ${successCount} successful decodings.`);

if (successCount === 0) {
  console.log('\n❌ No successful decodings found.');
  console.log('The encoding might use:');
  console.log('  - Custom character mapping');
  console.log('  - Multiple XOR keys');
  console.log('  - Custom compression algorithm');
  console.log('  - Encryption requiring a key from the decoder script');
}
