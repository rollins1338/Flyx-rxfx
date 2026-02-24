#!/bin/sh
# Flyx local DNS server entrypoint
# Resolves flyx.local → HOST_IP and forwards everything else upstream

HOST_IP="${HOST_IP:-127.0.0.1}"
UPSTREAM_DNS="${UPSTREAM_DNS:-8.8.8.8}"

echo "[flyx-dns] Starting DNS server"
echo "[flyx-dns] flyx.local → ${HOST_IP}"
echo "[flyx-dns] Upstream DNS: ${UPSTREAM_DNS}"

# Write dnsmasq config
cat > /etc/dnsmasq.conf <<EOF
# Flyx local DNS
no-resolv
no-hosts
log-queries
log-facility=-

# Upstream DNS for everything else
server=${UPSTREAM_DNS}

# flyx.local → host machine
address=/flyx.local/${HOST_IP}

# Don't read /etc/hosts
no-hosts

# Listen on all interfaces
listen-address=0.0.0.0

# Cache DNS responses
cache-size=1000
EOF

exec dnsmasq --no-daemon --log-facility=-
