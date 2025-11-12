# VidSrc Stream Extraction Flow - Complete Analysis

## Overview
This document details the complete flow for extracting m3u8 stream URLs from VidSrc pages, based on analysis of the HTML structure and embedded scripts.

## Stream Extraction Flow

### 1. Initial Page Structure

The VidSrc page (`vidsrc_1-1762928269868.html`) contains:
- An iframe pointing to `cloudnestra.com/rcp/{HASH}`
- Multiple server options (CloudStream Pro, 2Embed, Superembed)
- Several JavaScript files that handle decoding and player logic

### 2. Hash Encoding Structure

The iframe URL hash uses **double base64 encoding** with MD5 verification:

```
Format: BASE64(MD5_HASH:BASE64(ENCRYPTED_DATA))
```

**Example Decoding:**
```javascript
// First decode
const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
// Result: "2a04910753484976b5d6c03f543507e0:M1B4V25GU3hLVmdFcno5MkZ4bmpQYW92..."

// Split by colon
const [md5Hash, secondBase64] = firstDecode.split(':');

// Second decode
const decryptedData = Buffer.from(secondBase64, 'base64').toString('utf-8');
// Result: Encrypted data separated by pipe "|"
```

### 3. Encrypted Data Structure

The decoded data contains two parts separated by `|`:

```
PART1|PART2
```

- **PART1**: Appears to be encrypted stream parameters or source URL
- **PART2**: Additional encryption keys or validation data

Both parts use custom encryption (likely AES or similar).

### 4. Key JavaScript Files

#### a) `/base64.js`
- Custom base64 encoding/decoding utilities
- May include modified base64 alphabet

#### b) `/sources.js` (CRITICAL)
- Contains the main source extraction logic
- Handles decryption of the encrypted data
- Makes API calls to retrieve actual stream URLs
- Likely contains the decryption keys

#### c) `/sbx.js`
- Sandbox/security logic
- Anti-debugging measures
- May validate requests

#### d) `//cloudnestra.com/asdf.js`
- Player initialization logic
- Stream URL handling
- HLS player setup

#### e) `/f59d610a61063c7ef3ccdc1fd40d2ae6.js`
- Dynamically loaded script (hash-based filename)
- May contain time-sensitive logic
- Likely changes frequently

### 5. Server Options

Three server options are available, each with their own hash:

1. **CloudStream Pro** - Primary source
2. **2Embed** - Fallback option
3. **Superembed** - Alternative source

Each server hash decodes to different encrypted data pointing to different CDN sources.

### 6. Stream URL Extraction Process

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User visits VidSrc page                                  │
│    - Page loads with iframe hash                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Decode iframe hash (double base64)                       │
│    - Extract MD5 hash                                        │
│    - Decode encrypted data                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Load cloudnestra.com/rcp/{HASH}                          │
│    - Returns player page with additional scripts             │
│    - May include time-based validation                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Execute sources.js                                        │
│    - Decrypt the encrypted data parts                        │
│    - Extract stream parameters                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Make API call to get stream URL                          │
│    - Likely to cloudnestra.com or CDN                        │
│    - Returns m3u8 playlist URL                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Initialize HLS player with m3u8 URL                      │
│    - Load video segments                                     │
│    - Begin playback                                          │
└─────────────────────────────────────────────────────────────┘
```

### 7. Important Metadata

From the HTML page:
- **data-i**: `30472557` (Content ID)
- **sub_hash**: `52ca5c1eadf6b07b0b0506793c0e06fa` (Subtitle hash)
- **current_sub_name**: `sub_30472557` (LocalStorage key)

### 8. Time Sensitivity

The stream URLs are **time-sensitive**:
- Hashes expire after a certain period
- The 404 response indicates the link has expired
- Fresh hashes must be generated for each request
- Likely includes timestamp validation

### 9. Anti-Scraping Measures

The page implements several anti-scraping techniques:
1. **DevTool Detection** - Disables developer tools
2. **Right-click disabled** - Prevents copying
3. **Obfuscated code** - Multiple layers of encoding
4. **Time-based expiration** - Links expire quickly
5. **Referrer checking** - Validates request origin
6. **Dynamic script loading** - Hash-based filenames

### 10. Next Steps for Complete Extraction

To successfully extract m3u8 URLs, you need to:

#### Step 1: Fetch Fresh Page
```javascript
// Get a fresh VidSrc page with current timestamp
const freshPage = await fetch('https://vidsrc.xyz/embed/movie/{TMDB_ID}');
```

#### Step 2: Extract Iframe Hash
```javascript
// Parse HTML and extract iframe src
const iframeMatch = html.match(/src="\/\/cloudnestra\.com\/rcp\/([^"]+)"/);
const hash = iframeMatch[1];
```

#### Step 3: Decode Hash
```javascript
// Double base64 decode
const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
const [md5, encryptedData] = firstDecode.split(':');
const secondDecode = Buffer.from(encryptedData, 'base64').toString('utf-8');
```

#### Step 4: Fetch Required Scripts
```javascript
// Fetch and analyze sources.js
const sourcesJs = await fetch('https://vidsrc.xyz/sources.js?t=1745104089');
// Look for decryption functions and API endpoints
```

#### Step 5: Decrypt Data
```javascript
// Use the decryption logic from sources.js
// This is the critical step that requires reverse engineering
const decrypted = decryptFunction(secondDecode);
```

#### Step 6: Extract Stream URL
```javascript
// Make API call with decrypted parameters
const streamUrl = await fetch(apiEndpoint, {
    method: 'POST',
    body: decrypted
});
```

### 11. Decoded Hash Analysis

From our analysis, the decoded hash contains:
```
3PxWnFSxKVgErz92FxnjPaovyu539mLmWfsGH9MzB7TWYZ2t5OP/xNvFcfCkVTgQPVlk+5isXH/sEXtx0GqqWq3J7I56Mp8gSzYB1flHElae+gF6P0yNkx9wcetfMBF5BlTHreOBCE54jYOdLn+VNZwhsoBGcLGYeQD+bHgL9+AGaHwBb1dvQEw6h24phkCAvlwq+QXlpOzS/t66CYRJKnqp+VU0X90WB+5hskVQejAzYHReti+PdrPE4w8AJfd3|HJ5RVXODgJUv+HwtCYVzpY5WrCy/xFkfmrCmrhzMwWgDnhZAY5cImGrGzJ61wY/kDBSXsXQeaCWdxbiun0HgaRsJ29jHW2aKWIP3BwsO+yMkKxo2vGdjzLyWGlB4kj/eDw/gtJRws8OqiWi6DyfmVLTM/p6ug3DymNVY6iGUtk7pcH7e/RSV8Asjt4xs2FEkuhN2nkC+8wRafSmsywRqcKBEHT4I5Y/EdFI3ih4P+evE26O2jdCZAQZ1fC/EBu/JEFmiL5gDiMnhr72BD1Yoa+cQj082qth47dPhwthhtuMW5oB291Jc7Y2zBHdjGl06KVuT6+mUMvXIGMfsSjnPGWhDmvXHqKAOqiPvKqIQ3hJ0BIujEJgWQ3zI+r7DtJzwwz8cARogZW8RQBeXILK1rZ0mh6li9Wg0PfJKuMCh7rPXuVrrc4aUmL59qV5O8q12kMNrw+MqbawOr0cYBJsyJXnnhhEL0uhhf3eB1tirLvxjcHog3buXTom8vNhdjKAUJOT1Q/t2XQ9tqXAzgtWGB24bClRrpubKK3v692A5OS6alOKp/MDDFvSm4hBCZJpWIO6kiwbfLKFRpkc5p06J8NZUpbq0szqr1uLm6rQJ0OFYArSA6+708Iejqf9+t1H3SANEvJzdS0FSechTgprUZjdbbFkr2XOnwk78kstNfFWRZ7WXf+pA8x5r9e5tjeOYOraSYoaV90qP4GKslTa9a66VGVNV++f9O1klGhyGSyvz/aHx7+0HAOfa0DJDVbyotmRwXhREqwNYzTkWNIhTwkR8Bx5lsOz5y0oTdC81/w0/I4Dw+KFvUF4xYTexBGy4EoeD4rgIwNaVb+4rHbOWOgTrmYgr8m7vWP+lkVLpybMh3c9ldaKHDAJNKIzcFsEaH3rJso0Rn3h2gvCePFj3A==
```

This appears to be:
- **Part 1**: Encrypted stream parameters (before `|`)
- **Part 2**: Base64-encoded encryption key or validation data (after `|`)

The `==` at the end of Part 2 confirms it's base64-encoded.

### 12. Critical Missing Piece

The **decryption algorithm** in `sources.js` is the key to unlocking the stream URL. This file must be:
1. Fetched from a live VidSrc page
2. Deobfuscated (likely heavily obfuscated)
3. Analyzed to extract the decryption function
4. Reverse-engineered to understand the encryption scheme

## Conclusion

The VidSrc stream extraction requires:
1. ✅ Understanding the hash structure (DONE)
2. ✅ Decoding the double base64 (DONE)
3. ❌ Obtaining the decryption algorithm (NEEDED)
4. ❌ Fetching fresh, non-expired hashes (NEEDED)
5. ❌ Making the final API call to get m3u8 (NEEDED)

The main blocker is obtaining and reverse-engineering the `sources.js` file to extract the decryption logic.
