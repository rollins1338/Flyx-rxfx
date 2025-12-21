/**
 * Analyze Hexa Encryption - Collect samples to reverse engineer the algorithm
 */

const crypto = require('crypto');

async function analyzeEncryption() {
  console.log('=== Analyzing Hexa Encryption ===\n');
  
  const samples = [];
  
  // Collect multiple samples with different keys
  for (let i = 0; i < 3; i++) {
    const key = crypto.randomBytes(32).toString('hex');
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/plain',
      'X-Api-Key': key,
    };
    
    // Fetch encrypted data
    const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
    const encResponse = await fetch(url, { headers });
    const encrypted = await encResponse.text();
    
    // Decrypt using enc-dec.app
    const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: encrypted, key }),
    });
    
    const decResult = await decResponse.json();
    
    samples.push({
      key,
      encrypted,
      decrypted: decResult.result,
    });
    
    console.log(`Sample ${i + 1}:`);
    console.log(`  Key: ${key}`);
    console.log(`  Encrypted length: ${encrypted.length}`);
    console.log(`  Decrypted length: ${decResult.result.length}`);
  }
  
  // Analyze the encryption
  console.log('\n=== Analysis ===\n');
  
  // Check if encrypted data is base64
  const sample = samples[0];
  const encBytes = Buffer.from(sample.encrypted, 'base64');
  console.log('Encrypted as base64 bytes:', encBytes.length);
  console.log('First 32 bytes (hex):', encBytes.slice(0, 32).toString('hex'));
  
  // The decrypted data is JSON-like but not valid JSON (uses single quotes)
  // Let's see if we can find patterns
  
  // Try common encryption algorithms
  console.log('\n=== Testing Decryption Algorithms ===\n');
  
  const keyBuf = Buffer.from(sample.key, 'hex');
  
  // Try AES-256-CBC with different IV sources
  const ivSources = [
    { name: 'First 16 bytes', iv: encBytes.slice(0, 16), data: encBytes.slice(16) },
    { name: 'Last 16 bytes', iv: encBytes.slice(-16), data: encBytes.slice(0, -16) },
    { name: 'Zeros', iv: Buffer.alloc(16), data: encBytes },
    { name: 'Key first 16', iv: keyBuf.slice(0, 16), data: encBytes },
  ];
  
  for (const { name, iv, data } of ivSources) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
      decipher.setAutoPadding(true);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      console.log(`AES-256-CBC (${name}): ${decrypted.slice(0, 50).toString('utf8')}`);
    } catch (e) {
      // console.log(`AES-256-CBC (${name}): Failed - ${e.message}`);
    }
  }
  
  // Try AES-256-CTR
  for (const { name, iv, data } of ivSources) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      const decStr = decrypted.toString('utf8');
      if (decStr.includes('source') || decStr.includes('url') || decStr.includes('{')) {
        console.log(`AES-256-CTR (${name}): SUCCESS!`);
        console.log(`  ${decStr.slice(0, 200)}`);
      }
    } catch (e) {
      // console.log(`AES-256-CTR (${name}): Failed - ${e.message}`);
    }
  }
  
  // Try AES-256-GCM
  // GCM typically has: nonce (12 bytes) + ciphertext + tag (16 bytes)
  const gcmConfigs = [
    { name: '12-byte nonce at start, 16-byte tag at end', nonce: encBytes.slice(0, 12), data: encBytes.slice(12, -16), tag: encBytes.slice(-16) },
    { name: '16-byte nonce at start, 16-byte tag at end', nonce: encBytes.slice(0, 16), data: encBytes.slice(16, -16), tag: encBytes.slice(-16) },
  ];
  
  for (const { name, nonce, data, tag } of gcmConfigs) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      const decStr = decrypted.toString('utf8');
      if (decStr.includes('source') || decStr.includes('url') || decStr.includes('{')) {
        console.log(`AES-256-GCM (${name}): SUCCESS!`);
        console.log(`  ${decStr.slice(0, 200)}`);
      }
    } catch (e) {
      // console.log(`AES-256-GCM (${name}): Failed - ${e.message}`);
    }
  }
  
  // Try ChaCha20-Poly1305
  try {
    const nonce = encBytes.slice(0, 12);
    const tag = encBytes.slice(-16);
    const data = encBytes.slice(12, -16);
    
    const decipher = crypto.createDecipheriv('chacha20-poly1305', keyBuf, nonce, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    console.log(`ChaCha20-Poly1305: ${decrypted.slice(0, 100).toString('utf8')}`);
  } catch (e) {
    // console.log(`ChaCha20-Poly1305: Failed - ${e.message}`);
  }
  
  // Output raw data for further analysis
  console.log('\n=== Raw Sample Data ===\n');
  console.log('Key:', sample.key);
  console.log('Encrypted (base64):', sample.encrypted.slice(0, 100));
  console.log('Encrypted bytes (hex):', encBytes.slice(0, 64).toString('hex'));
  console.log('Expected decrypted:', sample.decrypted.slice(0, 200));
  
  return samples;
}

analyzeEncryption().catch(console.error);
