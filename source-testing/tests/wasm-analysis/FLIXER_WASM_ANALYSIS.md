# Flixer WASM Encryption Analysis

## Summary

The Flixer WASM uses a sophisticated encryption scheme that combines:
- **AES-256-CTR** encryption (fixslice32 implementation)
- **HMAC-SHA256** for authentication
- **Browser fingerprinting** for key derivation
- **Dynamic session keys** that change per browser session

## WASM Structure

- **File size**: 136,881 bytes
- **Functions**: 377 total (52 imported, 325 defined)
- **Key exports**:
  - `process_img_data(encrypted_base64, api_key)` - Main decryption function
  - `get_img_key()` - Returns the session-specific embedded key

## Rust Crates Used

From the embedded strings:
- `aes-0.8.4` (fixslice32.rs) - AES encryption
- `ctr-0.9.2` (ctr32.rs) - CTR mode
- `hmac-0.12.1` - HMAC authentication
- `cipher-0.4.4` (stream_core.rs) - Stream cipher traits
- `block-buffer-0.10.4` - Block buffer handling
- `universal-hash-0.5.1` - Universal hash functions
- `base64-0.21.7` - Base64 encoding/decoding
- `serde_json-1.0.141` - JSON parsing
- `generic-array-0.14.7` - Generic array types

## Encryption Flow

### Response Structure
- **Total overhead**: 195 bytes
- **Ciphertext**: Variable (typically 200 bytes for source list)
- **Structure**: `[prefix (195 bytes)][ciphertext]`

### Key Derivation

The embedded key is derived from browser fingerprint data:

1. **Canvas fingerprint**: Draws "TMDB Image Enhancement" text and gets toDataURL()
2. **Navigator properties**: userAgent, platform, language
3. **Screen properties**: width, height, colorDepth
4. **Timezone**: getTimezoneOffset()
5. **Session ID**: Stored in localStorage as `tmdb_session_id` (timestamp-based)
6. **Math.random()**: Used for session ID generation

The key changes between browser sessions but remains constant within a session.

### Encryption Details

- **Algorithm**: AES-256-CTR
- **Key**: Derived from fingerprint + API key (exact derivation unknown)
- **IV/Nonce**: Likely in the 195-byte prefix
- **Authentication**: HMAC-SHA256 (modifying any byte causes decryption failure)

## Key Functions

### Function 52 (12,264 bytes)
- Largest function
- Main processing loop
- Heavy memory access (420 loads, 297 stores)
- Calls many helper functions

### Function 57 (3,847 bytes)
- `get_img_key()` implementation
- Collects browser fingerprint
- Calls canvas, navigator, screen APIs
- Generates session-specific key

### Function 58 (2,924 bytes)
- 75 XOR operations
- Likely AES round function

### Function 59 (2,579 bytes)
- 144 XOR operations
- Likely AES key schedule or S-box operations

### Function 132 (276 bytes)
- `process_img_data()` wrapper
- Calls func_241 for string processing
- Calls func_206 for fingerprint check
- Returns Promise with decrypted data

## What We Tried (All Failed)

1. **Standard AES-CTR** with various key/IV combinations
2. **AES-GCM** and **ChaCha20-Poly1305**
3. **Key derivation** using:
   - API key (hex bytes and string)
   - Embedded key
   - SHA256/HMAC combinations
   - HKDF
   - XOR combinations
4. **IV positions** at every offset in the prefix
5. **Fingerprint-based keys** using captured browser data
6. **Memory analysis** during decryption
7. **Crypto API interception** (WASM doesn't use Web Crypto)

## Why It's Difficult

1. **Dynamic key**: The embedded key changes per session based on fingerprint
2. **Complex derivation**: Multiple fingerprint components combined in unknown way
3. **No external calls**: Decryption happens entirely within WASM
4. **Authenticated encryption**: Can't partially decrypt or modify data
5. **Obfuscated algorithm**: Key derivation logic is compiled Rust code

## Potential Approaches

1. **Full WASM decompilation**: Use tools like wasm-decompile or Ghidra
2. **Dynamic analysis**: Instrument WASM memory during execution
3. **Pattern matching**: Find the exact fingerprint combination algorithm
4. **Server-side**: The server knows the algorithm, could potentially be reverse-engineered from API behavior

## Conclusion

The Flixer encryption is well-designed to prevent scraping:
- Session-specific keys prevent key reuse
- Browser fingerprinting ties decryption to specific browsers
- Authenticated encryption prevents tampering
- WASM compilation obfuscates the algorithm

Without fully reverse-engineering the WASM binary to extract the exact key derivation algorithm, decryption outside of a browser context is not feasible.

## Files

- `img_data_bg.wasm` - The WASM binary
- `full-analysis.json` - Parsed WASM structure
- `disassembly-analysis.json` - Function analysis
- `data-section.bin` - Extracted data section
