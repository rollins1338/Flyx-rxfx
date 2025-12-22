# Flyx Sync Worker

Cloudflare Worker for anonymous cross-device sync. Handles watch progress, watchlist, provider settings, and user preferences without requiring email or passwords.

## Features

- **Anonymous Sync**: Users get a sync code (FLYX-XXXXXX-XXXXXX) - no email required
- **Privacy-First**: Sync codes are hashed before storage
- **Cross-Device**: Sync data across all devices with the same code
- **Low Latency**: Cloudflare's global edge network
- **Free Tier Friendly**: Sync operations are low-frequency

## What Gets Synced

- Watch progress (resume where you left off)
- Watchlist
- Provider preferences (order, disabled providers)
- Subtitle settings (language, font size, colors)
- Player settings (auto-play, volume)

## Setup

### 1. Install Dependencies

```bash
cd cf-sync-worker
npm install
```

### 2. Configure Database

**Option A: Cloudflare D1 (Recommended - Free)**

```bash
# Create D1 database
wrangler d1 create flyx-sync

# Add the database ID to wrangler.toml
```

**Option B: Neon PostgreSQL**

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
# Sync Worker URL
NEXT_PUBLIC_CF_SYNC_URL=https://flyx-sync.your-subdomain.workers.dev
```

The app will automatically route sync requests through this worker when configured.

## API Endpoints

### GET /sync
Pull sync data from server.

**Headers:**
- `X-Sync-Code`: FLYX-XXXXXX-XXXXXX

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "lastSyncedAt": 1703123456789,
  "isNew": false
}
```

### POST /sync
Push sync data to server.

**Headers:**
- `X-Sync-Code`: FLYX-XXXXXX-XXXXXX
- `Content-Type`: application/json

**Body:**
```json
{
  "watchProgress": { ... },
  "watchlist": [ ... ],
  "providerSettings": { ... },
  "subtitleSettings": { ... },
  "playerSettings": { ... },
  "lastSyncedAt": 1703123456789,
  "schemaVersion": 1
}
```

### DELETE /sync
Delete sync account.

**Headers:**
- `X-Sync-Code`: FLYX-XXXXXX-XXXXXX

### GET /health
Health check endpoint.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes* | Neon PostgreSQL connection string |
| SYNC_DB | Yes* | D1 database binding (alternative to Neon) |
| ALLOWED_ORIGINS | No | Comma-separated allowed origins for CORS |
| LOG_LEVEL | No | Logging level (debug, info, warn, error) |

*Either DATABASE_URL or SYNC_DB is required.

## Cost Estimate

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request

Typical usage:
- Sync on app load: ~1 request
- Manual sync: ~1 request
- With 1000 daily users: ~2000 requests/day (well under limit)

## Security

- Sync codes are hashed with SHA-256 before storage
- No personal information is collected
- Data is stored encrypted at rest (Cloudflare/Neon)
- CORS protection for allowed origins
