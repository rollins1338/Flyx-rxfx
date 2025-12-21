# Flixer WASM Complete Analysis

## Executive Summary

The Flixer WASM encryption has been fully analyzed. While we couldn't reverse engineer the exact key derivation algorithm to replicate it in pure JavaScript/Node.js, we have:

1. **Fully documented the encryption scheme**
2. **Identified all components used**
3. **Created a working solution using Puppeteer**
4. **Extracted all client-side JavaScript files**
5. **Discovered the fingerprint string format in memory**

## Key Discovery: Fingerprint String Format

Through memory analysis, we discovered the exact fingerprint string format stored in WASM memory at offset 1119360:

```
{colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}
```

Example (131 characters):
```
24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:360:1766278661:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk
```

**However**, the SHA256 hash of this string does NOT match the generated key. This indicates the WASM uses additional processing:
- Possibly a custom PRNG seeded with the fingerprint
- Multiple rounds of hashing with internal state
- XOR operations with embedded constants
- A proprietary key derivation function

The exact algorithm remains obfuscated in the compiled Rust code.

## WASM Structure

- **File**: `img_data_bg.wasm` (136,881 bytes)
- **Functions**: 377 total (52 imported, 325 defined)
- **Language**: Compiled from Rust

### Key Exports
- `get_img_key()` - Returns 64-char hex session key
- `process_img_data(encrypted, apiKey)` - Decrypts data

### Rust Crates Used
- `aes-0.8.4` (fixslice32.rs) - AES-256 encryption
- `ctr-0.9.2` (ctr32.rs) - CTR mode
- `hmac-0.12.1` - HMAC authentication
- `cipher-0.4.4` - Stream cipher traits
- `base64-0.21.7` - Base64 encoding
- `serde_json-1.0.141` - JSON parsing

## Key Derivation Algorithm

### Fingerprint Components Collected
1. **Screen properties**: width, height, colorDepth
2. **Navigator properties**: userAgent, platform, language
3. **Timezone**: getTimezoneOffset()
4. **Session ID**: Stored in localStorage as `tmdb_session_id`
   - Format: `timestamp.random` (e.g., `1766277400.8945936`)
   - Generated using `Date.now()/1000` + `Math.random()`
5. **Canvas fingerprint**:
   - Creates 200x50 canvas
   - Sets textBaseline to "top"
   - Draws "TMDB Image Enhancement 🎬" at (2, 2) with "14px Arial"
   - Draws "Processing capabilities test" at (2, 20) with "11px Arial"
   - Gets toDataURL()

### Key Derivation Process
1. Collects all fingerprint components
2. Formats them into a specific string (exact format obfuscated)
3. Uses SHA256 (confirmed by initial hash values H0-H7 in data section)
4. Produces 32-byte (64 hex char) session key

### Why We Couldn't Replicate It
- The exact format string and order of components is obfuscated
- Multiple rounds of hashing may be used
- Internal WASM state or constants may be involved
- The compiled Rust code is difficult to decompile to readable pseudocode

## Encryption Scheme

### Response Structure
- **Prefix**: 195 bytes (contains IV/nonce and HMAC)
- **Ciphertext**: Variable length
- **Authentication**: HMAC-SHA256 (modifying any byte causes failure)

### Algorithm
- **Cipher**: AES-256-CTR (fixslice32 implementation)
- **Key**: Derived from API key + session key (exact derivation unknown)
- **IV/Nonce**: Located in the 195-byte prefix
- **Authentication**: HMAC-SHA256

## Anti-Bot Detection

The WASM includes detection for:
- HeadlessChrome
- PhantomJS
- Selenium

These strings are checked during initialization.

## Working Solution

### Using Puppeteer (Recommended)

```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function decryptFlixerData(tmdbId, seasonId, episodeId) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready);
  
  const result = await page.evaluate(async (tmdbId, seasonId, episodeId) => {
    const apiKey = window.wasmImgData.get_img_key();
    
    // Generate authentication
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const path = `/api/tmdb/tv/${tmdbId}/season/${seasonId}/episode/${episodeId}/images`;
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw', encoder.encode(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = btoa(String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)))
    ));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'Accept': 'text/plain',
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
      },
    });
    
    const encrypted = await response.text();
    return await window.wasmImgData.process_img_data(encrypted, apiKey);
  }, tmdbId, seasonId, episodeId);
  
  await browser.close();
  return JSON.parse(result);
}
```

## Files

### Downloaded Client Assets
- `client-assets/img_data.js` - WASM JavaScript wrapper
- `client-assets/tmdb-image-enhancer.js` - Main client library
- `client-assets/img_data_bg.wasm` - WASM binary

### Analysis Files
- `full-analysis.json` - Parsed WASM structure
- `disassembly-analysis.json` - Function analysis
- `func_57.wat` - Decompiled get_img_key function
- `data-section.bin` - Extracted data section

## Conclusion

The Flixer WASM encryption is well-designed to prevent scraping:

1. **Session-specific keys** prevent key reuse across sessions
2. **Browser fingerprinting** ties decryption to specific browser instances
3. **Authenticated encryption** prevents tampering
4. **WASM compilation** obfuscates the algorithm

### Recommendations

For production use:
1. Use Puppeteer with stealth plugin to avoid detection
2. Cache decrypted results to minimize API calls
3. Implement rate limiting to avoid being blocked
4. Consider running a dedicated browser service

### Limitations

- Requires a browser instance (cannot run in pure Node.js)
- Session keys change between browser sessions
- Anti-bot detection may block automated access
- API rate limits apply
