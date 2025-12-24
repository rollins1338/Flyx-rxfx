/**
 * Compare decryption of two videos
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const keystream = Buffer.from(KEYSTREAM_HEX, 'hex');

// Working video ID
const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
// Failing video ID  
const failingVideoId = 'js_JTDu8WS2JcOLzF79M6RvpCQ';

async function fetchAndDecrypt(videoId) {
  const mediaUrl = `https://megaup22.online/media/${videoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl);
  const data = await response.json();
  
  if (!data.result) return null;
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  const decLength = Math.min(keystream.length, encBytes.length);
  const decBytes = Buffer.alloc(decLength);
  for (let i = 0; i < decLength; i++) {
    decBytes[i] = encBytes[i] ^ keystream[i];
  }
  
  return {
    encBytes,
    decrypted: decBytes.toString('utf8'),
    decBytes
  };
}

async function compare() {
  console.log('=== Comparing decryption ===\n');
  
  const working = await fetchAndDecrypt(workingVideoId);
  const failing = await fetchAndDecrypt(failingVideoId);
  
  console.log('Working video decrypted (first 150):');
  console.log(working.decrypted.substring(0, 150));
  
  console.log('\nFailing video decrypted (first 150):');
  console.log(failing.decrypted.substring(0, 150));
  
  // Find where they diverge
  let divergePos = -1;
  for (let i = 0; i < Math.min(working.decrypted.length, failing.decrypted.length); i++) {
    if (working.decrypted[i] !== failing.decrypted[i]) {
      divergePos = i;
      break;
    }
  }
  
  console.log(`\nDiverge position: ${divergePos}`);
  
  if (divergePos >= 0) {
    console.log(`Working at ${divergePos}: "${working.decrypted.substring(divergePos, divergePos + 20)}"`);
    console.log(`Failing at ${divergePos}: "${failing.decrypted.substring(divergePos, divergePos + 20)}"`);
    
    // Check encrypted bytes at that position
    console.log(`\nEncrypted byte at ${divergePos}:`);
    console.log(`  Working: 0x${working.encBytes[divergePos].toString(16)}`);
    console.log(`  Failing: 0x${failing.encBytes[divergePos].toString(16)}`);
    console.log(`  Keystream: 0x${keystream[divergePos].toString(16)}`);
    
    // What would the failing plaintext byte be?
    const failingPlain = failing.encBytes[divergePos] ^ keystream[divergePos];
    const workingPlain = working.encBytes[divergePos] ^ keystream[divergePos];
    console.log(`  Working plaintext: '${String.fromCharCode(workingPlain)}' (0x${workingPlain.toString(16)})`);
    console.log(`  Failing plaintext: '${String.fromCharCode(failingPlain)}' (0x${failingPlain.toString(16)})`);
  }
}

compare().catch(console.error);
