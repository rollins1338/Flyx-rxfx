# 🔥 Massive Platform Update — Admin, Proxies, and Video Player Rewrite

Hey everyone — just pushed a huge update across the entire stack. Admin panel, proxy infrastructure, and the video player all got rewritten. Here's the full breakdown:

---

## ⚡ Admin Panel — Real-Time SSE Push

The admin dashboard no longer polls every 60 seconds and prays. It now uses **Server-Sent Events** to push live data straight from the worker to your browser.

- Live user counts, activity breakdowns, and content stats update in real time
- Delta updates — only changed fields get sent, not the whole payload every time
- Automatic reconnection with exponential backoff if the connection drops
- Falls back to polling gracefully if SSE isn't available (you'll see a "Polling" badge)

---

## 🧠 Write-Behind Heartbeat Batching

Heartbeats used to hit D1 on every single request. Now they buffer in memory and flush in batches:

- Flushes every 10 seconds or when 50 heartbeats accumulate
- Single D1 transaction per flush regardless of batch size
- Estimated ~17K writes/day instead of potentially hundreds of thousands
- Retry logic with overflow protection — won't eat all your memory if D1 goes down

---

## 📊 Pre-Computed Aggregations via Cron

No more expensive GROUP BY queries on every dashboard load:

- Hourly aggregations run every 15 minutes (active users, sessions, watch time, content breakdown)
- Daily aggregations at midnight UTC (DAU/WAU/MAU, geographic, devices, top content)
- Dashboard reads from cache for completed periods, only queries raw data for the current window
- Estimated ~1K D1 reads/day, down from potentially millions

---

## 🧩 Component-Level Data Subscriptions

Killed the monolithic `StatsContext` that fetched everything for every page:

- 4 independent slice contexts: **Realtime**, **Content**, **Geographic**, **Users**
- Each slice subscribes only to the SSE channels it needs
- Switch tabs? Old channels unsubscribe, new ones subscribe. No wasted data.
- Connection status and error state tracked per slice

---

## 🗂️ Admin Page Consolidation

Went from 20+ admin route modules down to **6 primary views**:

- **Dashboard** — Overview + Real-time (live users, activity breakdown, peak stats)
- **Content Analytics** — Watch Sessions, Top Content, Completion Rates
- **User Analytics** — DAU/WAU/MAU, Sessions, Devices
- **Geographic** — Country/city distribution with real-time overlay
- **System Health** — Monitoring and diagnostics
- **Settings** — Admin configuration

Deprecated routes (traffic, traffic-unified, live-test, migrate-sync, insights, standalone engagement) have been removed or folded in.

---

## 🔒 SSE Authentication

- JWT validation on connect (query param or cookie)
- Periodic re-validation every 5 minutes on active connections
- No PII in event payloads — all user identifiers are hashed
- Invalid/expired tokens get a clean 401 rejection

---

## 🛠️ D1 Schema Updates

- New `aggregation_cache` table for pre-computed stats
- New `sse_state` table for delta computation persistence
- Covering index on `admin_heartbeats(timestamp, activity_type, content_category)`
- `admin_daily_stats` extended with hourly breakdown column

---

## 🌐 Cloudflare Proxy — Full Modular Rewrite

The CF Worker got restructured from a monolithic handler into a **pure routing layer** with 35+ dedicated handler modules. Every provider, every proxy type, every security layer is its own module now.

- **Route table-based dispatch** — single source of truth for all path routing, no more spaghetti if/else chains
- **Configurable stream protection** — switch between no protection, basic anti-leech, fortress, quantum shield v1/v2/v3 (paranoid mode) via env var
- **Structured JSON logging** with request tracing IDs on every request
- **Health endpoint** with uptime and metrics
- **CORS preflight** handled centrally for all routes

### Provider Modules

Every provider is now its own isolated module:

| Module | Route | What it does |
|--------|-------|-------------|
| `stream-proxy` | `/stream/*` | HLS stream proxying with protection mode routing |
| `tv-proxy` | `/tv/*` | DLHD live TV streams |
| `dlhd-proxy` | `/dlhd/*` | DLHD via Oxylabs residential IPs |
| `vidsrc-proxy` | `/vidsrc/*` | VidSrc extraction (no Turnstile) |
| `animekai-proxy` | `/animekai/*` | MegaUp CDN via RPI residential IP |
| `flixer-proxy` | `/flixer/*` | Flixer with WASM decryption |
| `hianime-proxy` | `/hianime/*` | HiAnime/MegaCloud |
| `viprow-proxy` | `/viprow/*` | VIPRow stream extraction |
| `ppv-proxy` | `/ppv/*` | PPV.to/poocloud streams |
| `cdn-live-proxy` | `/cdn-live/*` | CDN-Live provider |
| `iptv-proxy` | `/iptv/*` | Stalker portal IPTV |
| `tmdb-proxy` | `/tmdb/*` | TMDB API with edge caching |
| `analytics-proxy` | `/analytics/*` | Routes to Analytics Worker |
| `decoder-sandbox` | `/decode` | Isolated script execution |

### Security Layers

Stream protection is now tiered and configurable:

- **None** — direct passthrough
- **Basic** — anti-leech with origin validation
- **Fortress** — challenge-response protection
- **Quantum Shield v1/v2/v3** — progressive anti-bot with PoW challenges, v3 is full paranoid mode

Also ships with WASM modules for Flixer decryption and DLHD Proof-of-Work auth baked right into the worker.

---

## 🍓 RPI Proxy — Complete Server Rewrite

The Raspberry Pi proxy server got a ground-up rewrite. It's still a pure Node.js residential IP proxy, but now with proper security, automatic proxy management, and way more endpoints.

### SOCKS5 Proxy Pool Manager

This is the big one. The RPI now automatically maintains a pool of working SOCKS5 proxies:

- Fetches proxy lists from 3 GitHub sources on startup and every 10 minutes
- Validates each proxy by testing TLS connectivity to the actual target (cloudnestra.com)
- Maintains 100+ validated proxies with round-robin selection
- Auto-removes proxies after 3 failures
- Falls back to 20 hardcoded US proxies if pool refresh fails
- CF Workers can't do SOCKS5+TLS natively, so the RPI acts as a bridge: `CF Worker → RPI → SOCKS5 → target`

### DLHD Auth — WASM PoW (v4/v5)

Key fetching now uses the actual WASM Proof-of-Work module from DLHD:

- Extracts auth token, country, and timestamp from the player page (always fresh, no caching)
- Establishes heartbeat session with X-Client-Token header before key fetch
- Computes PoW nonce via WASM for signed key requests
- Supports both v4 and v5 auth flows with automatic fallback

### Security Hardening

- **Timing-safe API key comparison** — prevents timing attacks on key validation
- **Domain allowlist** — 50+ whitelisted domains, blocks everything else
- **Origin validation** — only accepts requests from known origins (tv.vynx.cc, flyx.tv, localhost, Vercel/Pages/Workers deployments)
- **Rate limiting** — 200 req/min for unauthenticated IPs, unlimited for API-key authenticated requests
- **No caching** for keys, auth tokens, or m3u8 manifests — always fresh
- **Read-only** — no request body forwarding, GET only

### Endpoints

| Endpoint | What it does |
|----------|-------------|
| `/proxy` | General proxy for any whitelisted domain |
| `/dlhd-key-v4` | DLHD key fetch with WASM PoW auth |
| `/dlhdprivate` | DLHD M3U8/segment proxying |
| `/fetch-socks5` | Bridge CF Worker → SOCKS5 → target |
| `/animekai` | AnimeKai/MegaUp/Flixer/dvalna CDN streams |
| `/viprow/*` | Full VIPRow stream extraction + manifest rewriting |
| `/ppv` | PPV.to streams (requires IPv4 + residential IP) |
| `/iptv/*` | IPTV Stalker portal API + stream proxying |
| `/health` | Health check with proxy pool stats |

---

## 🎬 Video Player — Desktop/Mobile Split + Multi-Provider

The video player got completely rewritten with separate desktop and mobile implementations.

### Architecture

- **VideoPlayerWrapper** dynamically imports the right player based on device — reduces initial bundle size
- **Desktop player** (VideoPlayer.tsx) — full keyboard controls, timeline preview, cast/AirPlay, transcript search
- **Mobile player** (MobileVideoPlayer.tsx) — touch gestures, swipe controls, orientation handling, haptic feedback
- **Shared core hooks** in `player/core/` — useHlsPlayer, useSubtitles, usePlaybackProgress, useSourceSwitcher, usePlayerState

### Multi-Provider Support

Both players support seamless provider switching with source caching:

| Provider | Type | Notes |
|----------|------|-------|
| Flixer | Primary | WASM-based, fastest extraction |
| VidLink | Secondary | Multi-language subtitle support |
| VidSrc | Tertiary | Reliable fallback |
| 1movies | Fallback | Fully reverse-engineered |
| AnimeKai | Anime | Skip intro/outro data, sub/dub switching |
| HiAnime | Anime | Primary anime provider |

- Auto-fallback to next provider on network errors
- Provider tabs in the player UI for manual switching
- Source caching prevents duplicate fetches when switching back

### Mobile-Specific Features

- **Double-tap** to seek forward/back 10s
- **Long-press** for 2x speed
- **Vertical swipe** left side = brightness, right side = volume
- **Horizontal swipe** to seek with preview
- **Pinch-to-zoom** for cropping
- **Haptic feedback** on all interactions
- **Lock controls** button to prevent accidental taps
- **Orientation handling** — auto-landscape in fullscreen

### Desktop-Specific Features

- Full keyboard shortcuts (space, arrows, F, M, etc.)
- Timeline hover preview
- Chromecast and AirPlay support
- Subtitle transcript search
- Copy stream URL button for external players (VLC, mpv)
- Quality level selection from HLS manifest

### Shared Features

- HLS.js with aggressive retry and stall recovery
- Subtitle system with auto-fetch, custom VTT upload, offset adjustment, and style customization
- Playback speed control (0.5x to 2x)
- Resume from saved progress with prompt
- Auto-play next episode with countdown
- Skip intro/outro buttons (from AnimeKai metadata)
- Anime sub/dub audio preference switching
- Presence tracking (watching/browsing status)
- Watch progress synced across devices

---

## 📈 By the Numbers

| Metric | Before | After |
|--------|--------|-------|
| D1 writes/day | Unbounded (1 per heartbeat) | ~17K (batched) |
| D1 reads/day | Potentially millions | ~1K |
| Dashboard data freshness | 60s polling | ~5s push |
| Admin route modules | 20+ | 6 |
| CF Worker modules | Monolithic handler | 35+ dedicated modules |
| RPI proxy endpoints | 3 | 10+ |
| Video player implementations | 1 (one-size-fits-all) | 2 (desktop + mobile) |
| Supported providers | 2-3 | 6 with auto-fallback |
| SOCKS5 proxy pool | Manual hardcoded list | Auto-managed 100+ validated |

---

This is all live now. If you're an admin, open the dashboard and you should see the "Live" badge in the top right. Video player changes are live for everyone. If something looks off, let me know.

— Nick
