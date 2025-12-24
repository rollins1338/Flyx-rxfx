/**
 * Derive keystream for the failing video by using known structure
 * 
 * We know the JSON structure is:
 * {"sources":[{"file":"https://rrr.lab27core.site/pz78/...
 * 
 * And it should end with:
 * ...m3u8"}],"tracks":[{"file":"...","kind":"captions"...}]}
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const OLD_KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const oldKeystream = Buffer.from(OLD_KEYSTREAM_HEX, 'hex');

// Both video IDs
const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
const failingVideoId = 'js_JTDu8WS2JcOLzF79M6RvpCQ';

async function getEncrypted(videoId) {
  const mediaUrl = `https://megaup22.online/media/${videoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl);
  const data = await response.json();
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

async function main() {
  console.log('=== Comparing encrypted data ===\n');
  
  const workingEnc = await getEncrypted(workingVideoId);
  const failingEnc = await getEncrypted(failingVideoId);
  
  console.log('Working encrypted length:', workingEnc.length);
  console.log('Failing encrypted length:', failingEnc.length);
  
  // Compare first 100 bytes of encrypted data
  console.log('\n=== First 30 bytes of encrypted data ===');
  console.log('Working:', workingEnc.slice(0, 30).toString('hex'));
  console.log('Failing:', failingEnc.slice(0, 30).toString('hex'));
  
  // If the keystream is the same, and the plaintext starts the same,
  // then the encrypted data should start the same
  // Let's check if they match
  
  let matchCount = 0;
  for (let i = 0; i < Math.min(workingEnc.length, failingEnc.length, 100); i++) {
    if (workingEnc[i] === failingEnc[i]) {
      matchCount++;
    }
  }
  console.log(`\nMatching encrypted bytes in first 100: ${matchCount}/100`);
  
  // The plaintext starts with {"sources":[{"file":"https://rrr.lab27core.site/pz78/c5/h
  // That's 60 chars that should be identical
  // If encrypted bytes differ, it means either:
  // 1. Keystream is different
  // 2. Plaintext is different
  
  // Let's XOR the two encrypted streams to see the XOR of plaintexts
  console.log('\n=== XOR of encrypted data (reveals XOR of plaintexts if keystream same) ===');
  const xorResult = Buffer.alloc(100);
  for (let i = 0; i < 100; i++) {
    xorResult[i] = workingEnc[i] ^ failingEnc[i];
  }
  console.log('XOR result (first 100 bytes):');
  console.log(xorResult.toString('hex'));
  
  // If keystream is same and plaintext is same, XOR should be all zeros
  const zeroCount = xorResult.filter(b => b === 0).length;
  console.log(`Zero bytes: ${zeroCount}/100`);
  
  if (zeroCount === 100) {
    console.log('✓ First 100 bytes are identical - keystream and plaintext match');
  } else {
    console.log('✗ Encrypted data differs - either keystream or plaintext is different');
    
    // Find first difference
    for (let i = 0; i < 100; i++) {
      if (xorResult[i] !== 0) {
        console.log(`First difference at position ${i}`);
        console.log(`  Working enc: 0x${workingEnc[i].toString(16)}`);
        console.log(`  Failing enc: 0x${failingEnc[i].toString(16)}`);
        console.log(`  XOR: 0x${xorResult[i].toString(16)} = '${String.fromCharCode(xorResult[i])}'`);
        break;
      }
    }
  }
}

main().catch(console.error);
