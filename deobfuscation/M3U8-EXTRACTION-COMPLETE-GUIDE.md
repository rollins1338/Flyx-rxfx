# Complete M3U8 Extraction Guide for VidSrc

## Overview
This guide documents the complete flow to extract M3U8 URLs from VidSrc and all its streaming servers.

## Extraction Flow

### Step 1: VidSrc Page Analysis
**URL Pattern**: `https://vidsrc.xyz/embed/movie/{tmdb_id}` or `https://vidsrc.xyz/embed/tv/{tmdb_id}/{season}/{episode}`

**What to Extract**:
- Multiple server iframes (Vidplay, Filemoon, etc.)
- Each iframe has a `data-hash` attribute with encoded URL

**Example**:
```html
<iframe data-hash="dGhpcyBpcyBhbiBlbmNvZGVkIHVybA==" ...>
```

### Step 2: Decode the Hash
The `data-hash` is Base64 encoded. Decode it to get the iframe URL.

```javascript
const iframeUrl = atob(dataHash);
// Result: https://cloudnestra.com/e/{video_id}
```

### Step 3: Fetch the Player Page
Request the iframe URL to get the player HTML.

**Key Elements to Extract**:
1. **Player initialization data** - Usually in a `<script>` tag
2. **Encoded source URL** - Often base64 or custom encoded
3. **Decryption keys** - May be embedded in the page

### Step 4: Extract Source Data
Look for patterns like:
```javascript
// Common patterns in player pages:
- var file = "base64_encoded_url";
- sources: [{file: "url", type: "hls"}]
- setup({file: "url"})
```

### Step 5: Decode/Decrypt the Source
Depending on the server:
- **Vidplay**: Base64 + custom decryption
- **Filemoon**: Direct M3U8 URL or encoded
- **Doodstream**: API endpoint that returns M3U8
- **Upstream**: Encoded URL in player config

### Step 6: Get the M3U8
The final M3U8 URL will be in one of these formats:
```
https://server.com/hls/{video_id}/master.m3u8
https://server.com/playlist.m3u8?token=xxx
https://cdn.server.com/stream/{hash}/index.m3u8
```

## Server-Specific Extraction

### Vidplay/MyCloud
1. Decode base64 hash from VidSrc
2. Fetch player page from `https://vidplay.online/e/{id}`
3. Extract encrypted source from player config
4. Decrypt using keys from page
5. Result: M3U8 URL

### Filemoon
1. Decode hash
2. Fetch `https://filemoon.sx/e/{id}`
3. Look for `eval(function(p,a,c,k,e,d)...)` packed JavaScript
4. Unpack to find source URL
5. May need to call API endpoint for final M3U8

### Doodstream
1. Decode hash
2. Fetch `https://doodstream.com/e/{id}`
3. Extract pass_md5 token from page
4. Call API: `https://doodstream.com/pass_md5/{pass_md5}/{random}`
5. Response contains M3U8 URL

### Upstream
1. Decode hash
2. Fetch player page
3. Extract source from PlayerJS config
4. Decode base64 source
5. Result: M3U8 URL

## Implementation Strategy

### Recommended Approach:
```javascript
async function extractM3U8(tmdbId, type, season, episode) {
    // 1. Fetch VidSrc page
    const vidsrcUrl = type === 'movie' 
        ? `https://vidsrc.xyz/embed/movie/${tmdbId}`
        : `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
    
    const vidsrcHtml = await fetch(vidsrcUrl).then(r => r.text());
    
    // 2. Extract all server iframes
    const iframes = extractIframes(vidsrcHtml);
    
    // 3. Try each server until one works
    for (const iframe of iframes) {
        try {
            const m3u8 = await extractFromServer(iframe);
            if (m3u8) return m3u8;
        } catch (e) {
            continue; // Try next server
        }
    }
}

async function extractFromServer(iframe) {
    const playerUrl = atob(iframe.dataHash);
    const playerHtml = await fetch(playerUrl).then(r => r.text());
    
    // Server-specific extraction logic
    if (playerUrl.includes('vidplay')) {
        return extractVidplay(playerHtml);
    } else if (playerUrl.includes('filemoon')) {
        return extractFilemoon(playerHtml);
    }
    // ... etc for other servers
}
```

## Key Findings

### Common Patterns:
1. **All servers use obfuscation** - Base64, packed JS, or custom encoding
2. **Multiple fallback servers** - VidSrc provides 4-6 different servers
3. **Dynamic URLs** - M3U8 URLs often have expiring tokens
4. **CORS restrictions** - May need proxy for some servers
5. **Rate limiting** - Some servers limit requests

### Anti-Scraping Measures:
- Obfuscated JavaScript
- Encrypted source URLs
- Expiring tokens in M3U8 URLs
- Referrer checks
- User-Agent requirements
- Cloudflare protection

## Testing

### Test with a known working video:
```bash
# Movie example
TMDB_ID=550 # Fight Club
curl "https://vidsrc.xyz/embed/movie/550"

# TV Show example
TMDB_ID=1396 # Breaking Bad S01E01
curl "https://vidsrc.xyz/embed/tv/1396/1/1"
```

## Next Steps

1. **Implement server-specific extractors** for each streaming service
2. **Add caching** to avoid repeated requests
3. **Handle errors gracefully** with fallback servers
4. **Add proxy support** for CORS-restricted servers
5. **Monitor for changes** as these sites update frequently

## Important Notes

⚠️ **Legal Disclaimer**: This is for educational purposes only. Respect copyright laws and terms of service.

⚠️ **Maintenance**: These extraction methods may break as sites update their obfuscation techniques.

⚠️ **Rate Limiting**: Implement delays between requests to avoid being blocked.
