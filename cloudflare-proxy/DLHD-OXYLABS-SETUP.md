# DLHD Proxy with Oxylabs Residential IPs

This proxy routes DLHD.dad live streams through Oxylabs residential ISP IPs for reliable streaming.

## Routes

| Route | Description |
|-------|-------------|
| `GET /dlhd?channel=<id>` | Get proxied M3U8 playlist |
| `GET /dlhd/key?url=<encoded_url>` | Proxy encryption key |
| `GET /dlhd/segment?url=<encoded_url>` | Proxy video segment |
| `GET /dlhd/health` | Health check & session info |

## Setup

### 1. Get Oxylabs Credentials

Sign up at [oxylabs.io](https://oxylabs.io/) and get your:
- Username
- Password

### 2. Configure Secrets

```bash
cd cloudflare-proxy

# Set Oxylabs credentials (required)
npx wrangler secret put OXYLABS_USERNAME
npx wrangler secret put OXYLABS_PASSWORD

# Optional: Set geo-targeting in wrangler.toml
# OXYLABS_COUNTRY = "us"
# OXYLABS_CITY = "new_york"
```

### 3. Deploy

```bash
npx wrangler deploy
```

## Usage

### Get a channel stream:
```bash
curl "https://your-worker.workers.dev/dlhd?channel=325"
```

### Check health & session:
```bash
curl "https://your-worker.workers.dev/dlhd/health"
```

Response:
```json
{
  "status": "healthy",
  "proxy": {
    "oxylabs": "configured",
    "country": "us"
  },
  "session": {
    "id": "dlhd_1702...",
    "age": "45s",
    "rotatesIn": "555s"
  }
}
```

## How It Works

1. **Session-based IP Rotation**: Each session uses a sticky residential IP for 10 minutes, then rotates to a new IP
2. **Fallback Chain**: Oxylabs → Direct fetch → RPI proxy (if configured)
3. **M3U8 Rewriting**: All segment and key URLs are rewritten to go through the proxy

## Geo-Targeting

Set these in `wrangler.toml` under `[vars]`:

```toml
[vars]
OXYLABS_COUNTRY = "us"    # Country code (us, uk, de, etc.)
OXYLABS_CITY = "new_york" # Optional city
```

## Fallback Options

If Oxylabs fails, the proxy falls back to:

1. **Direct fetch** - Works if CDN doesn't block Cloudflare IPs
2. **RPI Proxy** - Your Raspberry Pi residential proxy (if configured)

Configure RPI fallback:
```bash
npx wrangler secret put RPI_PROXY_URL
npx wrangler secret put RPI_PROXY_KEY
```

## Local Development

```bash
# Copy example vars
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your credentials
# Then run locally
npx wrangler dev
```

## Costs

- **Cloudflare Workers**: Free tier = 100k requests/day, Paid = $5/month for 10M requests
- **Oxylabs**: Pay-per-GB pricing, varies by plan (residential IPs are more expensive than datacenter)

## Troubleshooting

### "All fetch methods failed"
- Check Oxylabs credentials are set correctly
- Verify your Oxylabs account has residential proxy access
- Check the `/dlhd/health` endpoint for configuration status

### Slow streaming
- Oxylabs adds latency (~200-500ms per request)
- Consider caching segments longer if content allows
- Use geo-targeting to pick closer proxy locations

### IP blocked
- Session rotates every 10 minutes automatically
- Force rotation by redeploying the worker (resets session)
