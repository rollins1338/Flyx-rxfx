/**
 * Deep deobfuscation of 111movies crypto implementation
 * 
 * The AES output differs - need to find out why
 */

async function deobfuscateCrypto() {
  const res = await fetch('https://111movies.com/_next/static/chunks/860-58807119fccb267b.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const bundle = await res.text();
  
  console.log('Bundle size:', bundle.length);
  
  // Find the cipher creation and understand the algorithm string
  // a(187,148)+"c" is the algorithm
  
  // First, let's find the 's' function which is the string array
  const sIdx = bundle.indexOf('function s(){let e=["');
  if (sIdx >= 0) {
    console.log('\n=== STRING ARRAY (s function) ===');
    const endIdx = bundle.indexOf('];return', sIdx);
    const arrayStr = bundle.substring(sIdx, endIdx + 1);
    console.log(arrayStr.substring(0, 2000));
    
    // Extract the array
    const match = arrayStr.match(/\["[^\]]+\]/);
    if (match) {
      try {
        const arr = JSON.parse(match[0].replace(/'/g, '"'));
        console.log('\nArray length:', arr.length);
        console.log('First 20 elements:', arr.slice(0, 20));
        
        // The 'a' function decodes strings from this array
        // a(e, t) returns decoded string at index (e - 133)
        // Let's decode a(187, 148) which should be the algorithm
        
        // a(187, 148) -> index = 187 - 133 = 54
        console.log('\na(187, 148) -> index 54:', arr[54]);
        
        // The string is base64 encoded with custom alphabet
        // Let's decode it
        const customB64Decode = (str) => {
          const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
          let result = '';
          let buffer = 0;
          let bits = 0;
          
          for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            const value = alphabet.indexOf(char);
            if (value === -1 || value === 64) continue;
            
            buffer = (buffer << 6) | value;
            bits += 6;
            
            if (bits >= 8) {
              bits -= 8;
              result += String.fromCharCode((buffer >> bits) & 0xFF);
            }
          }
          
          return result;
        };
        
        // Try to decode some strings
        console.log('\n=== DECODING STRINGS ===');
        for (let i = 50; i < 60; i++) {
          try {
            const decoded = customB64Decode(arr[i]);
            console.log(`arr[${i}] = "${arr[i]}" -> "${decoded}"`);
          } catch (e) {
            console.log(`arr[${i}] = "${arr[i]}" -> decode error`);
          }
        }
        
        // Also decode the strings used in cipher creation
        // i(1069,1038,1053,1097) - this is "eriv" to make "createCipheriv"
        // The 'i' function: i(e,t,n,r) { return a(n-855, e) }
        // So i(1069,1038,1053,1097) -> a(1053-855, 1069) = a(198, 1069)
        // But that's out of range... let me re-check
        
        // Actually looking at the code: function i(e,t,n,r){return a(n-855,e)}
        // So i(1069,1038,1053,1097) -> a(1053-855, 1069) = a(198, 1069)
        // index = 198 - 133 = 65
        console.log('\ni(1069,1038,1053,1097) -> a(198, 1069) -> index 65:', arr[65]);
        if (arr[65]) {
          console.log('Decoded:', customB64Decode(arr[65]));
        }
        
      } catch (e) {
        console.log('Parse error:', e.message);
      }
    }
  }
  
  // Find the 'a' function implementation
  const aIdx = bundle.indexOf('function a(e,t)');
  if (aIdx >= 0) {
    console.log('\n=== a FUNCTION ===');
    console.log(bundle.substring(aIdx, aIdx + 500));
  }
  
  // Find the 'i' function implementation  
  const iIdx = bundle.indexOf('function i(e,t,n,r)');
  if (iIdx >= 0) {
    console.log('\n=== i FUNCTION ===');
    console.log(bundle.substring(iIdx, iIdx + 100));
  }
}

deobfuscateCrypto().catch(console.error);
