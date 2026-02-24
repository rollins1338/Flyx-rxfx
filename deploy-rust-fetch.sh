#!/bin/bash
# Deploy rust-fetch to RPI

set -e

# Configuration
RPI_USER="pi"
RPI_HOST="rpi-proxy.vynx.cc"  # or use IP address
RPI_PATH="/home/pi/rpi-proxy"

echo "╔════════════════════════════════════════╗"
echo "║  Deploy rust-fetch to RPI              ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Step 1: Copy rust-fetch directory to RPI
echo "[1/5] Copying rust-fetch to RPI..."
scp -r rpi-proxy/rust-fetch ${RPI_USER}@${RPI_HOST}:${RPI_PATH}/

# Step 2: Copy updated server.js
echo "[2/5] Copying updated server.js..."
scp rpi-proxy/server.js ${RPI_USER}@${RPI_HOST}:${RPI_PATH}/

# Step 3: SSH and build
echo "[3/5] Building rust-fetch on RPI..."
ssh ${RPI_USER}@${RPI_HOST} << 'ENDSSH'
cd ~/rpi-proxy/rust-fetch

# Install Rust if not present
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Build
echo "Building release binary..."
bash build.sh

# Install
echo "Installing to /usr/local/bin..."
sudo cp target/release/rust-fetch /usr/local/bin/
sudo chmod +x /usr/local/bin/rust-fetch

# Test
echo "Testing rust-fetch..."
rust-fetch --url https://example.com --timeout 5 > /dev/null 2>&1 && echo "✓ rust-fetch works!" || echo "✗ rust-fetch failed"

ENDSSH

# Step 4: Restart RPI proxy
echo "[4/5] Restarting RPI proxy..."
ssh ${RPI_USER}@${RPI_HOST} "cd ~/rpi-proxy && pm2 restart rpi-proxy"

# Step 5: Test endpoint
echo "[5/5] Testing /fetch-rust endpoint..."
sleep 2
curl -s "https://rpi-proxy.vynx.cc/fetch-rust?url=https%3A%2F%2Fexample.com&key=5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560" | head -n 5

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  Deployment Complete!                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Deploy CF Worker: cd cloudflare-proxy && npm run deploy"
echo "  2. Deploy Next.js: vercel --prod"
echo "  3. Test: node scripts/test-production-quick.js"
