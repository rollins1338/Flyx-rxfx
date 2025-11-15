
// RC4 Cipher Implementation (extracted from obfuscated code)
function rc4(data, key) {
  const S = [];
  const keyLength = key.length;
  let j = 0;
  
  // KSA (Key Scheduling Algorithm)
  for (let i = 0; i < 256; i++) {
    S[i] = i;
  }
  
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % keyLength)) % 256;
    [S[i], S[j]] = [S[j], S[i]]; // Swap
  }
  
  // PRGA (Pseudo-Random Generation Algorithm)
  let i = 0;
  j = 0;
  let result = '';
  
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]]; // Swap
    
    const K = S[(S[i] + S[j]) % 256];
    result += String.fromCharCode(data.charCodeAt(n) ^ K);
  }
  
  return result;
}

// Custom base64 decode (they might use a custom alphabet)
function customBase64Decode(input) {
  // Standard base64 alphabet
  const alphabet = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';
  
  let output = '';
  let chr1, chr2, chr3;
  let enc1, enc2, enc3, enc4;
  let i = 0;
  
  // Remove non-alphabet characters
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  
  while (i < input.length) {
    enc1 = alphabet.indexOf(input.charAt(i++));
    enc2 = alphabet.indexOf(input.charAt(i++));
    enc3 = alphabet.indexOf(input.charAt(i++));
    enc4 = alphabet.indexOf(input.charAt(i++));
    
    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;
    
    output += String.fromCharCode(chr1);
    
    if (enc3 !== 64) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output += String.fromCharCode(chr3);
    }
  }
  
  return output;
}

module.exports = { rc4, customBase64Decode };
