/**
 * Derive keystream for failing video using known JSON structure
 * 
 * We know the response is JSON with structure:
 * {"sources":[{"file":"https://...m3u8"}],"tracks":[...]}
 * 
 * We can derive keystream bytes where we know the plaintext
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const OLD_KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const oldKeystream = Buffer.from(OLD_KEYSTREAM_HEX, 'hex');

// Working video
const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
// Failing video
const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';

async function getEncrypted(videoId) {
  const mediaUrl = `https://megaup22.online/media/${videoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl);
  const data = await response.json();
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

async function main() {
  console.log('=== Comparing keystreams ===\n');
  
  const workingEnc = await getEncrypted(workingVideoId);
  const failingEnc = await getEncrypted(failingVideoId);
  
  // Derive keystream from working video (we know the plaintext)
  // The plaintext starts with: {"sources":[{"file":"https://rrr.lab27core.site/pz78/c5/h
  const knownPrefix = '{"sources":[{"file":"https://rrr.lab27core.site/pz78/c5/h';
  
  console.log('Known prefix length:', knownPrefix.length);
  
  // Derive keystream from working video
  const workingKeystream = Buffer.alloc(knownPrefix.length);
  for (let i = 0; i < knownPrefix.length; i++) {
    workingKeystream[i] = workingEnc[i] ^ knownPrefix.charCodeAt(i);
  }
  
  // Derive keystream from failing video (assuming same prefix)
  const failingKeystream = Buffer.alloc(knownPrefix.length);
  for (let i = 0; i < knownPrefix.length; i++) {
    failingKeystream[i] = failingEnc[i] ^ knownPrefix.charCodeAt(i);
  }
  
  console.log('\nWorking keystream (first 60 bytes):');
  console.log(workingKeystream.toString('hex'));
  
  console.log('\nFailing keystream (first 60 bytes):');
  console.log(failingKeystream.toString('hex'));
  
  console.log('\nOld keystream (first 60 bytes):');
  console.log(oldKeystream.slice(0, 60).toString('hex'));
  
  // Compare
  let workingMatch = 0;
  let failingMatch = 0;
  for (let i = 0; i < knownPrefix.length; i++) {
    if (workingKeystream[i] === oldKeystream[i]) workingMatch++;
    if (failingKeystream[i] === oldKeystream[i]) failingMatch++;
  }
  
  console.log(`\nWorking matches old: ${workingMatch}/${knownPrefix.length}`);
  console.log(`Failing matches old: ${failingMatch}/${knownPrefix.length}`);
  
  // Check if working and failing have same keystream
  let sameKeystream = 0;
  for (let i = 0; i < knownPrefix.length; i++) {
    if (workingKeystream[i] === failingKeystream[i]) sameKeystream++;
  }
  console.log(`Working matches failing: ${sameKeystream}/${knownPrefix.length}`);
  
  // If they're the same, the keystream is consistent
  if (sameKeystream === knownPrefix.length) {
    console.log('\n✓ Keystreams are IDENTICAL for first 60 bytes');
    console.log('The issue is in the URL structure, not the keystream');
  } else {
    console.log('\n✗ Keystreams DIFFER');
    // Find first difference
    for (let i = 0; i < knownPrefix.length; i++) {
      if (workingKeystream[i] !== failingKeystream[i]) {
        console.log(`First difference at position ${i}`);
        console.log(`  Working: 0x${workingKeystream[i].toString(16)}`);
        console.log(`  Failing: 0x${failingKeystream[i].toString(16)}`);
        break;
      }
    }
  }
}

main().catch(console.error);
