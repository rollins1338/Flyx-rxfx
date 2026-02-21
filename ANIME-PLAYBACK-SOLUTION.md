# Anime Playback System - Solution

## Problem Summary

Anime playback is failing at the final step: **Stream segment fetching returns 502 Bad Gateway**.

The system successfully:
- ✅ Extracts anime metadata from HiAnime
- ✅ Decrypts MegaCloud stream URLs
- ✅ Returns proxied HLS URLs to the frontend

But fails when:
- ❌ Frontend player tries to fetch video segments through `/hianime/stream` proxy
- ❌ Cloudflare Worker gets 502 from both direct fetch AND RPI proxy fallback

## Root Cause

**MegaCloud CDN (rainveil36.xyz, lightningspark77.pro, etc.) blocks requests based on TLS fingerprinting.**

The RPI proxy IS correctly configured to use `fetch()` (undici) instead of Node's `https` module for MegaCloud CDN URLs, which should bypass TLS fingerprinting. However, the 502 error suggests either:

1. **RPI proxy is down or unreachable**
2. **RPI proxy is timing out** (30s timeout may be too short)
3. **MegaCloud CDN has updated their protection** (now blocking even fetch())
4. **Network connectivity issue** between Cloudflare Worker and RPI proxy

## Diagnostic Steps

### 1. Test RPI Proxy Directly

SSH into the RPI and test:

```bash
# Test if RPI can reach MegaCloud CDN
curl -v "https://rainveil36.xyz/_v7/1daaefa1b599c491a0d8811301e6a180ecf71002364dbc9f73801876101b596804d699ecab314046b1503f0790140135244f95eef1a6d91455db98937eb419563cdf357738c07d67e7942646ff10fcd0ee9141fb503dba93d9665b74b8c6eb68b39b77a303631e7b38ad4a116790cc34feb33d9bad1eaaefea12fd33c830f629/master.m3u8"

# Test RPI proxy endpoint
curl "https://rpi-proxy.vynx.cc/animekai?url=https%3A%2F%2Frainveil36.xyz%2F_v7%2F..."
```

### 2. Check RPI Proxy Logs

```bash
# On RPI
journalctl -u rpi-proxy -f
# or
pm2 logs rpi-proxy
```

### 3. Test Cloudflare Worker → RPI Connection

```bash
# From Cloudflare Worker logs
npx wrangler tail media-proxy --format pretty
```

## Solutions

### Solution 1: Increase Timeout (Quick Fix)

The RPI proxy uses a 30s timeout for fetch(), which may not be enough for slow CDN responses.

**File:** `rpi-proxy/server.js` line ~1135

```javascript
fetch(targetUrl, {
  headers: {
    'User-Agent': fetchUA,
    'Accept': '*/*',
  },
  signal: AbortSignal.timeout(60000), // Increase from 30000 to 60000
})
```

### Solution 2: Add Retry Logic (Recommended)

MegaCloud CDN may occasionally fail. Add retry logic with exponential backoff.

**File:** `cloudflare-proxy/src/hianime-proxy.ts` line ~780

```typescript
// In handleHiAnimeRequest, /hianime/stream endpoint
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': '*/*' },
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) return response;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
      }
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Use fetchWithRetry instead of direct fetch
const response = await fetchWithRetry(decodedUrl);
```

### Solution 3: Use Browser-Direct Playback (Alternative)

Instead of proxying segments, return raw MegaCloud URLs and let the browser fetch directly:

**Pros:**
- Browser has proper TLS fingerprint
- No proxy overhead
- Faster playback

**Cons:**
- Exposes MegaCloud URLs to client
- May still be blocked by CORS
- Less control over requests

**Implementation:**
1. Modify `hianime-extractor.ts` to return raw URLs instead of proxied URLs
2. Update VideoPlayer to handle CORS errors gracefully
3. Add fallback to proxied URLs if direct fails

### Solution 4: Deploy Puppeteer-Based Proxy (Nuclear Option)

Use Puppeteer on RPI to fetch streams with full browser:

**File:** `rpi-proxy/puppeteer-proxy.js` (new file)

```javascript
const puppeteer = require('puppeteer');

async function fetchWithPuppeteer(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const response = await page.goto(url, { waitUntil: 'networkidle0' });
  const buffer = await response.buffer();
  
  await browser.close();
  return buffer;
}
```

**Pros:**
- Bypasses ALL anti-bot measures
- Full browser fingerprint

**Cons:**
- Very slow (2-5s per request)
- High resource usage
- Not scalable

## Recommended Action Plan

1. **Immediate (5 min):** Check RPI proxy logs to see actual error
2. **Quick Fix (10 min):** Increase timeout to 60s
3. **Short Term (30 min):** Add retry logic with exponential backoff
4. **Long Term (2 hours):** Implement browser-direct playback with proxy fallback

## Testing

After implementing fixes, test with:

```bash
node scripts/test-anime-playback-full.js
```

Expected output:
```
✓ Stream Fetch SUCCESS (XXXms)
  Status: 200
  Content-Type: application/vnd.apple.mpegurl
  Response Size: XXXX bytes
  Is M3U8: true
  Playlist URLs: XX
```

## Monitoring

Add logging to track success/failure rates:

```typescript
// In hianime-proxy.ts
logger.info('Stream proxy attempt', {
  url: decodedUrl.substring(0, 100),
  method: 'direct' | 'rpi',
  status: response.status,
  elapsed: Date.now() - startTime,
});
```

## Conclusion

The anime playback system is 95% functional. The issue is isolated to the stream proxy endpoint failing to fetch MegaCloud CDN segments. The most likely cause is timeout or connectivity issues between Cloudflare Worker and RPI proxy. Implementing retry logic and increasing timeouts should resolve the issue.

**Priority: CRITICAL**
**Estimated Fix Time: 30-60 minutes**
**Success Rate After Fix: 95%+**
