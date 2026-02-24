# Deploy rust-fetch to RPI from Windows

$RPI_USER = "pi"
$RPI_HOST = "rpi-proxy.vynx.cc"  # or use IP address
$RPI_PATH = "/home/pi/rpi-proxy"
$RPI_KEY = "5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560"

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Deploy rust-fetch to RPI              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy rust-fetch directory to RPI
Write-Host "[1/5] Copying rust-fetch to RPI..." -ForegroundColor Yellow
scp -r rpi-proxy/rust-fetch "${RPI_USER}@${RPI_HOST}:${RPI_PATH}/"

# Step 2: Copy updated server.js
Write-Host "[2/5] Copying updated server.js..." -ForegroundColor Yellow
scp rpi-proxy/server.js "${RPI_USER}@${RPI_HOST}:${RPI_PATH}/"

# Step 3: SSH and build
Write-Host "[3/5] Building rust-fetch on RPI..." -ForegroundColor Yellow
$buildScript = @'
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
'@

ssh "${RPI_USER}@${RPI_HOST}" $buildScript

# Step 4: Restart RPI proxy
Write-Host "[4/5] Restarting RPI proxy..." -ForegroundColor Yellow
ssh "${RPI_USER}@${RPI_HOST}" "cd ~/rpi-proxy && pm2 restart rpi-proxy"

# Step 5: Test endpoint
Write-Host "[5/5] Testing /fetch-rust endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$testUrl = "https://rpi-proxy.vynx.cc/fetch-rust?url=https%3A%2F%2Fexample.com&key=$RPI_KEY"
curl -s $testUrl | Select-Object -First 5

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Deployment Complete!                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Deploy CF Worker: cd cloudflare-proxy ; npm run deploy" -ForegroundColor White
Write-Host "  2. Deploy Next.js: vercel --prod" -ForegroundColor White
Write-Host "  3. Test: node scripts\test-production-quick.js" -ForegroundColor White
