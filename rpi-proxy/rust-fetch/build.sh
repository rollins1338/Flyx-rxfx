#!/bin/bash
# Build rust-fetch for ARM64 (Raspberry Pi)

set -e

echo "Building rust-fetch for ARM64..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Rust not installed. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Add ARM64 target if not present
rustup target add aarch64-unknown-linux-gnu 2>/dev/null || true

# Build release binary
cargo build --release

echo ""
echo "Build complete!"
echo "Binary location: target/release/rust-fetch"
echo "Size: $(du -h target/release/rust-fetch | cut -f1)"
echo ""
echo "To install system-wide:"
echo "  sudo cp target/release/rust-fetch /usr/local/bin/"
echo ""
echo "To test:"
echo "  ./target/release/rust-fetch --url https://example.com"
