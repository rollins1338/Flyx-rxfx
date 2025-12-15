/**
 * Properly decode 111movies obfuscated strings
 */

// The string array from the bundle
const stringArray = ["we1mshr0CfjLCq","yxv0B3bSyxK","x3nLyxnVBG","ywvZlti1nI1JyG","D2XJEe8","mwfLywmXztyYyW","ENDuwvu","wvPJC3m","ndi1ywfIyMi1za","BgvUz3rO","v3n1C0K","l3r2lW","nZq4nZb3EgnYrKO","sezitfu","zxjPDG","ExfTu0O","l25Z","vu5LCge","yMfZzty0","DgLTzw91Da","yLLmAgu","x2f1Dg9UzxH0","y2f0y2G","AM9PBG","C3rHDhvZ","q0jYCui","ndyWntjgtxfdyNO","Cgv6zKe","nti1mejtzwvVqG","sMzuz2i","ntmWndKXm2iZna","u3vfDwy","zMnKntuYyZqZmG","r0vu","ywrKrxzLBNrmAq","zM91BMq","zNjVBq","AMvJzM8","yxbWzw5K","l3nY","rgnnyuK","CgfYzw50","x2vWAxnVzgu","mJbIztC1yte5za","y2HHCKnVzgvbDa","mtnzCKXyCNy","zc1xAxrO","mtHvthDlDgG","BI9Vy3rLDc1ZDa","s1jjBK4","nJz4B3fusM8","CMvWBgfJzq","Bg9JyxrPB24","mJrmBuXUB24","nta1nJG0vfzdwhzQ","y3vYCMvUDa","q29UDgvUDc1uEq","vhrPD1m","zNjVBunOyxjdBW","vMjYywi","DgHLBG","mJG1otmXmKzntMfuBW","AhjLzG","thbNyxG","C3bSAxq","qLHPvNG","v3nVCxO","mJC0nZiWnMPiq3jyzG","wvHnCLy","owr4svbLBW","DxrMoa","DxbKyxrL","Cg9ZDe1LC3nHzW","Dg9tDhjPBMC","ALfKAfC","CLfVswG","wc1szxf1zxn0zq","mZKWoda3mJGXyq","r2nnrwe","C3rLBMvY","nJqXnZm4nhzKzeTQuq","yxv0B25LEhq","zgf0yq","y1PJyxa","q092Auq","ANnVBG","yxbWBgLJyxrPBW","x2LK","y2XPy2S","DwvZDa","u3LjvwS","zxzLBNq","l25L","mZqYnxLYvNjNqq","z2v0","BwfW"];

// The decoder function from the bundle (a.cSAxXb)
function decodeString(encoded) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
  let t = "";
  let n = "";
  
  for (let i = 0, r, a, idx = 0; a = encoded.charAt(idx++); ) {
    const charIdx = alphabet.indexOf(a);
    if (~charIdx) {
      r = i % 4 ? 64 * r + charIdx : charIdx;
      if (i++ % 4) {
        t += String.fromCharCode(255 & r >> (-2 * i & 6));
      }
    }
  }
  
  // URL decode
  for (let e = 0, r = t.length; e < r; e++) {
    n += "%" + ("00" + t.charCodeAt(e).toString(16)).slice(-2);
  }
  
  return decodeURIComponent(n);
}

// The 'a' function: a(e, t) returns decoded string at index (e - 133)
function a(e, t) {
  const idx = e - 133;
  return decodeString(stringArray[idx]);
}

// The 'i' function: i(e, t, n, r) returns a(n - 855, e)
function i(e, t, n, r) {
  return a(n - 855, e);
}

console.log('=== DECODING KEY STRINGS ===\n');

// Decode the algorithm string: a(187, 148) + "c"
// a(187, 148) -> index = 187 - 133 = 54
console.log('Algorithm: a(187, 148) + "c"');
console.log('  Index:', 187 - 133);
console.log('  Encoded:', stringArray[54]);
console.log('  Decoded:', a(187, 148));
console.log('  Full algorithm:', a(187, 148) + 'c');

// Decode i(1069,1038,1053,1097) - should be "eriv" for createCipheriv
// i(e,t,n,r) -> a(n-855, e) -> a(1053-855, 1069) = a(198, 1069)
// But 198 - 133 = 65
console.log('\nCipher method: "createCiph" + i(1069,1038,1053,1097)');
console.log('  i(1069,1038,1053,1097) -> a(198, 1069)');
console.log('  Index:', 198 - 133);
console.log('  Encoded:', stringArray[65]);
console.log('  Decoded:', a(198, 1069));

// Decode the update method: a(159, 129)
console.log('\nUpdate method: a(159, 129)');
console.log('  Index:', 159 - 133);
console.log('  Encoded:', stringArray[26]);
console.log('  Decoded:', a(159, 129));

// Decode the input encoding: i(969,1004,1013,1033)
// i(969,1004,1013,1033) -> a(1013-855, 969) = a(158, 969)
console.log('\nInput encoding: i(969,1004,1013,1033)');
console.log('  i -> a(158, 969)');
console.log('  Index:', 158 - 133);
console.log('  Encoded:', stringArray[25]);
console.log('  Decoded:', a(158, 969));

// Let's decode all strings to find useful ones
console.log('\n=== ALL DECODED STRINGS ===\n');
for (let idx = 0; idx < stringArray.length; idx++) {
  try {
    const decoded = decodeString(stringArray[idx]);
    if (decoded.length > 0 && decoded.length < 50) {
      console.log(`[${idx}] "${stringArray[idx]}" -> "${decoded}"`);
    }
  } catch (e) {
    // Skip decode errors
  }
}
