# Flixer WASM - Final Solution

## Executive Summary

After extensive reverse engineering, we have:
1. **Fully understood** the fingerprint format and encryption scheme
2. **Partially cracked** the key derivation (we know it's `fpHash XOR xorConstant`)
3. **NOT cracked** the XOR constant derivation (custom algorithm in WASM)
4. **Created a working solution** using Puppeteer that works 100%

## What We Know

### Fingerprint String Format (100% Confirmed)
```
{colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}
```

Example:
```
24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk
```

### Key Derivation (Partial)
```
fpHash = SHA256(fpString)
key = fpHash XOR xorConstant
```

The XOR constant:
- Changes with each timestamp
- Does NOT change with the random part of sessionId
- Is NOT a simple hash of any known input
- Is derived through a custom algorithm in the WASM

### Session ID Format
```
{timestamp}.{random}
```
- timestamp = `Math.floor(Date.now() / 1000)`
- random = 7 digits from `Math.random()` decimal
- **Only the timestamp affects the key!**

### Canvas Fingerprint
- Size: 200x50 pixels
- Font 1: "14px Arial", text "TMDB Image Enhancement 🎬" at (2, 2)
- Font 2: "11px Arial", text "Processing capabilities test" at (2, 20)
- textBaseline = "top"
- Output: ~5028 character base64 PNG

### Encryption Scheme
- Algorithm: AES-256-CTR (fixslice32 implementation)
- Authentication: HMAC-SHA256
- Prefix: 195 bytes (contains IV/nonce and HMAC)

## Working Solution

### Using the Puppeteer Service

```javascript
const { FlixerDecryptionService } = require('./flixer-decryption-service.js');

async function getFlixerSources(type, tmdbId, season, episode) {
  const service = new FlixerDecryptionService();
  
  try {
    await service.initialize();
    
    const sources = await service.getSources(type, tmdbId, season, episode);
    
    return sources;
  } finally {
    await service.close();
  }
}

// Example usage
const sources = await getFlixerSources('tv', 1396, 1, 1); // Breaking Bad S01E01
console.log(sources);
```

### Service Features
- Automatic browser management
- Session key caching
- Error handling
- Rate limiting support
- Works with both movies and TV shows

## Why We Couldn't Fully Crack It

The WASM uses a custom key derivation function that:
1. Takes the fingerprint hash as input
2. XORs it with a constant derived through an unknown algorithm
3. The algorithm is obfuscated in compiled Rust/WASM

We tried:
- SHA256, SHA384, SHA512, SHA1, MD5
- HMAC-SHA256 with various keys
- HKDF with various salts/info
- PBKDF2 with various iterations
- xorshift128+, splitmix64, PCG32 PRNGs
- Various concatenations and XOR combinations
- Canvas pixel data hashing
- Full canvas vs truncated canvas

None matched the actual key derivation.

## Technical Details

### WASM Binary
- Size: 136,881 bytes
- Functions: 377
- get_img_key: Function #57
- process_img_data: Function #132

### Rust Crates Used
- aes-0.8.4
- ctr-0.9.2
- hmac-0.12.1
- cipher-0.4.4
- base64-0.21.7

### Key Observations
1. Keys are deterministic when all inputs are controlled
2. Same timestamp + different random = SAME KEY
3. Different timestamp + same random = DIFFERENT KEY
4. The WASM does its own SHA256 (not using browser crypto)

## Files

### Production
- `flixer-decryption-service.js` - Working Puppeteer service

### Analysis
- `CRACKING_STATUS.md` - Detailed status
- `FLIXER_WASM_COMPLETE_ANALYSIS.md` - Full analysis
- `img_data.wat` - Disassembled WASM

### Test Scripts
- `crack-wasm-controlled-multi.js` - Proved random doesn't affect key
- `crack-wasm-statistical-analysis.js` - Multiple sample collection
- `crack-wasm-prng-final.js` - PRNG algorithm testing
- `crack-wasm-intercept-imports.js` - WASM import tracing

## Recommendations

1. **For Production**: Use the Puppeteer-based service
2. **For Further Research**: 
   - Use Ghidra with WASM plugin
   - Trace memory writes during key generation
   - Look for custom PRNG implementations

## Conclusion

The Flixer WASM encryption is well-designed with a custom key derivation that resists reverse engineering. The Puppeteer solution provides a reliable workaround that works perfectly for production use.
