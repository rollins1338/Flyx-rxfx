# M3U8 Decryption Logic in PlayerJS

## Overview
PlayerJS uses **HLS.js** library to handle m3u8 playback with AES-128-CBC encryption. This document explains how the decryption works.

## Key Components

### 1. EXT-X-KEY Tag Parsing
When a m3u8 playlist contains encrypted segments, it includes an `EXT-X-KEY` tag:

```
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key.key",IV=0x12345678901234567890123456789012
```

**Parsed attributes:**
- `METHOD`: Encryption method (AES-128, AES-256, AES-256-CTR, or SAMPLE-AES)
- `URI`: URL to fetch the decryption key
- `IV`: Initialization Vector (optional, defaults to segment sequence number)
- `KEYFORMAT`: Key format identifier (default: "identity")

### 2. Key Loading Process

```javascript
// From playerjs analysis:
loadKeyHTTP(keyInfo, fragment) {
  // 1. Check if key is already loaded
  // 2. Fetch key from URI
  // 3. Store key in keyInfo.decryptdata.key
  // 4. Return promise with keyInfo
}
```

**Key loading steps:**
1. Parse EXT-X-KEY tag from m3u8
2. Extract key URI
3. Fetch key data (typically 16 bytes for AES-128)
4. Cache key for reuse across segments
5. Handle key rotation (different keys for different segments)

### 3. Decryption Methods

PlayerJS supports two decryption approaches:

#### A. Web Crypto API (Hardware-accelerated)
```javascript
webCryptoDecrypt(data, key, iv, method) {
  // Uses browser's native crypto.subtle API
  // Faster, hardware-accelerated
  // Returns Promise
}
```

#### B. Software Decryption (Fallback)
```javascript
softwareDecrypt(data, key, iv, method) {
  // Pure JavaScript AES implementation
  // Used when Web Crypto API unavailable
  // Synchronous operation
  
  // Key validation
  if (method !== "AES-128-CBC" || key.byteLength !== 16) {
    return null; // Only handles AES-128-CBC with 16-byte keys
  }
  
  // Expand key for AES rounds
  this.softwareDecrypter.expandKey(key);
  
  // Decrypt data with IV
  result = this.softwareDecrypter.decrypt(data.buffer, 0, iv);
  
  // Update IV for next segment (last 16 bytes of ciphertext)
  this.currentIV = data.slice(-16).buffer;
  
  return result;
}
```

### 4. Initialization Vector (IV) Handling

The IV is crucial for AES-CBC decryption:

```javascript
// IV sources (in priority order):
1. Explicit IV from EXT-X-KEY tag (IV=0x...)
2. Segment sequence number (default)
3. Previous segment's last 16 bytes (for chained decryption)

// IV format:
- 16 bytes (128 bits)
- Big-endian format
- Hex string in m3u8: "0x12345678901234567890123456789012"
```

### 5. Decryption Flow

```
1. Parse m3u8 playlist
   ↓
2. Detect EXT-X-KEY tag
   ↓
3. Load decryption key from URI
   ↓
4. For each encrypted segment:
   a. Download segment data
   b. Get/calculate IV
   c. Decrypt using AES-128-CBC
   d. Remove PKCS7 padding
   e. Pass to media source buffer
```

### 6. PKCS7 Padding Removal

AES-CBC requires data to be padded to 16-byte blocks:

```javascript
removePKCS7Padding(data) {
  const length = data.byteLength;
  if (!length) return data;
  
  // Last byte indicates padding length
  const paddingLength = new DataView(data.buffer).getUint8(length - 1);
  
  // Remove padding bytes
  return paddingLength ? data.slice(0, length - paddingLength) : data;
}
```

## Supported Encryption Methods

| Method | Support | Notes |
|--------|---------|-------|
| AES-128 | ✅ Full | Standard HLS encryption |
| AES-256 | ✅ Full | Stronger encryption |
| AES-256-CTR | ✅ Full | Counter mode |
| SAMPLE-AES | ✅ Partial | Requires EME/DRM |
| SAMPLE-AES-CENC | ✅ Partial | Common Encryption |
| SAMPLE-AES-CTR | ✅ Partial | Sample-level encryption |

## Implementation Example

```javascript
// Decrypt a segment
async function decryptSegment(segmentData, keyUri, iv) {
  // 1. Fetch decryption key
  const keyResponse = await fetch(keyUri);
  const keyData = await keyResponse.arrayBuffer();
  
  // 2. Convert IV from hex string to Uint8Array
  const ivArray = hexToUint8Array(iv);
  
  // 3. Decrypt using Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv: ivArray
    },
    key,
    segmentData
  );
  
  // 4. Remove PKCS7 padding
  return removePKCS7Padding(new Uint8Array(decrypted));
}

function hexToUint8Array(hexString) {
  // Remove "0x" prefix if present
  hexString = hexString.replace(/^0x/, '');
  
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}
```

## Key Caching Strategy

PlayerJS caches keys to avoid redundant fetches:

```javascript
keyIdToKeyInfo = {
  // Key ID (from keyFormat + URI hash)
  'identity:hash123': {
    decryptdata: { key, iv, method, uri, keyFormat },
    keyLoadPromise: Promise,
    loader: XHRLoader,
    mediaKeySessionContext: null
  }
}
```

## Error Handling

Common decryption errors:

1. **KEY_LOAD_ERROR**: Failed to fetch key from URI
2. **KEY_LOAD_TIMEOUT**: Key fetch timeout
3. **FRAG_DECRYPT_ERROR**: Decryption failed (wrong key/IV)
4. **BUFFER_APPEND_ERROR**: Decrypted data invalid

## Performance Considerations

1. **Use Web Crypto API when available** (10-100x faster than software)
2. **Cache keys** to avoid redundant network requests
3. **Parallel segment downloads** with sequential decryption
4. **Reuse decrypter instances** to avoid initialization overhead

## Security Notes

⚠️ **Important Security Considerations:**

1. Keys are transmitted over HTTPS (should be)
2. Keys are stored in memory (not persistent)
3. No key rotation = security risk
4. Client-side decryption = keys exposed to browser
5. Not suitable for premium content protection (use DRM instead)

## Debugging Tips

```javascript
// Enable HLS.js debug logging
const hls = new Hls({
  debug: true,
  enableSoftwareAES: false // Force Web Crypto API
});

// Monitor key loading
hls.on(Hls.Events.KEY_LOADING, (event, data) => {
  console.log('Loading key:', data.frag.decryptdata);
});

hls.on(Hls.Events.KEY_LOADED, (event, data) => {
  console.log('Key loaded:', data.keyInfo);
});

// Monitor decryption errors
hls.on(Hls.Events.ERROR, (event, data) => {
  if (data.details === Hls.ErrorDetails.FRAG_DECRYPT_ERROR) {
    console.error('Decryption failed:', data);
  }
});
```

## References

- HLS.js Documentation: https://github.com/video-dev/hls.js
- HLS RFC 8216: https://tools.ietf.org/html/rfc8216
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- AES-CBC: https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#CBC

## Summary

PlayerJS handles m3u8 decryption through HLS.js:
- ✅ Parses EXT-X-KEY tags from playlists
- ✅ Fetches decryption keys from URIs
- ✅ Supports AES-128/256-CBC encryption
- ✅ Uses Web Crypto API (with software fallback)
- ✅ Handles IV generation and chaining
- ✅ Removes PKCS7 padding
- ✅ Caches keys for performance

**This is NOT the SBX decoder** - this is standard HLS encryption that any video player supports!
