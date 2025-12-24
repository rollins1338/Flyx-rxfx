/**
 * Derive the current keystream from a known plaintext prefix
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

// Known plaintext prefix - MegaUp responses always start with this
const KNOWN_PREFIX = '{"sources":[{"file":"https://';

// Old keystream
const OLD_KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const oldKeystream = Buffer.from(OLD_KEYSTREAM_HEX, 'hex');

// The NEW video ID from the failing test
const newVideoId = 'js_JTDu8WS2JcOLzF79M6RvpCQ';
const mediaUrl = `https://megaup22.online/media/${newVideoId}`;

async function deriveKeystream() {
  console.log('=== Deriving current keystream ===\n');
  
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl);
  const data = await response.json();
  
  if (!data.result) {
    console.log('No result');
    return;
  }
  
  // Decode encrypted bytes
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  console.log('Encrypted bytes:', encBytes.length);
  console.log('Known prefix:', KNOWN_PREFIX);
  console.log('Known prefix length:', KNOWN_PREFIX.length);
  
  // Derive keystream from known prefix
  const derivedKeystream = Buffer.alloc(KNOWN_PREFIX.length);
  for (let i = 0; i < KNOWN_PREFIX.length; i++) {
    derivedKeystream[i] = encBytes[i] ^ KNOWN_PREFIX.charCodeAt(i);
  }
  
  console.log('\nDerived keystream (first 30 bytes):');
  console.log(derivedKeystream.toString('hex'));
  
  console.log('\nOld keystream (first 30 bytes):');
  console.log(oldKeystream.slice(0, 30).toString('hex'));
  
  // Compare
  let matchCount = 0;
  for (let i = 0; i < KNOWN_PREFIX.length; i++) {
    if (derivedKeystream[i] === oldKeystream[i]) {
      matchCount++;
    } else {
      console.log(`Mismatch at position ${i}: derived=${derivedKeystream[i].toString(16)} old=${oldKeystream[i].toString(16)}`);
    }
  }
  
  console.log(`\nMatching bytes: ${matchCount}/${KNOWN_PREFIX.length}`);
  
  if (matchCount === KNOWN_PREFIX.length) {
    console.log('✓ Keystreams match! The issue is elsewhere.');
  } else {
    console.log('✗ Keystreams DIFFER! MegaUp changed their encryption.');
  }
}

deriveKeystream().catch(console.error);
