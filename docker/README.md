# Flyx 2.0 - Self-Hosted Docker Setup

Run Flyx on your local network at `http://flyx.local`.

## Quick Start

```bash
# 1. Create your env file
cp docker/.env.example docker/.env
# Edit docker/.env — add your TMDB API key (free at themoviedb.org)

# 2. Run the setup script
# Linux/Mac:
chmod +x flyx.sh
./flyx.sh

# Windows (run PowerShell as Administrator):
.\flyx.ps1
```

That's it. The script:
- Detects your LAN IP automatically
- Adds `flyx.local` to your hosts file
- Starts a local DNS server so other devices can resolve `flyx.local`
- Builds and launches all services
- Prints instructions for connecting other devices

## Commands

| Command | Description |
|---------|-------------|
| `./flyx.sh` | First-time setup + start |
| `./flyx.sh start` | Start all services |
| `./flyx.sh stop` | Stop all services |
| `./flyx.sh restart` | Restart everything |
| `./flyx.sh status` | Show service status |
| `./flyx.sh logs` | Tail all logs |
| `./flyx.sh dns` | Re-configure DNS only |
| `./flyx.sh clean` | Stop, remove volumes, undo DNS |

Windows: replace `./flyx.sh` with `.\flyx.ps1`.

## Other Devices on Your Network

The setup includes a DNS server that resolves `flyx.local` for any device.

**Per-device:** Set the device's DNS server to your host machine's IP.

**Network-wide:** Set your router's DHCP primary DNS to your host machine's IP.

The script prints your IP and device-specific instructions when it starts.

## Architecture

```
 Devices on LAN
      │
      ▼
┌──────────┐  DNS query   ┌──────────┐
│  Browser  │─────────────▶│   DNS    │  resolves flyx.local
│           │              │   :53    │  forwards all else upstream
└─────┬─────┘              └──────────┘
      │ http://flyx.local
      ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Caddy   │────▶│  Flyx    │────▶│  Proxy   │
│  :80     │     │  :3000   │     │  :8787   │
└──────────┘     └────┬─────┘     └──────────┘
                      │
                 ┌────▼─────┐
                 │  SQLite  │
                 └──────────┘
```

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 53   | DNS     | Resolves `flyx.local`, forwards everything else |
| 80   | Caddy   | Main entry — `http://flyx.local` |
| 3000 | Flyx    | Next.js app (direct) |
| 8787 | Proxy   | Stream proxy (replaces Cloudflare Workers) |

## Environment Variables

See `docker/.env.example`. Only one is required:

- `NEXT_PUBLIC_TMDB_API_KEY` / `TMDB_API_KEY` — free at [themoviedb.org](https://www.themoviedb.org/settings/api)

## Troubleshooting

```bash
# Check all services
docker compose ps

# View logs
docker compose logs dns
docker compose logs flyx
docker compose logs proxy

# Test DNS resolution
nslookup flyx.local 127.0.0.1

# Test proxy
curl http://localhost:8787/health

# Full rebuild
./flyx.sh clean
./flyx.sh start
```

### Port 53 already in use (Linux)

If systemd-resolved is using port 53:
```bash
sudo systemctl stop systemd-resolved
sudo systemctl disable systemd-resolved
# Then re-run ./flyx.sh
```

Or edit `/etc/systemd/resolved.conf` and set `DNSStubListener=no`, then restart.
