/**
 * Try deriving key from video ID
 * 
 * Video ID: 18ryYD7yWS2JcOLzFLxK6hXpCQ
 * XOR keys: [164, 33, 104, 69, 159, 231, 52, 160, 244, 234, 35, 64, 175, 178, 169, 206, 196]
 */

const videoId = '18ryYD7yWS2JcOLzFLxK6hXpCQ';
const xorKeys = [164, 33, 104, 69, 159, 231, 52, 160, 244, 234, 35, 64, 175, 178, 169, 206, 196];

console.log('Video ID:', videoId);
console.log('Video ID bytes:', videoId.split('').map(c => c.charCodeAt(0)));
console.log('XOR keys:', xorKeys);
console.log('');

// Check direct relationship
console.log('=== Direct video ID relationship ===\n');

const vidBytes = videoId.split('').map(c => c.charCodeAt(0));

// XOR with video ID
let matches = 0;
for (let i = 0; i < xorKeys.length; i++) {
  if (vidBytes[i % vidBytes.length] === xorKeys[i]) matches++;
}
console.log(`Direct match: ${matches}/${xorKeys.length}`);

// XOR video ID with constant
for (let c = 0; c < 256; c++) {
  matches = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    if ((vidBytes[i % vidBytes.length] ^ c) === xorKeys[i]) matches++;
  }
  if (matches > 5) {
    console.log(`XOR ${c}: ${matches} matches`);
  }
}

// Add constant to video ID
for (let c = 0; c < 256; c++) {
  matches = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    if (((vidBytes[i % vidBytes.length] + c) % 256) === xorKeys[i]) matches++;
  }
  if (matches > 5) {
    console.log(`ADD ${c}: ${matches} matches`);
  }
}

// Check if key is hash of video ID
console.log('\n=== Hash-based derivation ===\n');

// Simple rolling hash
function rollingHash(str, len) {
  const result = [];
  let h = 0;
  for (let i = 0; i < len; i++) {
    h = (h * 31 + str.charCodeAt(i % str.length)) & 0xFF;
    result.push(h);
  }
  return result;
}

const rh = rollingHash(videoId, xorKeys.length);
console.log('Rolling hash:', rh);
matches = 0;
for (let i = 0; i < xorKeys.length; i++) {
  if (rh[i] === xorKeys[i]) matches++;
}
console.log(`Rolling hash matches: ${matches}/${xorKeys.length}`);

// Try different hash multipliers
for (let mult = 1; mult < 256; mult++) {
  const result = [];
  let h = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    h = (h * mult + videoId.charCodeAt(i % videoId.length)) & 0xFF;
    result.push(h);
  }
  
  matches = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    if (result[i] === xorKeys[i]) matches++;
  }
  if (matches > 8) {
    console.log(`Mult ${mult}: ${matches} matches`);
    console.log('  Generated:', result);
  }
}

// RC4 with video ID as key
console.log('\n=== RC4 with video ID ===\n');

function rc4Keystream(key, len) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  const result = [];
  let i = 0;
  j = 0;
  for (let k = 0; k < len; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    result.push(S[(S[i] + S[j]) % 256]);
  }
  return result;
}

const rc4Keys = rc4Keystream(videoId, xorKeys.length);
console.log('RC4 keystream:', rc4Keys);
matches = 0;
for (let i = 0; i < xorKeys.length; i++) {
  if (rc4Keys[i] === xorKeys[i]) matches++;
}
console.log(`RC4 matches: ${matches}/${xorKeys.length}`);

// Maybe the key uses both video ID and some constant
console.log('\n=== Combined derivation ===\n');

// key[i] = videoId[i] XOR videoId[i+offset]
for (let offset = 1; offset < videoId.length; offset++) {
  matches = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    const k = vidBytes[i % vidBytes.length] ^ vidBytes[(i + offset) % vidBytes.length];
    if (k === xorKeys[i]) matches++;
  }
  if (matches > 5) {
    console.log(`XOR offset ${offset}: ${matches} matches`);
  }
}

// key[i] = videoId[i] + videoId[i+offset]
for (let offset = 1; offset < videoId.length; offset++) {
  matches = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    const k = (vidBytes[i % vidBytes.length] + vidBytes[(i + offset) % vidBytes.length]) % 256;
    if (k === xorKeys[i]) matches++;
  }
  if (matches > 5) {
    console.log(`ADD offset ${offset}: ${matches} matches`);
  }
}

// Maybe the key is derived from base64 decoding the video ID
console.log('\n=== Base64 decoded video ID ===\n');

try {
  // Video ID might be base64 encoded
  const decoded = Buffer.from(videoId, 'base64');
  console.log('Base64 decoded:', Array.from(decoded));
  
  matches = 0;
  for (let i = 0; i < Math.min(decoded.length, xorKeys.length); i++) {
    if (decoded[i] === xorKeys[i]) matches++;
  }
  console.log(`Base64 decoded matches: ${matches}`);
  
  // XOR with decoded
  for (let c = 0; c < 256; c++) {
    matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (((decoded[i % decoded.length] ^ c) & 0xFF) === xorKeys[i]) matches++;
    }
    if (matches > 8) {
      console.log(`Decoded XOR ${c}: ${matches} matches`);
    }
  }
} catch (e) {
  console.log('Base64 decode failed:', e.message);
}

// The video ID contains specific characters - maybe it's a custom encoding
console.log('\n=== Custom encoding analysis ===\n');

// Check character frequency in video ID
const charFreq = {};
for (const c of videoId) {
  charFreq[c] = (charFreq[c] || 0) + 1;
}
console.log('Video ID char frequency:', charFreq);

// The video ID uses base64url characters
// Maybe the key is derived from the position of each character in the base64 alphabet
const b64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const vidPositions = videoId.split('').map(c => b64Alphabet.indexOf(c));
console.log('Video ID as base64 positions:', vidPositions);

matches = 0;
for (let i = 0; i < xorKeys.length; i++) {
  if (vidPositions[i % vidPositions.length] === xorKeys[i]) matches++;
}
console.log(`Base64 position matches: ${matches}/${xorKeys.length}`);

// XOR positions with constant
for (let c = 0; c < 256; c++) {
  matches = 0;
  for (let i = 0; i < xorKeys.length; i++) {
    if (((vidPositions[i % vidPositions.length] + c) % 256) === xorKeys[i]) matches++;
  }
  if (matches > 8) {
    console.log(`Position + ${c}: ${matches} matches`);
  }
}
