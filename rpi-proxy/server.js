#!/usr/bin/env node
/**
 * Raspberry Pi CORS Proxy Server
 * 
 * A simple proxy that forwards requests from your Vercel backend
 * through your residential IP to bypass CDN blocks.
 * 
 * Setup:
 *   1. Copy this folder to your Raspberry Pi
 *   2. npm install
 *   3. Set API_KEY environment variable
 *   4. Run: node server.js
 *   5. Use Cloudflare Tunnel or ngrok to expose it securely
 * 
 * Usage from Vercel:
 *   GET https://your-tunnel.trycloudflare.com/proxy?url=<encoded_url>
 *   Header: X-API-Key: your-secret-key
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'change-this-secret-key';

// Rate limiting - very generous limits for live streaming with segment proxying
// Each stream needs ~15-30 segments/min + M3U8 refreshes
const rateLimiter = new Map();
const RATE_LIMIT = 1000; // requests per minute (supports multiple concurrent streams with segments)
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimiter.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }
  
  record.count++;
  rateLimiter.set(ip, record);
  
  return record.count <= RATE_LIMIT;
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimiter.entries()) {
    if (now > record.resetAt) rateLimiter.delete(ip);
  }
}, 300000);

// Response cache - reduces upstream requests dramatically
const responseCache = new Map();
const M3U8_CACHE_TTL = 15000; // 15 seconds for M3U8 files
const KEY_CACHE_TTL = 3600000; // 1 hour for encryption keys
const SEGMENT_CACHE_TTL = 300000; // 5 minutes for video segments (they don't change)

function getCacheTTL(url) {
  if (url.includes('.key') || url.includes('key.php')) return KEY_CACHE_TTL;
  if (url.includes('.ts') || url.endsWith('.css')) return SEGMENT_CACHE_TTL; // .css is used for segments
  return M3U8_CACHE_TTL;
}

function getCachedResponse(url) {
  const cached = responseCache.get(url);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  const ttl = getCacheTTL(url);
  
  if (age > ttl) {
    responseCache.delete(url);
    return null;
  }
  
  // Don't log segment cache hits to reduce noise
  if (!url.includes('.ts') && !url.endsWith('.css')) {
    console.log(`[Cache HIT] ${url.substring(0, 60)}... (age: ${Math.round(age/1000)}s)`);
  }
  return cached;
}

function cacheResponse(url, data, contentType) {
  responseCache.set(url, {
    data,
    contentType,
    timestamp: Date.now()
  });
  // Don't log segment caches to reduce noise
  if (!url.includes('.ts') && !url.endsWith('.css')) {
    console.log(`[Cache SET] ${url.substring(0, 60)}...`);
  }
}

// Clean up old cache entries every minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [url, cached] of responseCache.entries()) {
    const ttl = getCacheTTL(url);
    if (now - cached.timestamp > ttl) {
      responseCache.delete(url);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned ${cleaned} expired entries, ${responseCache.size} remaining`);
  }
}, 60000);

function proxyRequest(targetUrl, res) {
  // Check cache first
  const cached = getCachedResponse(targetUrl);
  if (cached) {
    res.writeHead(200, {
      'Content-Type': cached.contentType,
      'Content-Length': cached.data.length,
      'Access-Control-Allow-Origin': '*',
      'X-Proxied-By': 'rpi-proxy',
      'X-Cache': 'HIT',
    });
    res.end(cached.data);
    return;
  }

  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  // Use epicplayplay.cfd as referer/origin for ALL giokko.ru requests (M3U8 and keys)
  const playerDomain = 'epicplayplay.cfd';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Referer': `https://${playerDomain}/`,
    'Origin': `https://${playerDomain}`,
  };
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 30000,
  };

  const proxyReq = client.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    const chunks = [];
    
    proxyRes.on('data', chunk => chunks.push(chunk));
    
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      
      // Cache successful responses for M3U8 and key files
      if (proxyRes.statusCode === 200) {
        cacheResponse(targetUrl, data, contentType);
      }
      
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
        'X-Proxied-By': 'rpi-proxy',
        'X-Cache': 'MISS',
      });
      res.end(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Timeout' }));
    }
  });

  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
    });
    return res.end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Check API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    console.log(`[Auth Failed] ${clientIp}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Rate limited' }));
  }

  // Parse URL
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  
  // Health check
  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  }

  // Proxy endpoint
  if (reqUrl.pathname === '/proxy') {
    const targetUrl = reqUrl.searchParams.get('url');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      console.log(`[Proxy] ${decoded.substring(0, 80)}...`);
      proxyRequest(decoded, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Raspberry Pi CORS Proxy Server                   ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(50)}║
║  API Key: ${API_KEY.substring(0, 8)}${'*'.repeat(Math.max(0, API_KEY.length - 8)).padEnd(42)}║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET /proxy?url=<encoded_url>  - Proxy a request         ║
║    GET /health                   - Health check            ║
╠════════════════════════════════════════════════════════════╣
║  Next steps:                                               ║
║    1. Expose with: cloudflared tunnel --url localhost:${PORT.toString().padEnd(5)}║
║    2. Or use ngrok: ngrok http ${PORT.toString().padEnd(27)}║
║    3. Add tunnel URL to your Vercel env vars               ║
╚════════════════════════════════════════════════════════════╝
  `);
});
