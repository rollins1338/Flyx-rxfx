# Anime Playback System - Fixes Applied

## Date: February 21, 2026

## Issues Identified

### 1. AnimeKai Search API Returns 0 Results
**Root Cause**: AnimeKai endpoint changed from `/ajax/search` to `/ajax/anime/search` and now returns HTML instead of JSON.

**Status**: ✓ ALREADY FIXED IN CODE
- The extractor code at `app/lib/services/animekai-extractor.ts` already uses the correct endpoint
- HTML parsing is already implemented
- The issue is that production is returning 0 results, likely due to:
  - Turnstile CAPTCHA protection detected on both domains
  - Possible rate limiting or IP blocking
  - Need to investigate if residential proxy is needed for search requests

**Evidence**:
```bash
Testing domain: animekai.to
✓ Domain accessible: 200
⚠ Turnstile CAPTCHA detected!
Status: 200
Results: {"status":404,"result":null,"message":"404 Not Found"}
✗ Search returned 0 results
```

**Next Steps**:
1. Test if search works from RPI residential IP
2. Consider routing AnimeKai search through Cloudflare Worker → RPI proxy
3. Investigate if cookies/tokens are required for search API

### 2. HiAnime Stream Playback Fails with 502 Bad Gateway
**Root Cause**: MegaCloud CDN blocks requests via TLS fingerprinting. Both direct CF Worker fetch and RPI proxy are timing out.

**Fixes Applied**:

#### A. Increased RPI Proxy Timeouts
**File**: `rpi-proxy/server.js`
- Increased fetch timeout from 30s to 60s (line ~1135)
- Increased HTTP request timeout from 30s to 60s (line ~1280)

```javascript
// Before
signal: AbortSignal.timeout(30000),
timeout: 30000,

// After
signal: AbortSignal.timeout(60000), // 60 second timeout
timeout: 60000, // 60 second timeout
```

#### B. Added Retry Logic to Cloudflare Worker
**File**: `cloudflare-proxy/src/hianime-proxy.ts`
- Added `fetchWithRetry()` utility function with exponential backoff
- Retries failed requests 3 times with 1s, 2s, 4s delays
- Applied to both direct fetch and RPI proxy fallback
- Increased RPI proxy timeout from 20s to 30s

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  // Exponential backoff: 1s, 2s, 4s
  // Don't retry on 4xx errors (client errors)
}
```

**Expected Impact**:
- Slower CDN responses will now succeed instead of timing out
- Transient network errors will be automatically retried
- Total max wait time: 15s (direct) + 3 retries + 30s (RPI) = ~50s worst case

## Test Results

### Before Fixes
```
TEST 2: Production AnimeKai Extraction
✓ Total sources: 2
  AnimeKai: 0  ← NO ANIMEKAI SOURCES
  HiAnime: 2

TEST 3: HiAnime Stream Playback
Status: 502  ← STREAM PLAYBACK FAILS
✗ Playlist fetch failed: {"error":"Stream fetch failed from all sources"}
```

### After Fixes (Expected)
- HiAnime streams should work with increased timeouts and retry logic
- AnimeKai still needs investigation (CAPTCHA/rate limiting issue)

## Deployment Steps

### 1. Deploy RPI Proxy Changes
```bash
# On RPI
cd rpi-proxy
git pull
pm2 restart rpi-proxy
pm2 logs rpi-proxy --lines 50
```

### 2. Deploy Cloudflare Worker Changes
```bash
cd cloudflare-proxy
npm run deploy
# Or via Wrangler CLI
wrangler deploy
```

### 3. Verify Deployment
```bash
# Test HiAnime stream playback
node scripts/test-anime-diagnosis.js

# Should see:
# - HiAnime streams return 200 OK
# - Segments fetch successfully
```

## Monitoring

### Key Metrics to Watch
1. **HiAnime Stream Success Rate**: Should increase from 0% to >90%
2. **Average Response Time**: May increase slightly due to retries
3. **RPI Proxy Errors**: Watch for timeout errors in logs
4. **AnimeKai Extraction**: Still at 0%, needs separate fix

### Log Patterns to Monitor

**Success Pattern (RPI Proxy)**:
```
[AnimeKai] MegaCloud CDN detected — using fetch() for TLS bypass
[AnimeKai fetch] Status: 200, Content-Type: video/mp2t
```

**Timeout Pattern (needs investigation)**:
```
[AnimeKai fetch] Error: The operation was aborted due to timeout
```

**Retry Pattern (CF Worker)**:
```
Direct fetch failed, trying RPI
Forwarding to RPI proxy
```

## Known Limitations

### AnimeKai Search Issue
- **Problem**: Turnstile CAPTCHA blocking search API
- **Workaround**: HiAnime provides anime streams, so users can still watch
- **Long-term Fix**: 
  - Route search through residential proxy
  - Implement CAPTCHA solving
  - Use alternative anime metadata API

### MegaCloud CDN Blocking
- **Problem**: TLS fingerprinting blocks datacenter IPs
- **Current Solution**: RPI residential proxy
- **Risk**: If RPI IP gets blocked, streams will fail
- **Mitigation**: 
  - Rotate residential IPs
  - Use SOCKS5 proxy pool
  - Implement CDN fallback sources

## Files Modified

1. `rpi-proxy/server.js` - Increased timeouts (2 changes)
2. `cloudflare-proxy/src/hianime-proxy.ts` - Added retry logic (3 changes)
3. `scripts/test-anime-diagnosis.js` - New diagnostic script
4. `scripts/test-animekai-endpoints.js` - Endpoint discovery script
5. `scripts/test-animekai-new-api.js` - API format test script

## Rollback Plan

If issues occur after deployment:

### Rollback RPI Proxy
```bash
cd rpi-proxy
git checkout HEAD~1 server.js
pm2 restart rpi-proxy
```

### Rollback Cloudflare Worker
```bash
cd cloudflare-proxy
git checkout HEAD~1 src/hianime-proxy.ts
npm run deploy
```

## Next Actions

### Immediate (Deploy Now)
- [x] Increase RPI proxy timeouts
- [x] Add retry logic to CF Worker
- [ ] Deploy to production
- [ ] Monitor for 24 hours

### Short-term (This Week)
- [ ] Investigate AnimeKai CAPTCHA bypass
- [ ] Test search API from residential IP
- [ ] Add health check for RPI proxy connectivity
- [ ] Implement CDN fallback sources

### Long-term (This Month)
- [ ] Build SOCKS5 proxy pool for AnimeKai
- [ ] Implement automatic IP rotation
- [ ] Add Turnstile CAPTCHA solver
- [ ] Create fallback to alternative anime APIs

## Success Criteria

### Phase 1: HiAnime Streams Working (Target: Today)
- ✓ 502 errors eliminated
- ✓ Streams play successfully
- ✓ Segment fetching works
- ✓ No timeout errors in logs

### Phase 2: AnimeKai Extraction Working (Target: This Week)
- ✓ Search API returns results
- ✓ MAL ID matching works
- ✓ Streams extracted successfully
- ✓ Both providers working in parallel

## Contact

If issues persist after deployment:
1. Check RPI proxy logs: `pm2 logs rpi-proxy`
2. Check CF Worker logs: Cloudflare Dashboard → Workers → tv-proxy → Logs
3. Run diagnostic: `node scripts/test-anime-diagnosis.js`
4. Review this document for rollback procedures
