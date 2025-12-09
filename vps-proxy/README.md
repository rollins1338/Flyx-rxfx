# VPS Proxy for DLHD Live TV

A lightweight proxy server for bypassing CORS and geo-restrictions on DLHD live TV streams.

## Quick Setup (5 minutes)

### 1. Get a VPS

**Recommended providers with unlimited bandwidth:**

| Provider | Price | Get Started |
|----------|-------|-------------|
| **Hetzner** | €4.51/mo | [hetzner.com/cloud](https://www.hetzner.com/cloud) |
| **Contabo** | €4.99/mo | [contabo.com](https://contabo.com/en/vps/) |
| **Oracle Cloud** | FREE | [cloud.oracle.com](https://www.oracle.com/cloud/free/) |

Choose Ubuntu 22.04 LTS when creating your VPS.

### 2. SSH into your VPS

```bash
ssh root@your-vps-ip
```

### 3. Install Node.js

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should show v20.x.x
```

### 4. Deploy the proxy

```bash
# Create directory
mkdir -p /opt/vps-proxy
cd /opt/vps-proxy

# Create server.js (copy from this repo or use wget)
# Option 1: Copy from your local machine
# scp vps-proxy/server.js root@your-vps-ip:/opt/vps-proxy/

# Option 2: Create manually
nano server.js
# Paste the contents of server.js

# Generate API key
export API_KEY=$(openssl rand -hex 32)
echo "Your API Key: $API_KEY"
echo "SAVE THIS KEY!"
```

### 5. Run with systemd (auto-start on boot)

```bash
# Create systemd service
cat > /etc/systemd/system/vps-proxy.service << 'EOF'
[Unit]
Description=VPS Proxy for DLHD Live TV
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vps-proxy
Environment=API_KEY=YOUR_API_KEY_HERE
Environment=PORT=3001
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Edit the service file to add your API key
nano /etc/systemd/system/vps-proxy.service
# Replace YOUR_API_KEY_HERE with your actual key

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable vps-proxy
sudo systemctl start vps-proxy

# Check status
sudo systemctl status vps-proxy
```

### 6. Open firewall port

```bash
# UFW (Ubuntu)
sudo ufw allow 3001/tcp

# Or iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

### 7. Configure Cloudflare Worker

Add these secrets to your Cloudflare Worker:

```bash
cd cloudflare-proxy
wrangler secret put RPI_PROXY_URL
# Enter: http://your-vps-ip:3001

wrangler secret put RPI_PROXY_KEY
# Enter: your API key from step 4
```

### 8. Test it

```bash
# Health check
curl http://your-vps-ip:3001/health

# Test proxy (replace with your API key)
curl -H "X-API-Key: your-api-key" \
  "http://your-vps-ip:3001/proxy?url=https://example.com"
```

## Optional: HTTPS with Caddy

For HTTPS support (recommended for production):

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddy (replace proxy.yourdomain.com with your domain)
cat > /etc/caddy/Caddyfile << 'EOF'
proxy.yourdomain.com {
    reverse_proxy localhost:3001
}
EOF

# Restart Caddy
sudo systemctl restart caddy
```

Then update your Cloudflare Worker:
```bash
wrangler secret put RPI_PROXY_URL
# Enter: https://proxy.yourdomain.com
```

## Monitoring

```bash
# View logs
sudo journalctl -u vps-proxy -f

# Check status
sudo systemctl status vps-proxy

# Restart if needed
sudo systemctl restart vps-proxy
```

## Troubleshooting

**Connection refused:**
- Check if service is running: `systemctl status vps-proxy`
- Check firewall: `sudo ufw status`

**401 Unauthorized:**
- Verify API key matches in both VPS and Cloudflare Worker

**502 Bad Gateway:**
- Target URL might be blocking VPS IP
- Check logs: `journalctl -u vps-proxy -f`
