#!/usr/bin/env bash
###############################################################################
# Flyx 2.0 - Self-Hosted Setup & Launcher
#
# Usage:
#   ./flyx.sh          - Full setup + start (first time)
#   ./flyx.sh start    - Start all services
#   ./flyx.sh stop     - Stop all services
#   ./flyx.sh restart  - Restart all services
#   ./flyx.sh status   - Show service status
#   ./flyx.sh logs     - Tail logs
#   ./flyx.sh dns      - Re-configure DNS only
#   ./flyx.sh clean    - Stop + remove volumes + undo DNS
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/docker/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
HOSTS_MARKER="# flyx-self-hosted"
DOMAIN="flyx.local"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[flyx]${NC} $*"; }
warn() { echo -e "${YELLOW}[flyx]${NC} $*"; }
err()  { echo -e "${RED}[flyx]${NC} $*" >&2; }

# Detect the host's LAN IP (not 127.0.0.1, not docker bridge)
detect_lan_ip() {
  local ip=""

  # macOS
  if command -v ipconfig &>/dev/null && [[ "$(uname)" == "Darwin" ]]; then
    ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  fi

  # Linux - try ip command first
  if [[ -z "$ip" ]] && command -v ip &>/dev/null; then
    ip=$(ip -4 route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[\d.]+' || true)
  fi

  # Fallback - hostname
  if [[ -z "$ip" ]] && command -v hostname &>/dev/null; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi

  # Last resort
  if [[ -z "$ip" ]]; then
    ip="127.0.0.1"
    warn "Could not detect LAN IP, falling back to 127.0.0.1"
    warn "Set HOST_IP manually in docker/.env if needed"
  fi

  echo "$ip"
}

# Detect the system's current upstream DNS server
detect_upstream_dns() {
  local dns=""

  # Try systemd-resolve
  if command -v resolvectl &>/dev/null; then
    dns=$(resolvectl status 2>/dev/null | grep -m1 'DNS Servers' | awk '{print $NF}' || true)
  fi

  # Try /etc/resolv.conf
  if [[ -z "$dns" ]] && [[ -f /etc/resolv.conf ]]; then
    dns=$(grep -m1 '^nameserver' /etc/resolv.conf | awk '{print $2}' || true)
    # Skip localhost entries (likely systemd-resolved stub)
    if [[ "$dns" == "127.0.0.53" || "$dns" == "127.0.0.1" ]]; then
      # Try to get the real upstream
      if command -v resolvectl &>/dev/null; then
        dns=$(resolvectl status 2>/dev/null | grep -oP 'DNS Servers:\s*\K[\d.]+' | head -1 || true)
      fi
      [[ -z "$dns" ]] && dns="8.8.8.8"
    fi
  fi

  # macOS
  if [[ -z "$dns" ]] && command -v scutil &>/dev/null; then
    dns=$(scutil --dns 2>/dev/null | grep -m1 'nameserver\[0\]' | awk '{print $NF}' || true)
  fi

  [[ -z "$dns" ]] && dns="8.8.8.8"
  echo "$dns"
}

# Add flyx.local to /etc/hosts
setup_hosts() {
  local ip="$1"

  if grep -q "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
    # Update existing entry
    log "Updating /etc/hosts entry for $DOMAIN → $ip"
    sudo sed -i.bak "/$HOSTS_MARKER/c\\$ip  $DOMAIN $HOSTS_MARKER" /etc/hosts
  else
    log "Adding $DOMAIN → $ip to /etc/hosts"
    echo "$ip  $DOMAIN $HOSTS_MARKER" | sudo tee -a /etc/hosts >/dev/null
  fi
}

# Remove flyx.local from /etc/hosts
remove_hosts() {
  if grep -q "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
    log "Removing $DOMAIN from /etc/hosts"
    sudo sed -i.bak "/$HOSTS_MARKER/d" /etc/hosts
  fi
}

# Ensure docker/.env exists with required values
ensure_env() {
  local ip="$1"
  local upstream_dns="$2"

  if [[ ! -f "$ENV_FILE" ]]; then
    log "Creating docker/.env from template..."
    cp "$SCRIPT_DIR/docker/.env.example" "$ENV_FILE"
    warn "Edit ${BOLD}docker/.env${NC} and add your TMDB API key before continuing."
    warn "Get a free key at: https://www.themoviedb.org/settings/api"
    echo ""
    read -p "Press Enter after editing docker/.env (or Ctrl+C to abort)..."
  fi

  # Inject/update HOST_IP and UPSTREAM_DNS
  if grep -q '^HOST_IP=' "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^HOST_IP=.*|HOST_IP=$ip|" "$ENV_FILE"
  else
    echo "" >> "$ENV_FILE"
    echo "# Auto-detected by flyx.sh" >> "$ENV_FILE"
    echo "HOST_IP=$ip" >> "$ENV_FILE"
  fi

  if grep -q '^UPSTREAM_DNS=' "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^UPSTREAM_DNS=.*|UPSTREAM_DNS=$upstream_dns|" "$ENV_FILE"
  else
    echo "UPSTREAM_DNS=$upstream_dns" >> "$ENV_FILE"
  fi

  # Clean up backup files from sed -i
  rm -f "$ENV_FILE.bak"
}

# Print network info for other devices
print_network_info() {
  local ip="$1"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Flyx is running at: ${GREEN}http://flyx.local${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}This machine:${NC} http://flyx.local works automatically"
  echo ""
  echo -e "  ${BOLD}Other devices on your network:${NC}"
  echo -e "  Option A: Set device DNS to ${BOLD}$ip${NC} (uses built-in DNS server)"
  echo -e "  Option B: Access directly at ${BOLD}http://$ip${NC}"
  echo ""
  echo -e "  ${BOLD}DNS server:${NC} $ip:53 (resolves flyx.local, forwards everything else)"
  echo ""
  echo -e "  ${BOLD}To set DNS on other devices:${NC}"
  echo -e "    iPhone/iPad: Settings → Wi-Fi → (i) → Configure DNS → Manual → $ip"
  echo -e "    Android:     Settings → Wi-Fi → long-press network → Modify → DNS → $ip"
  echo -e "    Windows:     Network Settings → Change adapter → IPv4 → DNS → $ip"
  echo -e "    Mac:         System Preferences → Network → Advanced → DNS → $ip"
  echo -e "    Linux:       Edit /etc/resolv.conf → nameserver $ip"
  echo ""
  echo -e "  ${BOLD}Or set it network-wide:${NC}"
  echo -e "    Router admin → DHCP settings → Primary DNS → $ip"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

cmd_start() {
  local ip
  ip=$(detect_lan_ip)
  local upstream_dns
  upstream_dns=$(detect_upstream_dns)

  log "Detected LAN IP: $ip"
  log "Detected upstream DNS: $upstream_dns"

  ensure_env "$ip" "$upstream_dns"
  setup_hosts "$ip"

  log "Starting Flyx services..."
  docker compose -f "$COMPOSE_FILE" up -d --build

  # Wait for health
  log "Waiting for services to be healthy..."
  local retries=0
  while [[ $retries -lt 30 ]]; do
    if curl -sf http://localhost:8787/health >/dev/null 2>&1; then
      break
    fi
    sleep 2
    retries=$((retries + 1))
  done

  if curl -sf http://localhost:8787/health >/dev/null 2>&1; then
    log "All services are up!"
    print_network_info "$ip"
  else
    warn "Services are starting but may not be fully ready yet."
    warn "Run 'docker compose logs -f' to check progress."
    print_network_info "$ip"
  fi
}

cmd_stop() {
  log "Stopping Flyx services..."
  docker compose -f "$COMPOSE_FILE" down
  log "Stopped."
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  docker compose -f "$COMPOSE_FILE" ps
}

cmd_logs() {
  docker compose -f "$COMPOSE_FILE" logs -f
}

cmd_dns() {
  local ip
  ip=$(detect_lan_ip)
  log "Detected LAN IP: $ip"
  setup_hosts "$ip"
  log "DNS configured: $DOMAIN → $ip"
}

cmd_clean() {
  log "Stopping services and cleaning up..."
  docker compose -f "$COMPOSE_FILE" down -v
  remove_hosts
  log "Cleaned up. Volumes removed, /etc/hosts restored."
}

# Main
case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  dns)     cmd_dns ;;
  clean)   cmd_clean ;;
  "")      cmd_start ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|dns|clean}"
    exit 1
    ;;
esac
