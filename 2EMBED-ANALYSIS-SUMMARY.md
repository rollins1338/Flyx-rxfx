# 2Embed/VidSrc Hash Analysis Summary

## Key Findings

### RCP Hash Structure
The cloudnestra.com RCP hash follows this structure:
```
base64(MD5:base64(base64(AES_ENCRYPTED_DATA)))
```

Example decoded:
- First layer: `8ce7b25351b580eebe93c2a2f2771bf5:VmxwdWNqVmtZbmx4...`
- MD5 part: `8ce7b25351b580eebe93c2a2f2771bf5`
- Data part: Another base64 string containing encrypted binary data

### Critical Discovery: Hash is NOT Reproducible
- The MD5 hash changes on EVERY request for the same movie
- The encrypted data also changes on every request
- This means the hash includes a random/time-based component generated server-side
- **We CANNOT recreate the prorcp/srcrcp hash ourselves**

### Tested MD5 Inputs (None Matched)
- MD5(tmdbId) ❌
- MD5(imdbId) ❌
- MD5(imdbId without tt) ❌
- MD5(tmdbId + imdbId) ❌
- MD5(imdbId + tmdbId) ❌

### Turnstile Protection
- The RCP page (`/rcp/{hash}`) is protected by Cloudflare Turnstile
- Sitekey: `0x4AAAAAABNpWSLmOnUi7s0b`
- After verification, page reloads and shows the prorcp iframe
- Verification sets a cookie that allows access

### Direct prorcp Access
- `/prorcp/{tmdbId}` → 404
- `/prorcp/{imdbId}` → 404
- `/prorcp/{hash}` → Requires Turnstile verification first
- The prorcp path MUST come from the encrypted RCP hash

## 2Embed Current State

### Available Servers (from 2embed.cc/embed/{tmdbId})
1. `streamsrcs.2embed.cc/swish` - Cloudflare protected
2. `streamsrcs.2embed.cc/vpls` - Cloudflare protected  
3. `streamsrcs.2embed.cc/vsrcc` - Cloudflare protected
4. `player4u.xyz/embed?key=` - Now shows search page (BROKEN)

### player4u.xyz Status
- The `?key=` parameter no longer returns direct results
- Shows a search form with "no trending items"
- The old extraction path is completely broken

## Conclusion

**Server-side bypass is NOT possible** for VidSrc/cloudnestra because:
1. Hash generation includes server-side random components
2. Turnstile verification is required
3. No predictable pattern exists to recreate the prorcp path

**Recommended Actions:**
1. Disable 2embed extractor (it's broken)
2. Rely on MoviesAPI as primary provider
3. Consider browser-based extraction for VidSrc (requires Turnstile solving)
