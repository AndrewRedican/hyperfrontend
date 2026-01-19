#!/bin/bash
set -e

HUGO_VERSION="0.154.5"
HUGO_BIN="/usr/local/bin/hugo"

echo "Setting up Hugo Extended v${HUGO_VERSION}..."

# Remove any existing Hugo installations
sudo rm -f "${HUGO_BIN}"
sudo rm -rf /usr/local/hugo

# Download and install Hugo Extended
cd /tmp
wget -q "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
tar -xzf "hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
sudo mv hugo "${HUGO_BIN}"
sudo chmod +x "${HUGO_BIN}"
rm -f "hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" LICENSE README.md

echo "✓ Hugo Extended v${HUGO_VERSION} installed successfully"
hugo version
