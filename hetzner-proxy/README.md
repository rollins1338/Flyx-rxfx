# Hetzner VPS IPTV Proxy

A simple proxy server for Stalker portal IPTV streams. Deploy on your Hetzner VPS to bypass datacenter IP blocking.

## Quick Setup

### 1. Copy to your VPS
```bash
scp -r hetzner-proxy/ root@your-vps-ip:/opt/
```

### 2. Install and run
```bash
ssh root@your-vps-ip
cd /opt/hetzner-proxy
npm install  # No dependencies needed, but good practice

# Set your API key
export API_KEY="your-secret-api-key-here"

# Run directly
node server.js

# Or use PM2 for production
npm install -g pm2
API_KEY="your-secret-key" pm2 start server.js --name iptv-proxy
pm2 save
pm2 startup
```

### 3. Configure firewall
```bash
# Allow port 3001 (or your chosen port)
ufw allow 3001/tcp
```

### 4. (Recommended) Setup nginx with SSL
```nginx
server {
    listen 443 ssl http2;
    server_name iptv-proxy.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/iptv-proxy.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/iptv-proxy.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # For streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

## Usage

### Health Check
```bash
curl https://iptv-proxy.yourdomain.com/health
```

### API Proxy (handshake, get channels, etc.)
```bash
curl "https://iptv-proxy.yourdomain.com/iptv/api?url=http://portal.com/portal.php?type=stb&action=handshake&mac=00:1A:79:00:00:00&key=your-api-key"
```

### Stream Proxy
```bash
curl "https://iptv-proxy.yourdomain.com/iptv/stream?url=http://stream-url&mac=00:1A:79:00:00:00&key=your-api-key"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |
| API_KEY | change-this-secret-key | API key for authentication |
| BIND_HOST | 0.0.0.0 | Host to bind to |

## Systemd Service (Alternative to PM2)

Create `/etc/systemd/system/iptv-proxy.service`:
```ini
[Unit]
Description=IPTV Proxy Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hetzner-proxy
Environment=API_KEY=your-secret-key
Environment=PORT=3001
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl daemon-reload
systemctl enable iptv-proxy
systemctl start iptv-proxy
systemctl status iptv-proxy
```
