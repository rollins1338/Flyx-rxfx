# Local stream proxy - replaces Cloudflare Workers for self-hosted setup
FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

CMD ["node", "index.js"]
