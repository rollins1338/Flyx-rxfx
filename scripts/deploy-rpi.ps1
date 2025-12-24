# Deploy RPI Proxy Server
# Run this script to deploy the updated server.js to the Raspberry Pi

Write-Host "=== Deploying RPI Proxy Server ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy the server.js file
Write-Host "Step 1: Copying server.js to RPI..." -ForegroundColor Yellow
scp rpi-proxy/server.js vynx@vynx-pi.local:~/rpi-proxy/

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to copy server.js" -ForegroundColor Red
    exit 1
}

Write-Host "✓ File copied successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Restart the service
Write-Host "Step 2: Restarting rpi-proxy service..." -ForegroundColor Yellow
ssh vynx@vynx-pi.local "sudo systemctl restart rpi-proxy"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to restart service" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Service restarted successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Verify the service is running
Write-Host "Step 3: Verifying service status..." -ForegroundColor Yellow
ssh vynx@vynx-pi.local "sudo systemctl status rpi-proxy --no-pager | head -10"

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test the deployment with:" -ForegroundColor White
Write-Host "  node scripts/test-enc-dec-api.js" -ForegroundColor Gray
