# Hexa.su Encryption Analysis

## Overview

Hexa.su (themoviedb.hexa.su) is owned by flixer.su/sh and provides encrypted streaming source data. The encryption can be decrypted using the enc-dec.app API.

**Important**: According to the [enc-dec.app documentation](https://github.com/AzartX47/EncDecEndpoints), the encryption/decryption code is **closed-source** because "the encryption/decryption methods are frequently changing and have become increasingly difficult to maintain due to patches."

## API Endpoints

- **Movie**: `https://themoviedb.hexa.su/api/tmdb/movie/{tmdb_id}/images`
- **TV**: `https://themoviedb.hexa.su/api/tmdb/tv/{tmdb_id}/season/{season}/episode/{episode}/images`

## Request Format

```javascript
const key = crypto.randomBytes(32).toString('hex'); // 64 hex chars

const headers = {
  'User-Agent': 'Mozilla/5.0...',
  'Accept': 'text/plain',
  'X-Api-Key': key,  // Random 32-byte hex key
};
```

## Encryption Structure

Based on analysis:

- **Total overhead**: 12 bytes
- **Structure**: `nonce (12 bytes) + ciphertext`
- **Nonce**: Random per request
- **Ciphertext**: Same length as plaintext (XOR-based, no auth tag)
- **Key**: 32 bytes (from hex-decoded X-Api-Key header)

## Algorithms Tested (All Failed)

### Standard Ciphers
- AES-256-CTR (various IV constructions)
- AES-256-GCM (without auth tag verification)
- AES-256-CBC
- ChaCha20 (IETF variant, 12-byte nonce)
- XChaCha20 (24-byte nonce, padded)
- ChaCha20-Poly1305
- XSalsa20-Poly1305 (NaCl secretbox)
- Salsa20

### Key Derivations Tested
- Raw hex-decoded key
- SHA256(key string)
- SHA256(key bytes)
- SHA512(key)[:32]
- MD5+MD5
- HKDF (various salt/info combinations)
- PBKDF2 (various iterations)
- scrypt
- HMAC-based derivations

### IV/Nonce Constructions Tested
- Nonce at start (12 bytes)
- Nonce at end (12 bytes)
- Nonce padded to 16 bytes
- Counter at different positions
- Derived IV from key/nonce hash

### Libraries Tested
- Node.js crypto module
- tweetnacl
- libsodium-wrappers
- @noble/ciphers

## Conclusion

The encryption algorithm is:
1. **Closed-source/proprietary** - Confirmed by enc-dec.app documentation
2. **Frequently changing** - The algorithm is patched regularly
3. **Not based on standard implementations** - Doesn't match any tested algorithm
4. **Stream cipher based** - XOR with keystream, no authentication
5. **12-byte nonce** - Random per request

## Working Solution

The recommended approach is to use the enc-dec.app API:

```javascript
// Decrypt using enc-dec.app
const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: encrypted, key }),
});
const { result } = await decResponse.json();
```

**Rate Limit**: 30 requests/second (per enc-dec.app documentation)

## Files

- `hexa-working-solution.js` - Working implementation using enc-dec.app
- `hexa-crack-v*.js` - Various cracking attempts (all failed)
- `hexa-test.js` - Basic test with enc-dec.app
- `HEXA_ENCRYPTION_ANALYSIS.md` - This document

## Resources

- [enc-dec.app](https://enc-dec.app/) - Decryption API
- [GitHub: EncDecEndpoints](https://github.com/AzartX47/EncDecEndpoints) - Documentation
- [hexa.su](https://hexa.su/) - Source site
- [flixer.su](https://flixer.su/) - Alternative domain
