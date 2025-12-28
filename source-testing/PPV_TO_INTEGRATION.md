# PPV.to Integration

## Overview

PPV.to is a live sports streaming aggregator that provides access to various sports events and 24/7 streams. This integration extracts direct m3u8 URLs for playback in our native player.

## Architecture

PPV streams require a residential IP proxy because poocloud.in (the CDN) blocks datacenter IPs (Cloudflare, AWS, etc.).

```
Browser → Cloudflare Worker (/ppv/stream) → RPI Proxy (/ppv) → poocloud.in
```

### Why Residential IP is Required

1. poocloud.in detects and blocks datacenter IP ranges
2. The Referer header alone is not sufficient - IP must be residential
3. Direct fetch from Cloudflare Workers returns 404

## API Endpoints

### 1. Get All Streams
```
GET /api/livetv/ppv-streams
```

Query parameters:
- `category` - Filter by category (e.g., "Football", "Basketball")
- `liveOnly` - Set to "true" to only show currently live streams
- `search` - Search streams by name or tag

Response:
```json
{
  "success": true,
  "categories": [
    {
      "id": 34,
      "name": "Football",
      "icon": "⚽",
      "streams": [
        {
          "id": 15280,
          "name": "Egypt vs. South Africa",
          "tag": "AFCON",
          "poster": "https://api.ppvs.su/assets/thumb/...",
          "uriName": "afcon/2025-12-26/egy-rsa",
          "startsAt": 1766761200,
          "endsAt": 1766768400,
          "isLive": true,
          "viewers": "1234"
        }
      ]
    }
  ],
  "stats": {
    "totalStreams": 67,
    "liveStreams": 5,
    "categoryCount": 8
  }
}
```

### 2. Get Stream URL
```
GET /api/livetv/ppv-stream?uri={uriName}
```

Query parameters:
- `uri` (required) - The stream's URI name (e.g., "afcon/2025-12-26/egy-rsa")
- `id` - Stream ID (optional, for tracking)
- `name` - Stream name (optional, for display)

Response:
```json
{
  "success": true,
  "streamUrl": "https://gg.poocloud.in/afcon/index.m3u8",
  "method": "atob",
  "streamInfo": {
    "id": "15280",
    "name": "Egypt vs. South Africa",
    "uriName": "afcon/2025-12-26/egy-rsa"
  },
  "playbackHeaders": {
    "Referer": "https://pooembed.top/",
    "Origin": "https://pooembed.top"
  }
}
```

### 3. Cloudflare Worker Proxy
```
GET /ppv/stream?url={encoded_m3u8_url}
```

This endpoint:
1. Tries to fetch via RPI residential proxy first
2. Falls back to direct fetch (will fail for most streams)
3. Rewrites m3u8 playlist URLs to go through the proxy
4. Adds proper CORS headers for browser playback

### 4. RPI Proxy Endpoint
```
GET /ppv?url={encoded_m3u8_url}
Header: X-API-Key: {your_api_key}
```

This endpoint runs on a Raspberry Pi with residential IP and:
1. Validates the domain is poocloud.in
2. Adds required Referer/Origin headers
3. Rewrites m3u8 URLs to absolute paths
4. Returns the proxied content

## Technical Details

### Stream Extraction Flow

1. **API Discovery**: `https://api.ppvs.su/api/streams` returns all available streams
2. **Embed Page**: Each stream has an embed URL at `https://pooembed.top/embed/{uri_name}`
3. **M3U8 Extraction**: The embed page contains a base64-encoded m3u8 URL in the format:
   ```javascript
   const src = atob("base64_encoded_m3u8_url");
   ```
4. **Playback**: The decoded URL points to `https://{server}.poocloud.in/{path}/index.m3u8`

### Stream Categories

| Category | Icon | Description |
|----------|------|-------------|
| American Football | 🏈 | NFL, College Football |
| Basketball | 🏀 | NBA, College Basketball |
| Combat Sports | 🥊 | UFC, Boxing, MMA |
| Cricket | 🏏 | International Cricket |
| Darts | 🎯 | World Darts Championship |
| Football | ⚽ | Soccer - Premier League, La Liga, etc. |
| Wrestling | 🤼 | WWE, AEW |
| 24/7 Streams | 📺 | Always-on entertainment channels |

### Playback Requirements

- **Format**: HLS (m3u8)
- **Player**: HLS.js recommended
- **Headers**: Must include `Referer: https://pooembed.top/` for streams
- **IP**: Must be residential (datacenter IPs are blocked)
- **Proxy**: Required - use CF Worker → RPI Proxy chain

### Stream Availability

- Streams return 404 before they go live
- `isLive` flag indicates if stream is currently active
- `always_live` streams (24/7) are always available
- Check `startsAt` and `endsAt` timestamps for scheduled events

## Configuration

### Environment Variables

```env
# Cloudflare Worker URL (required)
NEXT_PUBLIC_CF_STREAM_PROXY_URL=https://media-proxy.your-subdomain.workers.dev/stream

# RPI Proxy (required for PPV streams)
RPI_PROXY_URL=https://rpi-proxy.your-domain.com
RPI_PROXY_KEY=your-api-key
```

### Cloudflare Worker Secrets

```bash
wrangler secret put RPI_PROXY_URL
wrangler secret put RPI_PROXY_KEY
```

## Usage in Frontend

```typescript
// Fetch available streams
const response = await fetch('/api/livetv/ppv-streams?liveOnly=true');
const { categories } = await response.json();

// Get stream URL for playback
const streamResponse = await fetch(`/api/livetv/ppv-stream?uri=${stream.uriName}`);
const { streamUrl } = await streamResponse.json();

// Proxy through CF Worker (which uses RPI proxy)
const proxiedUrl = getPpvStreamProxyUrl(streamUrl);

// Play with HLS.js
const hls = new Hls();
hls.loadSource(proxiedUrl);
hls.attachMedia(videoElement);
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| 404 on m3u8 | Stream not live yet OR datacenter IP blocked | Check `startsAt` timestamp; ensure RPI proxy is configured |
| "Could not extract" | Page structure changed | Update extraction patterns |
| CORS error | Direct browser access blocked | Use proxy endpoint |
| RPI proxy 404 | RPI proxy not updated | Deploy latest rpi-proxy/server.js |

## Troubleshooting

### Stream returns 404 through proxy

1. Check if RPI proxy is running and accessible
2. Verify RPI_PROXY_URL and RPI_PROXY_KEY are set in CF Worker
3. Test RPI proxy directly: `curl "https://rpi-proxy.your-domain.com/ppv?url=..." -H "X-API-Key: ..."`
4. Check RPI proxy logs for errors

### Stream works in test but not in browser

1. Ensure CF Worker is deployed with latest code
2. Check browser console for CORS errors
3. Verify the proxy URL is correctly constructed

## Notes

- Streams are cached for 5 minutes at the API level
- Stream URLs are cached for 1 minute
- Some streams may have multiple quality options in the m3u8 playlist
- 24/7 streams are always available but may have lower quality
- RPI proxy must be deployed on a residential IP (not datacenter)
