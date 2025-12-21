/**
 * Deep XOR Constant Analysis
 * 
 * We have confirmed:
 * - Timestamp: 1700000000
 * - FP Hash: 54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e
 * - Key: 48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2
 * - XOR: 1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc
 * 
 * The XOR constant must be derived from something. Let's try everything.
 */

const crypto = require('crypto');

const data = {
  timestamp: 1700000000,
  fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
  key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
  xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  canvas50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  sessionId: '1700000000.5000000',
};

const xorBuf = Buffer.from(data.xor, 'hex');
const fpHashBuf = Buffer.from(data.fpHash, 'hex');
const keyBuf = Buffer.from(data.key, 'hex');

console.log('=== Deep XOR Constant Analysis ===\n');
console.log('Target XOR:', data.xor);
console.log('');

// Try all possible combinations of inputs
const inputs = {
  timestamp: String(data.timestamp),
  timestampMs: String(data.timestamp * 1000),
  sessionId: data.sessionId,
  random: '5000000',
  fpString: data.fpString,
  fpHash: data.fpHash,
  canvas50: data.canvas50,
  key: data.key,
  
  // Parts of fpString
  colorDepth: '24',
  userAgent50: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb',
  platform: 'Win32',
  language: 'en-US',
  timezone: '0',
  
  // Static strings that might be used
  tmdb: 'tmdb',
  flixer: 'flixer',
  hexa: 'hexa',
  img_data: 'img_data',
  session: 'session',
  key_str: 'key',
  
  // Combinations
  ts_canvas: data.timestamp + data.canvas50,
  canvas_ts: data.canvas50 + String(data.timestamp),
  fpHash_ts: data.fpHash + String(data.timestamp),
  ts_fpHash: String(data.timestamp) + data.fpHash,
};

// Binary representations of timestamp
const tsBufs = {
  ts4LE: (() => { const b = Buffer.alloc(4); b.writeUInt32LE(data.timestamp); return b; })(),
  ts4BE: (() => { const b = Buffer.alloc(4); b.writeUInt32BE(data.timestamp); return b; })(),
  ts8LE: (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(data.timestamp)); return b; })(),
  ts8BE: (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(data.timestamp)); return b; })(),
};

console.log('=== Testing SHA256 of various inputs ===\n');

for (const [name, input] of Object.entries(inputs)) {
  const hash = crypto.createHash('sha256').update(input).digest();
  if (hash.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256(${name}) ***`);
  }
}

for (const [name, buf] of Object.entries(tsBufs)) {
  const hash = crypto.createHash('sha256').update(buf).digest();
  if (hash.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256(${name}) ***`);
  }
}

console.log('=== Testing HMAC with various key/message combinations ===\n');

const hmacKeys = [
  { name: 'timestamp', key: inputs.timestamp },
  { name: 'fpHash', key: data.fpHash },
  { name: 'fpHashBuf', key: fpHashBuf },
  { name: 'canvas50', key: data.canvas50 },
  { name: 'sessionId', key: data.sessionId },
  { name: 'fpString', key: data.fpString },
  { name: 'ts4LE', key: tsBufs.ts4LE },
  { name: 'ts4BE', key: tsBufs.ts4BE },
];

const hmacMessages = [
  { name: 'timestamp', msg: inputs.timestamp },
  { name: 'fpHash', msg: data.fpHash },
  { name: 'fpHashBuf', msg: fpHashBuf },
  { name: 'canvas50', msg: data.canvas50 },
  { name: 'sessionId', msg: data.sessionId },
  { name: 'fpString', msg: data.fpString },
  { name: 'ts4LE', msg: tsBufs.ts4LE },
  { name: 'ts4BE', msg: tsBufs.ts4BE },
  { name: 'empty', msg: '' },
];

for (const { name: keyName, key } of hmacKeys) {
  for (const { name: msgName, msg } of hmacMessages) {
    if (keyName === msgName) continue;
    try {
      const hmac = crypto.createHmac('sha256', key).update(msg).digest();
      if (hmac.equals(xorBuf)) {
        console.log(`*** MATCH: HMAC(${keyName}, ${msgName}) ***`);
      }
    } catch (e) {}
  }
}

console.log('=== Testing double SHA256 ===\n');

for (const [name, input] of Object.entries(inputs)) {
  const hash1 = crypto.createHash('sha256').update(input).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  if (hash2.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256(SHA256(${name})) ***`);
  }
}

console.log('=== Testing SHA256 of concatenations ===\n');

const concatPairs = [
  ['timestamp', 'fpHash'],
  ['fpHash', 'timestamp'],
  ['timestamp', 'canvas50'],
  ['canvas50', 'timestamp'],
  ['fpHash', 'canvas50'],
  ['canvas50', 'fpHash'],
  ['sessionId', 'fpHash'],
  ['fpHash', 'sessionId'],
  ['timestamp', 'fpString'],
  ['fpString', 'timestamp'],
];

for (const [a, b] of concatPairs) {
  const concat = inputs[a] + inputs[b];
  const hash = crypto.createHash('sha256').update(concat).digest();
  if (hash.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256(${a} + ${b}) ***`);
  }
}

// Try with binary timestamp
for (const [tsName, tsBuf] of Object.entries(tsBufs)) {
  for (const [name, input] of Object.entries(inputs)) {
    // ts || input
    const concat1 = Buffer.concat([tsBuf, Buffer.from(input)]);
    const hash1 = crypto.createHash('sha256').update(concat1).digest();
    if (hash1.equals(xorBuf)) {
      console.log(`*** MATCH: SHA256(${tsName} || ${name}) ***`);
    }
    
    // input || ts
    const concat2 = Buffer.concat([Buffer.from(input), tsBuf]);
    const hash2 = crypto.createHash('sha256').update(concat2).digest();
    if (hash2.equals(xorBuf)) {
      console.log(`*** MATCH: SHA256(${name} || ${tsName}) ***`);
    }
  }
}

console.log('=== Testing HKDF ===\n');

const hkdfSalts = ['', data.timestamp, data.canvas50, data.fpHash, data.sessionId];
const hkdfInfos = ['', 'key', 'xor', 'derive', data.timestamp, data.canvas50];

for (const salt of hkdfSalts) {
  for (const info of hkdfInfos) {
    for (const [name, input] of Object.entries(inputs)) {
      try {
        const derived = Buffer.from(crypto.hkdfSync('sha256', input, salt, info, 32));
        if (derived.equals(xorBuf)) {
          console.log(`*** MATCH: HKDF(${name}, salt="${salt.slice(0,20)}", info="${info}") ***`);
        }
      } catch (e) {}
    }
  }
}

console.log('=== Testing XOR of two hashes ===\n');

for (const [name1, input1] of Object.entries(inputs)) {
  for (const [name2, input2] of Object.entries(inputs)) {
    if (name1 >= name2) continue;
    
    const hash1 = crypto.createHash('sha256').update(input1).digest();
    const hash2 = crypto.createHash('sha256').update(input2).digest();
    
    const xored = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xored[i] = hash1[i] ^ hash2[i];
    }
    
    if (xored.equals(xorBuf)) {
      console.log(`*** MATCH: SHA256(${name1}) XOR SHA256(${name2}) ***`);
    }
  }
}

console.log('=== Testing PBKDF2 ===\n');

const pbkdf2Iterations = [1, 10, 100, 1000];

for (const iterations of pbkdf2Iterations) {
  for (const [passName, password] of Object.entries(inputs)) {
    for (const [saltName, salt] of Object.entries(inputs)) {
      if (passName === saltName) continue;
      try {
        const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
        if (derived.equals(xorBuf)) {
          console.log(`*** MATCH: PBKDF2(${passName}, ${saltName}, ${iterations}) ***`);
        }
      } catch (e) {}
    }
  }
}

console.log('=== Testing with fpHash as key material ===\n');

// Maybe the XOR constant is derived from fpHash in some way
const fpHashBytes = Buffer.from(data.fpHash, 'hex');

// Try rotating fpHash
for (let shift = 1; shift < 32; shift++) {
  const rotated = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    rotated[i] = fpHashBytes[(i + shift) % 32];
  }
  if (rotated.equals(xorBuf)) {
    console.log(`*** MATCH: rotate(fpHash, ${shift}) ***`);
  }
}

// Try XOR with constants
for (let c = 0; c < 256; c++) {
  const xored = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xored[i] = fpHashBytes[i] ^ c;
  }
  if (xored.equals(xorBuf)) {
    console.log(`*** MATCH: fpHash XOR ${c} ***`);
  }
}

// Try XOR with position
const xorWithPos = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorWithPos[i] = fpHashBytes[i] ^ i;
}
if (xorWithPos.equals(xorBuf)) {
  console.log('*** MATCH: fpHash XOR position ***');
}

console.log('\n=== Summary ===');
console.log('No standard derivation found.');
console.log('The XOR constant is likely derived using a custom algorithm in the WASM.');
