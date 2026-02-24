# Multi-stage build for Flyx 2.0 self-hosted
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3

# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild better-sqlite3

COPY . .

# Remove Cloudflare-specific config that interferes with standard Next.js build
RUN rm -f open-next.config.ts

# Set build-time env vars
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=true

# These NEXT_PUBLIC_ vars need to be set at build time for Next.js client-side code.
# They use placeholder values that get overridden at runtime via docker-compose env.
# For TMDB, the actual key is needed at build time for SSR pages.
ARG NEXT_PUBLIC_TMDB_API_KEY=""
ARG NEXT_PUBLIC_CF_STREAM_PROXY_URL="http://flyx.local:8787/stream"
ARG NEXT_PUBLIC_CF_TV_PROXY_URL="http://flyx.local:8787"
ARG NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL="http://flyx.local:8787/analytics"
ARG NEXT_PUBLIC_CF_SYNC_URL="http://flyx.local:8787/sync"
ARG NEXT_PUBLIC_DLHD_WORKER_URL="http://flyx.local:8787/dlhd"
ARG NEXT_PUBLIC_PROXY_URL="http://flyx.local:8787"
ARG NEXT_PUBLIC_CDN_LIVE_WORKER_URL="http://flyx.local:8787/cdn-live"
ARG NEXT_PUBLIC_CF_TMDB_URL="http://flyx.local:8787"

ENV NEXT_PUBLIC_TMDB_API_KEY=$NEXT_PUBLIC_TMDB_API_KEY
ENV NEXT_PUBLIC_CF_STREAM_PROXY_URL=$NEXT_PUBLIC_CF_STREAM_PROXY_URL
ENV NEXT_PUBLIC_CF_TV_PROXY_URL=$NEXT_PUBLIC_CF_TV_PROXY_URL
ENV NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL=$NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL
ENV NEXT_PUBLIC_CF_SYNC_URL=$NEXT_PUBLIC_CF_SYNC_URL
ENV NEXT_PUBLIC_DLHD_WORKER_URL=$NEXT_PUBLIC_DLHD_WORKER_URL
ENV NEXT_PUBLIC_PROXY_URL=$NEXT_PUBLIC_PROXY_URL
ENV NEXT_PUBLIC_CDN_LIVE_WORKER_URL=$NEXT_PUBLIC_CDN_LIVE_WORKER_URL
ENV NEXT_PUBLIC_CF_TMDB_URL=$NEXT_PUBLIC_CF_TMDB_URL

# Build standard Next.js (not OpenNext/Cloudflare)
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy WASM files needed by extractors
COPY --from=builder /app/public/flixer.wasm ./public/flixer.wasm
COPY --from=builder /app/pow_wasm.js ./pow_wasm.js
COPY --from=builder /app/pow_wasm_bg.wasm ./pow_wasm_bg.wasm

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
