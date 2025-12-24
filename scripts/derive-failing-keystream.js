/**
 * Derive keystream for failing video
 * 
 * We know the URL structure should be:
 * https://rrr.lab27core.site/pz78/c5/h<128-hex-chars>/list,<base64>.m3u8
 * 
 * The first 100 chars of plaintext are:
 * {"sources":[{"file":"https://rrr.lab27core.site/pz78/c5/h6a90f70b8d237f94866b6cfc2c7f06afdb8423c6639
 * 
 * At position 100, we expect a hex char (0-9, a-f)
 * The failing video decrypts to 'a' at position 100, which IS valid hex!
 * 
 * Let's check positions 101-105 more carefully
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const keystream = Buffer.from(KEYSTREAM_HEX, 'hex');

const failingVideoId = 'js_JTDu8WS2JcOLzF79M6RvpCQ';

async function main() {
  const mediaUrl = `https://megaup22.online/media/${failingVideoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl);
  const data = await response.json();
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  console.log('=== Analyzing failing video ===\n');
  
  // Decrypt with current keystream
  const decLength = Math.min(keystream.length, encBytes.length);
  const decBytes = Buffer.alloc(decLength);
  for (let i = 0; i < decLength; i++) {
    decBytes[i] = encBytes[i] ^ keystream[i];
  }
  
  // Show decrypted around position 100-120
  console.log('Decrypted positions 95-120:');
  for (let i = 95; i < 120; i++) {
    const dec = decBytes[i];
    const char = dec >= 32 && dec < 127 ? String.fromCharCode(dec) : `\\x${dec.toString(16).padStart(2,'0')}`;
    process.stdout.write(char);
  }
  console.log('\n');
  
  // The decrypted shows: c6639aCn3b...
  // Position 100 = 'a' (valid hex)
  // Position 101 = 'C' (NOT valid hex - should be lowercase)
  // Position 102 = 'n' (NOT valid hex)
  // Position 103 = '3' (valid hex)
  // Position 104 = 'b' (valid hex)
  // Position 105 = 0x87 (NOT valid ASCII)
  
  // If the keystream were correct, positions 101, 102, 105 should decrypt to hex chars
  // Let's see what keystream bytes would give us valid hex
  
  console.log('=== Deriving correct keystream for positions 101-110 ===\n');
  
  // Assume the plaintext should be hex chars (0-9, a-f)
  // For each position, calculate what keystream byte would give a valid hex char
  
  for (let i = 101; i < 110; i++) {
    const enc = encBytes[i];
    const currentKey = keystream[i];
    const currentDec = enc ^ currentKey;
    
    console.log(`Position ${i}:`);
    console.log(`  Encrypted: 0x${enc.toString(16).padStart(2,'0')}`);
    console.log(`  Current keystream: 0x${currentKey.toString(16).padStart(2,'0')}`);
    console.log(`  Current decrypted: 0x${currentDec.toString(16).padStart(2,'0')} = '${currentDec >= 32 && currentDec < 127 ? String.fromCharCode(currentDec) : '?'}'`);
    
    // What keystream would give us '0'-'9' or 'a'-'f'?
    const validHex = '0123456789abcdef';
    const possibleKeys = [];
    for (const h of validHex) {
      const key = enc ^ h.charCodeAt(0);
      possibleKeys.push({ char: h, key: key });
    }
    console.log(`  Possible keystream bytes for valid hex: ${possibleKeys.map(p => `${p.char}:0x${p.key.toString(16)}`).join(', ')}`);
    console.log();
  }
}

main().catch(console.error);
