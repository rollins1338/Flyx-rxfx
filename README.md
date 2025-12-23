# Flyx

A modern streaming platform built with Next.js 15, featuring movies, TV shows, live TV, and cross-device sync.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fflyx&env=TMDB_API_KEY,NEXT_PUBLIC_TMDB_API_KEY&envDescription=TMDB%20API%20keys%20required%20for%20movie%20and%20TV%20data&envLink=https%3A%2F%2Fwww.themoviedb.org%2Fsettings%2Fapi&project-name=flyx&repository-name=flyx)

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

## Quick Deploy

### Option 1: Vercel (Recommended)

Click the button above or:

1. Fork this repository
2. Import to [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `TMDB_API_KEY` - [Get from TMDB](https://www.themoviedb.org/settings/api) (Bearer token)
   - `NEXT_PUBLIC_TMDB_API_KEY` - TMDB API key (v3 auth)
4. Deploy!

### Option 2: Cloudflare Pages

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yourusername/flyx)

> Note: Requires additional configuration for API routes. See [Cloudflare Setup](#cloudflare-workers) below.

## Local Development

```bash
# Clone and install
git clone https://github.com/yourusername/flyx.git
cd flyx
npm install  # or: bun install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your TMDB API keys

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | TMDB Bearer token (Read Access Token) |
| `NEXT_PUBLIC_TMDB_API_KEY` | TMDB API key (v3 auth) |

### Optional (Enhanced Features)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL URL (enables analytics) |
| `NEXT_PUBLIC_CF_SYNC_URL` | Cloudflare Sync Worker URL (cross-device sync) |
| `NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL` | Cloudflare Analytics Worker URL |
| `NEXT_PUBLIC_CF_STREAM_PROXY_URL` | Stream proxy for HLS content |
| `NEXT_PUBLIC_CF_TV_PROXY_URL` | Live TV proxy URL |

See [.env.example](.env.example) for all options.

## Cloudflare Workers

Deploy the included workers for enhanced performance:

### Sync Worker (Cross-Device Sync)

```bash
cd cf-sync-worker
npm install
npx wrangler deploy
```

Set `NEXT_PUBLIC_CF_SYNC_URL` to your worker URL.

### Analytics Worker

```bash
cd cf-analytics-worker
npm install
# Add DATABASE_URL secret: npx wrangler secret put DATABASE_URL
npx wrangler deploy
```

Set `NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL` to your worker URL.

### Stream Proxy

```bash
cd cloudflare-proxy
npm install
npx wrangler deploy
```

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

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Neon PostgreSQL / SQLite (dev) |
| Deployment | Vercel / Cloudflare |
| API | TMDB |

## Project Structure

```
flyx/
├── app/                    # Next.js App Router
│   ├── (routes)/          # Page routes
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   ├── components/        # React components
│   └── lib/               # Utilities & services
├── cf-analytics-worker/   # Cloudflare Analytics Worker
├── cf-sync-worker/        # Cloudflare Sync Worker
├── cloudflare-proxy/      # Stream proxy worker
├── server/                # Server utilities
└── scripts/               # CLI scripts
```

## Documentation

| Guide | Description |
|-------|-------------|
| [QUICK_START_VERCEL.md](QUICK_START_VERCEL.md) | 5-minute Vercel deployment |
| [NEON_SETUP.md](NEON_SETUP.md) | Database setup |
| [ADMIN_SETUP.md](ADMIN_SETUP.md) | Admin configuration |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run db:init      # Initialize database
npm run db:migrate   # Run migrations
npm run admin:create # Create admin user
```

## Credits

- **Movie & TV Data** - [TMDB](https://www.themoviedb.org/)
- **IPTV Help** - [MoldyTaint/Cinephage](https://github.com/MoldyTaint/Cinephage)

## License

MIT License - see [LICENSE](LICENSE)
