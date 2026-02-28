# Flyx

A modern streaming platform built with Next.js 16, featuring movies, TV shows, live TV, and cross-device sync. Deployed on Cloudflare's edge network for maximum performance.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Features

- **Movies & TV Shows** - Browse trending content, search, and watch with multiple video providers
- **Live TV** - IPTV support with DLHD integration
- **Cross-Device Sync** - Sync watchlist, continue watching, and preferences across devices
- **Continue Watching** - Resume playback from where you left off
- **Admin Dashboard** - Real-time analytics, user metrics, and live activity monitoring
- **Privacy-First** - Anonymous tracking, no PII collected, GDPR-compliant

---

## Deployment

Flyx runs entirely on Cloudflare's edge network using:
- **Cloudflare Pages** - Next.js app via `@opennextjs/cloudflare`
- **Cloudflare Workers** - Sync and stream proxy
- **Cloudflare D1** - SQLite database at the edge

### Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
3. [TMDB API key](https://www.themoviedb.org/settings/api)

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Vynx-Velvet/flyx-main.git
cd flyx-main
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Required - TMDB API
TMDB_API_KEY=your_tmdb_bearer_token
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key

# Cloudflare Worker URLs (update after deploying workers)
NEXT_PUBLIC_CF_SYNC_URL=https://flyx-sync.YOUR-SUBDOMAIN.workers.dev
NEXT_PUBLIC_CF_PROXY_URL=https://media-proxy.YOUR-SUBDOMAIN.workers.dev
```

### 3. Set Up D1 Databases

Create the required D1 databases:

```bash
# Admin database (for main app)
wrangler d1 create flyx-admin-db

# Sync database (for sync worker)
cd cf-sync-worker
wrangler d1 create flyx-sync-db
cd ..
```

**Important:** Copy the `database_id` from each command output and update the respective `wrangler.toml` files.

### 4. Initialize Database Schemas

```bash
# Initialize admin database schema
npm run d1:init

# Initialize sync worker schema
cd cf-sync-worker
wrangler d1 execute flyx-sync-db --file=schema.sql
cd ..
```

### 5. Configure Secrets

```bash
# Set secrets for main app
wrangler secret put TMDB_API_KEY
wrangler secret put JWT_SECRET

# Set secrets for media proxy (if using RPI proxy)
cd cloudflare-proxy
wrangler secret put RPI_PROXY_URL
wrangler secret put RPI_PROXY_KEY
cd ..
```

### 6. Deploy Everything

```bash
# Deploy all workers and the main app
npm run deploy:all
```

Or deploy individually:

```bash
# Deploy workers first
npm run deploy:sync-worker
npm run deploy:media-proxy

# Then deploy the main app
npm run deploy:cloudflare
```

---

## Deployment Scripts

| Script | Description |
|--------|-------------|
| `npm run build:cloudflare` | Build Next.js app for Cloudflare Pages |
| `npm run deploy:cloudflare` | Build and deploy main app to Cloudflare Pages |
| `npm run deploy:sync-worker` | Deploy sync worker |
| `npm run deploy:media-proxy` | Deploy media proxy worker |
| `npm run deploy:workers` | Deploy both workers |
| `npm run deploy:all` | Deploy workers + main app (full deployment) |
| `npm run preview:cloudflare` | Preview Cloudflare build locally |

---

## D1 Database Setup

### Database Structure

Flyx uses two D1 databases:

| Database | Purpose | Used By |
|----------|---------|---------|
| `flyx-admin-db` | Admin users, feedback, bot detection, daily metrics | Main App |
| `flyx-sync-db` | Watch progress, watchlist, user preferences, admin heartbeats, daily stats | Sync Worker |

### Updating wrangler.toml

After creating databases, update the `database_id` in each `wrangler.toml`:

**Root `wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "flyx-admin-db"
database_id = "YOUR-ADMIN-DB-ID"
```

**`cf-sync-worker/wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "flyx-sync-db"
database_id = "YOUR-SYNC-DB-ID"
```

### Database Commands

```bash
# Initialize admin database
npm run d1:init

# Initialize locally (for development)
npm run d1:init:local

# Query database directly
wrangler d1 execute flyx-admin-db --command="SELECT * FROM admin_users"
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | TMDB Bearer token (Read Access Token) |
| `NEXT_PUBLIC_TMDB_API_KEY` | TMDB API key (v3 auth) |

### Cloudflare Worker URLs

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CF_SYNC_URL` | Sync Worker URL for cross-device sync |
| `NEXT_PUBLIC_CF_PROXY_URL` | Media proxy worker URL |

### Optional

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for admin JWT tokens |
| `RPI_PROXY_URL` | RPI proxy URL for DLHD streams |
| `RPI_PROXY_KEY` | RPI proxy authentication key |

---

## Local Development

```bash
# Start Next.js dev server
npm run dev

# Preview Cloudflare build locally
npm run preview:cloudflare

# Run workers locally
cd cf-sync-worker && npm run dev
cd cloudflare-proxy && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Admin Panel

Access at `/admin` after deployment.

**Default credentials:** `vynx` / `defaultPassword`

⚠️ **Change password immediately after first login!**

### Admin Commands

```bash
# Create new admin
npm run admin:create <username> <password>

# Reset password  
npm run admin:reset-password <username> <new-password>

# List all admins
npm run admin:list

# Delete admin
npm run admin:delete <username>
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Cloudflare Pages (Next.js)                │ │
│  │              via @opennextjs/cloudflare                │ │
│  │                        │                               │ │
│  │                   D1: flyx-admin-db                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌─────────────────────────────┐  ┌───────────────────┐    │
│  │        Sync Worker          │  │   Media Proxy     │    │
│  │  (sync + admin analytics)   │  │     Worker        │    │
│  │       D1: sync-db           │  │                   │    │
│  └─────────────────────────────┘  └───────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Why Cloudflare?

- **Free tier**: 100k requests/day, 5GB D1 storage, unlimited Pages bandwidth
- **Global edge**: <50ms latency worldwide with 300+ edge locations
- **No cold starts**: Always warm, instant responses
- **SQLite at edge**: D1 is SQLite, simple and fast
- **Automatic SSL**: Free SSL certificates
- **Preview deployments**: Automatic previews for PRs

---

## Project Structure

```
flyx-main/
├── app/                    # Next.js App Router
│   ├── (routes)/          # Page routes
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   ├── components/        # React components
│   ├── lib/               # Utilities & services
│   │   ├── db/           # D1 database utilities
│   │   ├── analytics/    # Local-first analytics
│   │   └── sync/         # Sync client
│   └── types/             # TypeScript types
├── cf-sync-worker/        # Sync Worker + D1 (sync + admin analytics)
├── cloudflare-proxy/      # Stream proxy worker
├── scripts/               # CLI scripts
│   ├── init-d1-admin.sql # D1 schema initialization
│   └── create-admin.js   # Admin user creation
├── wrangler.toml          # Main app Cloudflare config
└── open-next.config.ts    # OpenNext configuration
```

---

## Troubleshooting

### Build Fails

```bash
# Clear build cache and rebuild
rm -rf .open-next .next
npm run build:cloudflare
```

### D1 Database Issues

```bash
# Check database exists
wrangler d1 list

# Check tables
wrangler d1 execute flyx-admin-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# Re-initialize schema
npm run d1:init
```

### Worker Deployment Issues

```bash
# Check worker status
wrangler deployments list

# View worker logs
cd cf-sync-worker && wrangler tail
```

### Environment Variables Not Working

1. Verify secrets are set: `wrangler secret list`
2. Check `wrangler.toml` has correct `[vars]` section
3. Redeploy after adding secrets

---

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:livetv
npm run test:livetv:api

# Type checking
npm run type-check
```

---

## Credits

- **Movie & TV Data** - [TMDB](https://www.themoviedb.org/)
- **IPTV Help** - [MoldyTaint/Cinephage](https://github.com/MoldyTaint/Cinephage)
- **Cloudflare Adapter** - [@opennextjs/cloudflare](https://opennext.js.org/cloudflare)

## License

MIT License - see [LICENSE](LICENSE)
