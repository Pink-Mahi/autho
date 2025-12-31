#!/bin/bash

echo "========================================"
echo "Bitcoin Ownership Protocol - Installer"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo "Download the LTS version and run this installer again."
    exit 1
fi

echo "[1/5] Checking Node.js version..."
node --version
echo ""

echo "[2/5] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo ""

echo "[3/5] Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build project"
    exit 1
fi
echo ""

echo "[4/5] Generating operator keys..."
npm run generate-keys
echo ""

echo "[5/5] Creating configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Configuration file created: .env"
    echo ""
    echo "IMPORTANT: Edit .env file and add your Bitcoin address!"
else
    echo "Configuration file already exists."
fi
echo ""

echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file and set your Bitcoin address"
echo "2. Run: npm run operator"
echo "3. Open: http://localhost:3000/dashboard"
echo ""
echo "Your operator keys are saved in:"
echo "- operator-private-key.txt (KEEP SECRET!)"
echo "- operator-public-key.txt"
echo "- operator-address.txt"
echo ""
