# Flyx Analytics Worker

Cloudflare Worker for analytics tracking. Handles presence/heartbeat, page views, watch sessions, and live activity monitoring.

## Features

- **Real-time Presence**: Track who's online and what they're doing
- **Page Views**: Track page visits with scroll depth and interactions
- **Watch Sessions**: Track video playback progress and completion
- **Live Activity**: See current viewers in real-time
- **Geo-aware**: Automatic country/city detection via Cloudflare
- **Bot Detection**: Skip tracking for detected bots

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/presence` | POST | Heartbeat for presence tracking |
| `/page-view` | POST | Track page views |
| `/watch-session` | POST | Track watch sessions |
| `/live-activity` | GET | Get current live activity (admin) |
| `/stats` | GET | Get analytics stats (admin) |
| `/health` | GET | Health check |

## Setup

### 1. Install Dependencies

```bash
cd cf-analytics-worker
npm install
```

### 2. Configure Database

```bash
# Set your Neon connection string
wrangler secret put DATABASE_URL
# Enter: postgresql://user:pass@host/db?sslmode=require
```

### 3. Deploy

```bash
# Development
npm run dev

# Production
npm run deploy:prod
```

### 4. Configure Your App

Add the worker URL to your `.env.local`:

```bash
# Dedicated Analytics Worker URL
NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL=https://flyx-analytics.your-subdomain.workers.dev
```

The app will automatically route analytics through this worker when configured. It takes priority over `NEXT_PUBLIC_CF_ANALYTICS_URL` if both are set.

## API Reference

### POST /presence

Track user presence/heartbeat.

```json
{
  "userId": "u_abc123",
  "sessionId": "s_xyz789",
  "activityType": "watching",
  "contentId": "12345",
  "contentTitle": "Movie Title",
  "contentType": "movie",
  "isActive": true,
  "isVisible": true,
  "timestamp": 1703123456789
}
```

### POST /page-view

Track page views.

```json
{
  "userId": "u_abc123",
  "sessionId": "s_xyz789",
  "pagePath": "/movies",
  "pageTitle": "Movies - Flyx",
  "entryTime": 1703123456789,
  "timeOnPage": 30000,
  "scrollDepth": 75
}
```

### POST /watch-session

Track watch sessions.

```json
{
  "userId": "u_abc123",
  "sessionId": "s_xyz789",
  "contentId": "12345",
  "contentType": "movie",
  "contentTitle": "Movie Title",
  "action": "progress",
  "currentTime": 1234,
  "duration": 7200
}
```

### GET /live-activity

Get current live activity.

```json
{
  "success": true,
  "summary": {
    "total": 42,
    "watching": 15,
    "browsing": 25,
    "livetv": 2
  },
  "activities": [...]
}
```

### GET /stats?period=24h

Get analytics stats. Period options: `1h`, `24h`, `7d`, `30d`

```json
{
  "success": true,
  "period": "24h",
  "stats": {
    "users": { "unique_users": 150, "total_sessions": 200 },
    "pageViews": { "total_views": 5000, "unique_visitors": 150 },
    "watching": { "total_watches": 300, "unique_watchers": 100, "avg_completion": 65.5 }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Neon PostgreSQL connection string |
| ALLOWED_ORIGINS | No | Comma-separated allowed origins for CORS |
| LOG_LEVEL | No | Logging level (debug, info, warn, error) |
| HEARTBEAT_INTERVAL | No | Expected heartbeat interval in seconds (default: 30) |

## Cost Estimate

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request

With 30-second heartbeats:
- 100 concurrent users = ~288,000 req/day
- Consider Workers Paid ($5/mo) for high traffic

## Database Schema

The worker expects these tables in your Neon database:

- `live_activity` - Current user activity
- `user_activity` - Long-term user tracking
- `page_views` - Page view events
- `page_metrics` - Aggregated page stats
- `watch_sessions` - Video watch sessions
- `content_stats` - Content view counts

These tables are created by the main app's database initialization.
