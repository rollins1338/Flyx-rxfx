# Flyx

A modern streaming platform built with Next.js 15, featuring movies, TV shows, live TV, and cross-device sync.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Features

- **Movies & TV Shows** - Browse trending content, search, and watch with multiple video providers
- **Live TV** - IPTV support with DLHD integration
- **Cross-Device Sync** - Sync watchlist, continue watching, and preferences across devices
- **Continue Watching** - Resume playback from where you left off
- **Admin Dashboard** - Real-time analytics, user metrics, and live activity monitoring
- **Privacy-First** - Anonymous tracking, no PII collected, GDPR-compliant

---

## Quick Deploy

Choose your deployment platform:

### Option A: Vercel (Easiest)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVynx-Velvet%2Fflyx-main&env=TMDB_API_KEY,NEXT_PUBLIC_TMDB_API_KEY&envDescription=TMDB%20API%20keys%20required%20for%20movie%20and%20TV%20data&envLink=https%3A%2F%2Fwww.themoviedb.org%2Fsettings%2Fapi&project-name=flyx&repository-name=flyx)

Required environment variables:
- `TMDB_API_KEY` - [Get from TMDB](https://www.themoviedb.org/settings/api) (Bearer token)
- `NEXT_PUBLIC_TMDB_API_KEY` - TMDB API key (v3 auth)

---

### Option B: Cloudflare Pages (100% Cloudflare Stack)

Deploy the entire app to Cloudflare Pages using `@opennextjs/cloudflare`:

**Via Cloudflare Dashboard (Recommended):**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click "Create a project" → "Connect to Git"
3. Select the `Vynx-Velvet/flyx-main` repository
4. Configure build settings:
   - **Build command:** `npm run build:cloudflare`
   - **Build output directory:** `.open-next/assets`
   - **Root directory:** `/`
5. Add environment variables:
   - `TMDB_API_KEY` - Your TMDB Bearer token
   - `NEXT_PUBLIC_TMDB_API_KEY` - Your TMDB API key
6. Deploy!

<details>
<summary>Manual CLI deployment</summary>

```bash
# Clone the repo
git clone https://github.com/Vynx-Velvet/flyx-main.git
cd flyx-main

# Install dependencies
npm install

# Build for Cloudflare
npm run build:cloudflare

# Deploy to Cloudflare Pages
npm run deploy:cloudflare

# Or preview locally first
npm run preview:cloudflare
```

</details>

**Cloudflare Pages Benefits:**
- Unlimited bandwidth (free tier)
- Global CDN with 300+ edge locations
- Automatic SSL
- Preview deployments for PRs
- Native D1/KV/R2 integration

---

## Cloudflare Workers + D1 (Optional but Recommended)

Deploy workers for cross-device sync, analytics, and stream proxying. Each uses **Cloudflare D1** (SQLite at the edge) - no external database needed!

### Sync Worker (Cross-Device Sync)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Vynx-Velvet/flyx-main/tree/main/cf-sync-worker)

<details>
<summary>Manual deployment steps</summary>

```bash
cd cf-sync-worker
npm install

# Create D1 database
npx wrangler d1 create flyx-sync-db

# Copy the database_id from output to wrangler.toml

# Initialize schema
npx wrangler d1 execute flyx-sync-db --file=schema.sql

# Deploy worker
npx wrangler deploy
```

</details>

Then add env var: `NEXT_PUBLIC_CF_SYNC_URL=https://flyx-sync.YOUR-SUBDOMAIN.workers.dev`

---

### Analytics Worker (Real-time Analytics)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Vynx-Velvet/flyx-main/tree/main/cf-analytics-worker)

<details>
<summary>Manual deployment steps</summary>

```bash
cd cf-analytics-worker
npm install

# Create D1 database
npx wrangler d1 create flyx-analytics-db

# Copy the database_id from output to wrangler.toml

# Initialize schema
npx wrangler d1 execute flyx-analytics-db --file=schema.sql

# Deploy worker
npx wrangler deploy
```

</details>

Then add env var: `NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL=https://flyx-analytics.YOUR-SUBDOMAIN.workers.dev`

---

### Stream Proxy (HLS/Live TV)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Vynx-Velvet/flyx-main/tree/main/cloudflare-proxy)

<details>
<summary>Manual deployment steps</summary>

```bash
cd cloudflare-proxy
npm install
npx wrangler deploy
```

</details>

Then add env vars:
- `NEXT_PUBLIC_CF_STREAM_PROXY_URL=https://media-proxy.YOUR-SUBDOMAIN.workers.dev/stream`
- `NEXT_PUBLIC_CF_TV_PROXY_URL=https://media-proxy.YOUR-SUBDOMAIN.workers.dev`

---

## Local Development

```bash
# Clone and install
git clone https://github.com/Vynx-Velvet/flyx-main.git
cd flyx-main
npm install  # or: bun install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your TMDB API keys

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | TMDB Bearer token (Read Access Token) |
| `NEXT_PUBLIC_TMDB_API_KEY` | TMDB API key (v3 auth) |

### Optional (Enhanced Features)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CF_SYNC_URL` | Sync Worker URL (cross-device sync) |
| `NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL` | Analytics Worker URL |
| `NEXT_PUBLIC_CF_STREAM_PROXY_URL` | Stream proxy for HLS content |
| `NEXT_PUBLIC_CF_TV_PROXY_URL` | Live TV proxy URL |
| `DATABASE_URL` | Neon PostgreSQL (alternative to D1) |

See [.env.example](.env.example) for all options.

---

## Architecture

### Vercel + Cloudflare Workers
```
┌─────────────────┐     ┌──────────────────────────────────────┐
│                 │     │         Cloudflare Edge              │
│   Vercel        │     │  ┌─────────────┐  ┌──────────────┐  │
│   (Next.js)     │────▶│  │ Sync Worker │  │Analytics     │  │
│                 │     │  │ + D1 SQLite │  │Worker + D1   │  │
└─────────────────┘     │  └─────────────┘  └──────────────┘  │
                        │  ┌─────────────────────────────────┐ │
                        │  │      Stream Proxy Worker        │ │
                        │  └─────────────────────────────────┘ │
                        └──────────────────────────────────────┘
```

### 100% Cloudflare Stack
```
┌──────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Cloudflare Pages (Next.js)                │ │
│  │              via @opennextjs/cloudflare                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Sync Worker │  │Analytics     │  │  Stream Proxy     │  │
│  │ + D1 SQLite │  │Worker + D1   │  │  Worker           │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Why Cloudflare?**
- **Free tier**: 100k requests/day, 5GB D1 storage, unlimited Pages bandwidth
- **Global edge**: <50ms latency worldwide
- **No cold starts**: Always warm, instant responses
- **SQLite at edge**: D1 is SQLite, simple and fast

---

## Admin Panel

Access at `/admin` after deployment.

**Default credentials:** `vynx` / `defaultPassword`

⚠️ Change password immediately after first login!

```bash
# Create new admin
npm run admin:create <username> <password>

# Reset password  
npm run admin:reset-password <username> <new-password>
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Edge Database | Cloudflare D1 (SQLite) |
| Deployment | Vercel or Cloudflare Pages |
| API | TMDB |

---

## Project Structure

```
flyx-main/
├── app/                    # Next.js App Router
│   ├── (routes)/          # Page routes
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   ├── components/        # React components
│   └── lib/               # Utilities & services
├── cf-analytics-worker/   # Analytics Worker + D1
├── cf-sync-worker/        # Sync Worker + D1
├── cloudflare-proxy/      # Stream proxy worker
├── server/                # Server utilities
└── scripts/               # CLI scripts
```

---

## Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for Vercel
npm run build:cloudflare # Build for Cloudflare Pages
npm run deploy:cloudflare # Deploy to Cloudflare Pages
npm run preview:cloudflare # Preview Cloudflare build locally

# Database
npm run db:init          # Initialize database
npm run db:migrate       # Run migrations

# Admin
npm run admin:create     # Create admin user
```

---

## Credits

- **Movie & TV Data** - [TMDB](https://www.themoviedb.org/)
- **IPTV Help** - [MoldyTaint/Cinephage](https://github.com/MoldyTaint/Cinephage)

## License

MIT License - see [LICENSE](LICENSE)
