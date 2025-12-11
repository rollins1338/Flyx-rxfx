# Flyx 2.0 - Modern Streaming Platform

A full-featured movie and TV show streaming platform built with Next.js 14, featuring multiple video sources, live TV, comprehensive analytics, and flexible deployment options.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Content Discovery
- Browse trending movies and TV shows
- Advanced search with filters
- Detailed movie/show information with cast, ratings, and trailers
- Episode-by-episode navigation for TV series
- Continue watching functionality

### Video Playback
- Multiple video source providers (2embed, VidSrc, and more)
- Adaptive HLS streaming with quality selection
- Live TV support with DLHD integration
- IPTV/Stalker portal support
- Resume playback from where you left off

### Analytics & Admin
- Comprehensive admin dashboard
- Real-time live activity monitoring
- Watch session tracking with completion rates
- User analytics (DAU/WAU/MAU metrics)
- Device and quality breakdowns
- Geographic distribution insights

### Privacy-First Design
- Anonymous user tracking (no PII collected)
- IP address hashing
- Local storage for user preferences
- GDPR-compliant data collection

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Neon PostgreSQL (prod) / SQLite (dev) |
| Deployment | Vercel |
| Proxy | Cloudflare Workers |
| API | TMDB |

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- TMDB API key ([get one here](https://www.themoviedb.org/settings/api))
- Neon database (for production)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/flyx.git
cd flyx

# Install dependencies
npm install
# or
bun install

# Copy environment file
cp .env.example .env.local

# Add your TMDB API key to .env.local
# TMDB_API_KEY=your_bearer_token
# NEXT_PUBLIC_TMDB_API_KEY=your_api_key

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | TMDB Bearer token (Read Access Token) |
| `NEXT_PUBLIC_TMDB_API_KEY` | TMDB API key (for client-side) |
| `DATABASE_URL` | Neon PostgreSQL connection string (production) |

### Optional

| Variable | Description |
|----------|-------------|
| `IP_SALT` | Salt for IP address hashing (privacy) |
| `CRON_SECRET` | Secret for automated metrics updates |
| `NEXT_PUBLIC_CF_STREAM_PROXY_URL` | Cloudflare stream proxy URL |
| `NEXT_PUBLIC_CF_TV_PROXY_URL` | Cloudflare TV proxy URL |
| `RPI_PROXY_URL` | Raspberry Pi proxy URL |
| `RPI_PROXY_KEY` | Raspberry Pi proxy API key |

See `.env.example` for the complete list with descriptions.

---

## Deployment

### Vercel (Recommended)

1. **Create Neon Database**
   - Sign up at [neon.tech](https://neon.tech)
   - Create a new project
   - Copy the connection string

2. **Deploy to Vercel**
   - Import your repository to Vercel
   - Add environment variables:
     - `DATABASE_URL` - Your Neon connection string
     - `TMDB_API_KEY` - Your TMDB Bearer token
     - `NEXT_PUBLIC_TMDB_API_KEY` - Your TMDB API key
   - Deploy!

3. **Access Admin Panel**
   - Navigate to `/admin`
   - Default credentials: `vynx` / `defaultPassword`
   - **Change the password immediately!**

> 📚 See [QUICK_START_VERCEL.md](QUICK_START_VERCEL.md) for detailed instructions

---

## Database Setup

### Neon PostgreSQL (Production)

Neon is a serverless PostgreSQL database perfect for Vercel deployments.

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection string (includes `?sslmode=require`)
4. Add as `DATABASE_URL` in Vercel

**Features:**
- Serverless & auto-scaling
- Connection pooling built-in
- Free tier available
- Automatic backups

> 📚 See [NEON_SETUP.md](NEON_SETUP.md) for complete setup guide

### SQLite (Local Development)

For local development, the app automatically uses SQLite when `DATABASE_URL` is not set. No configuration needed!

---

## Proxy Setup

Flyx supports multiple proxy configurations for different use cases.

### Cloudflare Workers (Recommended)

The Cloudflare proxy handles HLS stream proxying and live TV with proper CORS headers.

```bash
cd cloudflare-proxy

# Install dependencies
npm install

# Configure wrangler.toml with your settings

# Deploy
npx wrangler deploy
```

**Features:**
- Stream proxy for HLS content
- Live TV proxy for DLHD
- Decoder sandbox for secure script execution
- Health monitoring endpoint

**Environment Variables (after deployment):**
```env
NEXT_PUBLIC_CF_STREAM_PROXY_URL=https://media-proxy.your-subdomain.workers.dev/stream
NEXT_PUBLIC_CF_TV_PROXY_URL=https://media-proxy.your-subdomain.workers.dev
```

> 📚 See [cloudflare-proxy/README.md](cloudflare-proxy/README.md) for detailed setup

### Raspberry Pi Proxy

For bypassing datacenter IP restrictions using a residential IP.

```bash
# Copy to your Pi
scp -r rpi-proxy pi@raspberrypi.local:~/

# SSH and run
ssh pi@raspberrypi.local
cd rpi-proxy
export API_KEY=$(openssl rand -hex 32)
node server.js
```

**Expose to internet:**
- Cloudflare Tunnel (recommended)
- ngrok
- Port forwarding

> 📚 See [rpi-proxy/README.md](rpi-proxy/README.md) for complete setup

### Hetzner VPS Proxy

For IPTV/Stalker portal streams that block datacenter IPs.

```bash
# Copy to VPS
scp -r hetzner-proxy root@your-vps:/opt/

# Install and run
ssh root@your-vps
cd /opt/hetzner-proxy
export API_KEY="your-secret-key"
node server.js
```

> 📚 See [hetzner-proxy/README.md](hetzner-proxy/README.md) for complete setup

---

## Admin Panel

Access the admin panel at `/admin` to manage your platform.

### Features

| Section | Description |
|---------|-------------|
| Dashboard | Overview of platform statistics |
| Analytics | Watch sessions, completion rates, device breakdown |
| Live Activity | Real-time user monitoring |
| User Metrics | DAU/WAU/MAU, retention, growth rates |

### Default Credentials

- **Username:** `vynx`
- **Password:** `defaultPassword`

⚠️ **Change these immediately after first login!**

### Admin Commands

```bash
# Create admin user
npm run admin:create <username> <password>

# Reset password
npm run admin:reset-password <username> <new-password>

# List admins
npm run admin:list

# Delete admin
npm run admin:delete <username>
```

> 📚 See [ADMIN_SETUP.md](ADMIN_SETUP.md) for complete admin guide

---

## Analytics

Flyx includes a comprehensive, privacy-focused analytics system.

### Watch Session Tracking

- Content watched (title, type, season/episode)
- Watch time and completion percentage
- Pause/seek behavior
- Quality settings
- Device type

### User Metrics

- Daily/Weekly/Monthly Active Users
- New vs returning users
- Retention rates
- Engagement metrics

### Live Activity

- Real-time user count
- Current watching activity
- Geographic distribution
- Most watched content

> 📚 See these guides for more:
> - [ANALYTICS_TRACKING.md](ANALYTICS_TRACKING.md)
> - [ADMIN_ANALYTICS_GUIDE.md](ADMIN_ANALYTICS_GUIDE.md)
> - [USER_ANALYTICS_GUIDE.md](USER_ANALYTICS_GUIDE.md)
> - [LIVE_ACTIVITY_GUIDE.md](LIVE_ACTIVITY_GUIDE.md)

---

## Project Structure

```
flyx/
├── app/                    # Next.js App Router
│   ├── components/         # React components
│   ├── context/           # React context providers
│   ├── lib/               # Utilities and services
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API and analytics services
│   ├── api/               # API routes
│   └── admin/             # Admin panel pages
├── server/                # Server-side code
│   └── db/                # Database utilities
├── cloudflare-proxy/      # Cloudflare Worker proxy
├── rpi-proxy/             # Raspberry Pi proxy
├── hetzner-proxy/         # Hetzner VPS proxy
├── scripts/               # Utility scripts
└── public/                # Static assets
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run type-check` | TypeScript type checking |
| `npm run db:init` | Initialize database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:status` | Check migration status |
| `npm run verify-env` | Verify environment setup |

---

## Documentation

| Guide | Description |
|-------|-------------|
| [QUICK_START_VERCEL.md](QUICK_START_VERCEL.md) | 5-minute Vercel deployment |
| [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) | Complete Vercel guide |
| [VERCEL_SETUP_CHECKLIST.md](VERCEL_SETUP_CHECKLIST.md) | Step-by-step checklist |
| [NEON_SETUP.md](NEON_SETUP.md) | Neon PostgreSQL setup |
| [ADMIN_SETUP.md](ADMIN_SETUP.md) | Admin panel configuration |
| [ANALYTICS_TRACKING.md](ANALYTICS_TRACKING.md) | Analytics system overview |
| [ADMIN_ANALYTICS_GUIDE.md](ADMIN_ANALYTICS_GUIDE.md) | Using the analytics dashboard |
| [USER_ANALYTICS_GUIDE.md](USER_ANALYTICS_GUIDE.md) | User metrics guide |
| [LIVE_ACTIVITY_GUIDE.md](LIVE_ACTIVITY_GUIDE.md) | Real-time monitoring |
| [ANONYMIZED_USER_TRACKING.md](ANONYMIZED_USER_TRACKING.md) | Privacy & tracking details |

---

## API Integration

### TMDB API

The app uses TMDB for all movie and TV show metadata:
- Trending content
- Search functionality
- Movie/show details
- Cast and crew information
- Season and episode data

**Getting a TMDB API Key:**
1. Create account at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to [API settings](https://www.themoviedb.org/settings/api)
3. Request an API key (Developer option)
4. Copy both the API Key and Bearer Token

---

## Troubleshooting

### Database Connection Issues

```bash
# Verify environment
npm run verify-env

# Check database status
npm run db:status

# Initialize database
npm run db:init
```

### Vercel Deployment Errors

1. Ensure `DATABASE_URL` is set in Vercel environment variables
2. Check that all three environments are selected (Production, Preview, Development)
3. Redeploy after adding variables

### Stream Not Loading

1. Check Cloudflare Worker is deployed
2. Verify proxy URLs in environment variables
3. Check browser console for CORS errors
4. Test health endpoint: `curl https://your-proxy.workers.dev/health`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Credits

### Special Thanks

**IPTV** - Huge thanks to [MoldyTaint/Cinephage](https://github.com/MoldyTaint/Cinephage) for his amazing help with sourcing IPTV!

### Resources

- **Movie & TV Data** - [TMDB (The Movie Database)](https://www.themoviedb.org/)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

If you encounter issues:
1. Check the relevant documentation guide
2. Review deployment logs
3. Verify environment variables
4. Open an issue on GitHub

---

Made with ❤️
