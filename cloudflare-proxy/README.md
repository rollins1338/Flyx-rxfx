# Cloudflare Media Proxy

A Cloudflare Worker that proxies HLS streams and live TV with proper headers and CORS support.

## Features

- **Stream Proxy** (`/stream/`) - Proxies HLS streams for 2embed/vidsrc
- **TV Proxy** (`/tv/`) - Proxies DLHD live TV streams
- **Decoder Sandbox** (`/decode`) - Isolated script execution environment
- **Health Check** (`/health`) - Status and metrics endpoint
- **Full Observability** - Structured JSON logging with request tracing

## Deployment

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
npx wrangler deploy

# Deploy to production
npx wrangler deploy --env production
```

## Observability & Logging

### Real-time Log Streaming

Stream logs in real-time to your terminal:

```bash
# Tail logs from production worker
npx wrangler tail media-proxy

# With filters
npx wrangler tail media-proxy --status error
npx wrangler tail media-proxy --search "stream"
npx wrangler tail media-proxy --format json
```

### Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **media-proxy**
3. Click **Logs** tab to view recent logs
4. Use **Real-time Logs** for live streaming

### Log Levels

Set `LOG_LEVEL` in `wrangler.toml` or via environment variable:

- `debug` - All logs including detailed request/response info
- `info` - Standard operational logs
- `warn` - Warnings and potential issues
- `error` - Errors only

### Log Format

All logs are structured JSON for easy parsing:

```json
{
  "timestamp": "2024-12-06T17:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "requestId": "abc123",
    "method": "GET",
    "path": "/stream/",
    "url": "https://media-proxy.xxx.workers.dev/stream/?url=..."
  },
  "data": {
    "status": 200,
    "contentType": "application/vnd.apple.mpegurl",
    "contentLength": "1234"
  },
  "duration": 150
}
```

### Health Check

```bash
curl https://media-proxy.xxx.workers.dev/health
```

Returns:
```json
{
  "status": "healthy",
  "uptime": "3600s",
  "metrics": {
    "totalRequests": 1000,
    "errors": 5,
    "streamRequests": 800,
    "tvRequests": 195,
    "decodeRequests": 5
  }
}
```

## API Routes

### Stream Proxy

```
GET /stream/?url=<encoded_url>&source=<source>&referer=<encoded_referer>
```

Parameters:
- `url` (required) - URL-encoded target stream URL
- `source` - Source identifier (default: `2embed`)
- `referer` - URL-encoded referer header

### TV Proxy

```
GET /tv/?channel=<id>
GET /tv/key?url=<encoded_url>
GET /tv/segment?url=<encoded_url>
```

### Decoder Sandbox

```
POST /decode
Content-Type: application/json

{
  "script": "<decoder script>",
  "divId": "player",
  "encodedContent": "<base64 content>"
}
```

## Configuration

### Environment Variables

Set via `wrangler secret` or Cloudflare Dashboard:

```bash
# Optional: RPI proxy for geo-restricted content
wrangler secret put RPI_PROXY_URL
wrangler secret put RPI_PROXY_KEY

# Optional: API key protection
wrangler secret put API_KEY
```

### wrangler.toml

```toml
[vars]
LOG_LEVEL = "debug"  # debug, info, warn, error

[observability]
enabled = true
```

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser:
1. Check that the worker is deployed with latest code
2. Verify the request is going to the correct worker URL
3. Check logs for upstream errors

### Stream Not Loading

1. Check `/health` endpoint for worker status
2. Tail logs: `npx wrangler tail media-proxy`
3. Look for upstream fetch errors in logs
4. Verify the source URL is accessible

### Debugging

```bash
# Local development
npx wrangler dev

# Test specific endpoint
curl -v "https://media-proxy.xxx.workers.dev/stream/?url=..."

# Check worker status
curl https://media-proxy.xxx.workers.dev/health
```

## License

MIT
