# VidSrc Deobfuscation - Quick Reference

## Hash Structure

```
BASE64(MD5:BASE64(ENCRYPTED_PART1|BASE64_PART2))
```

## Decoding Example

```javascript
// Step 1: First base64 decode
const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');

// Step 2: Split by colon
const [md5, encryptedBase64] = firstDecode.split(':');

// Step 3: Second base64 decode
const encryptedData = Buffer.from(encryptedBase64, 'base64').toString('utf-8');

// Step 4: Split by pipe
const [part1, part2] = encryptedData.split('|');

// Part 1: 256 chars - Encrypted stream parameters
// Part 2: 919 chars - Base64 encoded key/IV
```

## Quick Implementation (Puppeteer)

```javascript
const puppeteer = require('puppeteer');

async function getM3U8(tmdbId, type = 'movie', season, episode) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    let m3u8 = null;
    page.on('request', req => {
        if (req.url().includes('.m3u8')) m3u8 = req.url();
    });
    
    let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    if (type === 'tv') url += `/${season}/${episode}`;
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(5000);
    await browser.close();
    
    return m3u8;
}
```

## Key Files

| File | Purpose |
|------|---------|
| `sources.js` | Decryption logic (CRITICAL) |
| `base64.js` | Base64 utilities |
| `sbx.js` | Anti-debugging |
| `asdf.js` | Player logic |

## Server Options

1. **CloudStream Pro** - Primary
2. **2Embed** - Fallback
3. **Superembed** - Alternative

## Important Notes

- ⏰ Hashes expire in 5-15 minutes
- 🔒 Uses AES-256-CBC encryption
- 🚫 Heavy anti-scraping protection
- ✅ Browser automation bypasses all protection

## Testing

```bash
# Test hash decoding
node deobfuscation/test-extraction.js

# Test live extraction
node deobfuscation/test-live-extraction.js
```

## Recommended Approach

**Use Puppeteer** - Most reliable, bypasses all encryption

## Files to Read

1. `DEOBFUSCATION-COMPLETE-SUMMARY.md` - Full analysis
2. `PRACTICAL-IMPLEMENTATION-GUIDE.md` - Implementation details
3. `STREAM-EXTRACTION-FLOW.md` - Complete flow diagram
