#!/bin/bash
# Install curl-impersonate on Raspberry Pi (ARM64)
# This tool mimics Chrome's TLS fingerprint

echo "Installing curl-impersonate for ARM64..."

# Check architecture
ARCH=$(uname -m)
echo "Architecture: $ARCH"

if [ "$ARCH" = "aarch64" ]; then
    # ARM64 (Raspberry Pi 4 64-bit)
    RELEASE_URL="https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.aarch64-linux-gnu.tar.gz"
elif [ "$ARCH" = "armv7l" ]; then
    echo "ERROR: ARM32 not supported by curl-impersonate"
    echo "You need to use Puppeteer instead"
    exit 1
else
    echo "ERROR: Unknown architecture: $ARCH"
    exit 1
fi

# Download and extract
cd /tmp
wget -O curl-impersonate.tar.gz "$RELEASE_URL"
tar -xzf curl-impersonate.tar.gz

# Install to /usr/local/bin
sudo cp curl-impersonate-chrome /usr/local/bin/
sudo cp curl_chrome* /usr/local/bin/
sudo chmod +x /usr/local/bin/curl_chrome*
sudo chmod +x /usr/local/bin/curl-impersonate-chrome

# Clean up
rm -rf curl-impersonate.tar.gz curl-impersonate-chrome curl_chrome* libcurl-impersonate*

echo ""
echo "Installation complete!"
echo "Test with: curl_chrome116 https://example.com"
