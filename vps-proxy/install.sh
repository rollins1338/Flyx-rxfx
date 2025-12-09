#!/bin/bash
#
# VPS Proxy Quick Install Script
# Run on a fresh Ubuntu 22.04 VPS
#
# Usage: curl -sSL https://raw.githubusercontent.com/your-repo/main/vps-proxy/install.sh | bash
#

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         VPS Proxy Installer for DLHD Live TV               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash install.sh"
  exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"

# Create directory
mkdir -p /opt/vps-proxy
cd /opt/vps-proxy

# Generate API key
API_KEY=$(openssl rand -hex 32)
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  YOUR API KEY (SAVE THIS!):"
echo "  $API_KEY"
echo "════════════════════════════════════════════════════════════"
echo ""

# Download server.js (or create it)
cat > /opt/vps-proxy/server.js << 'SERVERJS'
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('ERROR: API_KEY environment variable is required');
  process.exit(1);
}

const rateLimits = new Map();
const RATE_LIMIT = 200;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + RATE_WINDOW; }
  record.count++;
  rateLimits.set(ip, record);
  return record.count <= RATE_LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimits) {
    if (now > record.resetAt + RATE_WINDOW) rateLimits.delete(ip);
  }
}, 300000);

const server = http.createServer(async (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() }));
    return;
  }
  
  if (url.pathname === '/proxy') {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }
    
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }
    
    try {
      const response = await proxyRequest(targetUrl);
      res.writeHead(response.statusCode, { 'Content-Type': response.headers['content-type'] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      response.pipe(res);
    } catch (error) {
      console.error(`Proxy error: ${error.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', details: error.message }));
    }
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', routes: { proxy: '/proxy?url=<url>', health: '/health' } }));
});

function proxyRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const referer = 'https://epicplayplay.cfd/';
    
    const request = client.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer, 'Origin': referer.replace(/\/$/, ''),
      },
      timeout: 30000,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        proxyRequest(response.headers.location).then(resolve).catch(reject);
        return;
      }
      resolve(response);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
    request.end();
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`VPS Proxy running on port ${PORT}`);
});
SERVERJS

# Create systemd service
cat > /etc/systemd/system/vps-proxy.service << EOF
[Unit]
Description=VPS Proxy for DLHD Live TV
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vps-proxy
Environment=API_KEY=$API_KEY
Environment=PORT=3001
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable vps-proxy
systemctl start vps-proxy

# Open firewall
if command -v ufw &> /dev/null; then
  ufw allow 3001/tcp
fi

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "your-vps-ip")

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    INSTALLATION COMPLETE!                  ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  Proxy URL: http://$PUBLIC_IP:3001                    ║"
echo "║  API Key:   $API_KEY  ║"
echo "║                                                            ║"
echo "║  Next steps:                                               ║"
echo "║  1. Configure Cloudflare Worker:                           ║"
echo "║     cd cloudflare-proxy                                    ║"
echo "║     wrangler secret put RPI_PROXY_URL                      ║"
echo "║       → Enter: http://$PUBLIC_IP:3001                 ║"
echo "║     wrangler secret put RPI_PROXY_KEY                      ║"
echo "║       → Enter: $API_KEY  ║"
echo "║                                                            ║"
echo "║  2. Test: curl http://$PUBLIC_IP:3001/health          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
