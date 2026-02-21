# DLHD Full Recon Summary - February 19, 2026

## The 6 Folder/Player System

DLHD uses 6 different folder patterns on dlhd.link, each embedding a DIFFERENT player/domain:

| # | Folder | Embed Domain | Embed URL Pattern | Auth System | Status |
|---|--------|-------------|-------------------|-------------|--------|
| 1 | `stream` | **lefttoplay.xyz** | `/premiumtv/daddyhd.php?id={ch}` | EPlayerAuth (channelSalt + PoW) | ✅ ALIVE |
| 2 | `cast` | **lefttoplay.xyz** | `/premiumtv/daddyhd.php?id={ch}` | EPlayerAuth (channelSalt + PoW) | ✅ ALIVE |
| 3 | `watch` | topembed.pw | `/channel/{ChannelName}` | Unknown | ❌ DNS DEAD |
| 4 | `plus` | **daddyliveplayer.shop** → cstream.fit | `/embed/{token}` | Clappr (dynamic load) | ✅ ALIVE |
| 5 | `casting` | **ddyplayer.cfd** → cdn-live.tv | `/api/v1/channels/player/daddylive/?name={name}&code={code}` | OPlayer (dynamic load) | ✅ ALIVE |
| 6 | `player` | **tv-bu1.blogspot.com** | `/p/e1.html?id={ch}a` | JWPlayer + multiple sources | ✅ ALIVE |

## Domain Status (Player/Embed Domains)

| Domain | Status | Notes |
|--------|--------|-------|
| **lefttoplay.xyz** | ✅ ALIVE | NEW primary! Replaced epaly.fun. Has EPlayerAuth. |
| epaly.fun | ❌ SSL HANDSHAKE FAILURE | Was primary in Jan 2026. Dead now. |
| eplayer.to | ❌ DNS DEAD | Original domain. Gone. |
| codepcplay.fun | ❌ DNS DEAD | Was fast auth endpoint. Gone. |
| hitsplay.fun | ❌ TIMEOUT (14s) | Slow/unreliable. Effectively dead. |
| topembed.pw | ❌ DNS DEAD | Used by `watch` folder. Gone. |
| **daddyliveplayer.shop** | ✅ ALIVE | Used by `plus` folder. Redirects to cstream.fit. |
| **cstream.fit** | ✅ ALIVE | Clappr-based player. Dynamic stream loading. |
| **ddyplayer.cfd** | ✅ ALIVE | Redirects to cdn-live.tv. |
| **cdn-live.tv** | ✅ ALIVE | OPlayer-based. Dynamic stream loading. |
| **tv-bu1.blogspot.com** | ✅ ALIVE | Blogspot page with JWPlayer + many embedded sources. |

## CDN/Stream Infrastructure (UNCHANGED)

| Component | Status | Details |
|-----------|--------|---------|
| chevy.dvalna.ru (server_lookup) | ✅ ALIVE | Returns `{"server_key":"zeko"}` for ch51 |
| {server}new.dvalna.ru (M3U8) | ✅ ALIVE | M3U8 works with ANY referer |
| chevy.dvalna.ru/key/ (keys) | ✅ ALIVE | Still needs EPlayerAuth headers |
| kiko2.ru, giokko.ru (alt domains) | Unknown | Not tested in this recon |

## Key Findings

### 1. PRIMARY EMBED DOMAIN ROTATED: epaly.fun → lefttoplay.xyz
- Our extractor worker currently tries `epaly.fun` first → **SSL handshake failure**
- Then tries `eplayer.to` → **DNS dead**
- Then tries `hitsplay.fun` → **14 second timeout**
- Then tries `codepcplay.fun` → **DNS dead**
- **FIX: Add lefttoplay.xyz as the FIRST endpoint**

### 2. lefttoplay.xyz Uses Same EPlayerAuth System
- Same `EPlayerAuth.init()` pattern with authToken, channelKey, channelSalt, timestamp
- channelSalt is still a 64-char hex string
- authToken format: `premium{ch}|US|{timestamp}|{expiry}|{signature}`
- Added new field: `validDomain: 'lefttoplay.xyz'`
- Response time: ~300-560ms (fast!)

### 3. M3U8 Fetching Still Works Without Auth
- M3U8 from dvalna.ru works with ANY referer (lefttoplay.xyz, epaly.fun, daddyliveplayer.shop, dlhd.link)
- Only keys need EPlayerAuth headers
- server_lookup API still works

### 4. The `player` Folder (blogspot) is a GOLDMINE
- Contains direct M3U8 URLs from moveonjoy.com, thetvapp.to, bozztv.com, etc.
- These are UNENCRYPTED streams (no key needed!)
- Could be used as fallback sources

### 5. Fake HLS Noise Anti-Scraping
- lefttoplay.xyz includes a `fakeHLSNoise()` function that generates random fake M3U8 requests
- This is designed to confuse automated scrapers
- Our extractor doesn't need to worry about this since we extract auth data, not M3U8 URLs from the page

## What Needs Fixing

### Critical (Immediate)
1. **Add `lefttoplay.xyz` to auth endpoints** in:
   - `dlhd-extractor-worker/src/direct/dlhd-auth-v5.ts` → `fetchAuthData()` endpoints list
   - `rpi-proxy/dlhd-auth-v5.js` → same function
   - `cloudflare-proxy/src/dlhd-proxy.ts` → if still used

### Nice to Have (Future)
2. Consider adding `cstream.fit` / `cdn-live.tv` as alternative stream sources
3. Consider using blogspot page's direct M3U8 URLs as unencrypted fallbacks
4. Remove dead domains from endpoint lists to avoid wasting time on timeouts
