#!/usr/bin/env bash
set -e

TOKEN_FILE="$(dirname "$0")/token.txt"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "❌ Missing token.txt"
  echo "   Copy token.txt from your master setup into this folder."
  echo "   Or get it from Cloudflare Dashboard → Protect & Connect → Tunnels → universal webhook tunnel"
  exit 1
fi
TOKEN=$(cat "$TOKEN_FILE")
PORT="${1:-3000}"
APP_NAME="${2:-your-app}"

# Trap Ctrl+C to exit cleanly without restart
trap "echo ''; echo 'Tunnel stopped by user'; exit 0" SIGINT SIGTERM

echo ""
echo "=============================================="
echo "  Universal Webhook - Tunnel Connector"
echo "=============================================="
echo "  App:   $APP_NAME"
echo "  Port:  $PORT"
echo "  Host:  https://bot.mymua.in"
echo ""

# 1. Install cloudflared if missing
if ! command -v cloudflared &>/dev/null; then
  echo "[1/3] Installing cloudflared..."
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
    chmod +x /tmp/cloudflared
    sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install cloudflare/cloudflare/cloudflared
  else
    echo "Unsupported OS. Install manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
  echo "  cloudflared installed ($(cloudflared version | head -1))"
else
  echo "[1/3] cloudflared already installed ($(cloudflared version | head -1))"
fi

# 2. Kill old tunnel processes
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

# 3. Connect the tunnel
echo "[2/3] Connecting tunnel..."
echo ""

while true; do
  # Run tunnel - output goes directly to terminal
  cloudflared tunnel run --token "$TOKEN" 2>&1 || true
  
  echo ""
  echo "=============================================="
  echo "  Tunnel disconnected. Restarting in 3s..."
  echo "  Press Ctrl+C to stop."
  echo "=============================================="
  sleep 3
done
