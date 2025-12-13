#!/usr/bin/env node
/**
 * Hetzner VPS IPTV Proxy Server
 * 
 * A simple proxy for Stalker portal API calls and streams.
 * Deploy on your Hetzner VPS to bypass datacenter IP blocking.
 * 
 * Setup:
 *   1. Copy this folder to your Hetzner VPS
 *   2. npm install
 *   3. Set API_KEY environment variable
 *   4. Run: node server.js (or use PM2/systemd)
 *   5. Configure firewall to allow port 3001
 * 
 * Endpoints:
 *   GET /health                           - Health check
 *   GET /iptv/api?url=<url>&mac=<mac>     - Proxy Stalker API calls
 *   GET /iptv/stream?url=<url>&mac=<mac>  - Proxy IPTV streams
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'change-this-secret-key';
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

// STB Device Headers - Required for Stalker Portal authentication
const STB_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

// Simple rate limiting
const rateLimiter = new Map();
const RATE_LIMIT = 1000; // requests per minute
const RATE_WINDOW = 60000;

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

// Clean up rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimiter.entries()) {
    if (now > record.resetAt) rateLimiter.delete(ip);
  }
}, 300000);

/**
 * Build STB headers for Stalker portal requests
 */
function buildSTBHeaders(mac, token, referer) {
  const encodedMac = mac ? encodeURIComponent(mac) : '';
  const headers = {
    'User-Agent': STB_USER_AGENT,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  };
  
  if (mac) {
    headers['Cookie'] = `mac=${encodedMac}; stb_lang=en; timezone=GMT`;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (referer) {
    headers['Referer'] = referer;
  }
  
  return headers;
}

/**
 * IPTV API proxy - makes Stalker portal API calls
 */
function proxyIPTVApi(targetUrl, mac, token, res) {
  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  const referer = `${url.protocol}//${url.host}/`;
  
  const headers = buildSTBHeaders(mac, token, referer);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 15000,
    rejectUnauthorized: false, // Some portals have bad certs
  };

  console.log(`[IPTV API] ${targetUrl.substring(0, 100)}...`);

  const proxyReq = client.request(options, (proxyRes) => {
    const chunks = [];
    
    proxyRes.on('data', chunk => chunks.push(chunk));
    
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      const contentType = proxyRes.headers['content-type'] || 'application/json';
      
      console.log(`[IPTV API] Response: ${proxyRes.statusCode} - ${data.length} bytes`);
      
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'X-Proxy-Source',
        'X-Proxy-Source': 'hetzner',
      });
      res.end(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[IPTV API Error] ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'IPTV API proxy error', details: err.message }));
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'IPTV API timeout' }));
  });

  proxyReq.end();
}

/**
 * Generic HLS Stream proxy - for MegaUp and similar CDNs
 * Used when Cloudflare IPs are blocked by the CDN
 */
function proxyHLSStream(targetUrl, referer, res, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error(`[HLS Stream] Too many redirects`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many redirects' }));
    return;
  }

  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  // Build headers - NO referer for MegaUp (they block requests WITH referer)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity', // Don't compress - we're proxying
    'Connection': 'keep-alive',
  };
  
  // Only add referer if explicitly requested and not same-origin
  // MegaUp CDN blocks requests that have a Referer header!
  if (referer && referer !== 'none') {
    try {
      const refererOrigin = new URL(referer).origin;
      const targetOrigin = url.origin;
      // Only add referer if it's different from target (cross-origin)
      if (refererOrigin !== targetOrigin) {
        headers['Referer'] = referer;
        headers['Origin'] = refererOrigin;
      }
    } catch (e) {
      // Invalid referer URL, skip it
    }
  }
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 30000,
    rejectUnauthorized: false,
  };

  console.log(`[HLS Stream] ${targetUrl.substring(0, 100)}... (referer: ${referer || 'none'})`);

  const proxyReq = client.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    
    console.log(`[HLS Stream] Response: ${proxyRes.statusCode} - ${contentType}`);
    
    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location.startsWith('http') 
        ? proxyRes.headers.location 
        : new URL(proxyRes.headers.location, targetUrl).toString();
      console.log(`[HLS Stream] Redirect to: ${redirectUrl.substring(0, 80)}...`);
      proxyHLSStream(redirectUrl, referer, res, redirectCount + 1);
      return;
    }
    
    // For m3u8 playlists, we need to rewrite URLs to go through the proxy
    const isPlaylist = contentType.includes('mpegurl') || 
                       targetUrl.includes('.m3u8') || 
                       contentType.includes('text');
    
    if (isPlaylist && proxyRes.statusCode === 200) {
      const chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        let playlist = Buffer.concat(chunks).toString('utf8');
        
        // Check if it's actually a playlist
        if (playlist.includes('#EXTM3U') || playlist.includes('#EXT-X-')) {
          console.log(`[HLS Stream] Rewriting playlist URLs...`);
          // We'll return the playlist as-is - the Cloudflare proxy will handle URL rewriting
          // This is just to get past the CDN's IP blocking
        }
        
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': Buffer.byteLength(playlist),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, X-Proxy-Source',
          'Cache-Control': 'public, max-age=5',
          'X-Proxy-Source': 'hetzner',
        });
        res.end(playlist);
      });
      return;
    }
    
    // Stream video segments directly
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, X-Proxy-Source',
      'Cache-Control': 'public, max-age=3600',
      'X-Proxy-Source': 'hetzner',
    });
    
    proxyRes.pipe(res);
    
    proxyRes.on('error', (err) => {
      console.error(`[HLS Stream Error] ${err.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[HLS Stream Error] ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'HLS proxy error', details: err.message }));
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'HLS stream timeout' }));
    }
  });

  // Handle client disconnect
  res.on('close', () => proxyReq.destroy());

  proxyReq.end();
}

/**
 * IPTV Stream proxy - streams raw MPEG-TS data
 * Follows redirects automatically (IPTV servers often return 302)
 */
function proxyIPTVStream(targetUrl, mac, token, res, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error(`[IPTV Stream] Too many redirects`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many redirects' }));
    return;
  }

  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  const referer = `${url.protocol}//${url.host}/`;
  
  const headers = buildSTBHeaders(mac, token, referer);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 30000,
    rejectUnauthorized: false,
  };

  console.log(`[IPTV Stream] ${targetUrl.substring(0, 80)}...`);

  const proxyReq = client.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'video/mp2t';
    
    console.log(`[IPTV Stream] Response: ${proxyRes.statusCode} - ${contentType}`);
    
    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location.startsWith('http') 
        ? proxyRes.headers.location 
        : new URL(proxyRes.headers.location, targetUrl).toString();
      console.log(`[IPTV Stream] Redirect to: ${redirectUrl.substring(0, 80)}...`);
      proxyIPTVStream(redirectUrl, mac, token, res, redirectCount + 1);
      return;
    }
    
    // Stream directly
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, X-Proxy-Source',
      'Cache-Control': 'no-store',
      'X-Proxy-Source': 'hetzner',
    });
    
    proxyRes.pipe(res);
    
    proxyRes.on('error', (err) => {
      console.error(`[IPTV Stream Error] ${err.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[IPTV Stream Error] ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Stream proxy error', details: err.message }));
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Stream timeout' }));
    }
  });

  // Handle client disconnect
  res.on('close', () => proxyReq.destroy());

  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.socket.remoteAddress;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
    });
    return res.end();
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  // Health check - no auth required
  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ 
      status: 'ok', 
      server: 'hetzner-iptv-proxy',
      timestamp: Date.now(),
    }));
  }

  // Check API key
  const apiKey = req.headers['x-api-key'] || reqUrl.searchParams.get('key');
  if (apiKey !== API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Rate limited' }));
  }

  // Generic HLS Stream proxy (for MegaUp, etc.)
  if (reqUrl.pathname === '/stream') {
    const targetUrl = reqUrl.searchParams.get('url');
    const referer = reqUrl.searchParams.get('referer') || 'none';
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      proxyHLSStream(decodeURIComponent(targetUrl), referer === 'none' ? null : decodeURIComponent(referer), res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid URL', details: err.message }));
    }
    return;
  }

  // IPTV API proxy
  if (reqUrl.pathname === '/iptv/api') {
    const targetUrl = reqUrl.searchParams.get('url');
    const mac = reqUrl.searchParams.get('mac');
    const token = reqUrl.searchParams.get('token');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      proxyIPTVApi(decodeURIComponent(targetUrl), mac, token, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid URL', details: err.message }));
    }
    return;
  }

  // IPTV Stream proxy
  if (reqUrl.pathname === '/iptv/stream') {
    const targetUrl = reqUrl.searchParams.get('url');
    const mac = reqUrl.searchParams.get('mac');
    const token = reqUrl.searchParams.get('token');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      proxyIPTVStream(decodeURIComponent(targetUrl), mac, token, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid URL', details: err.message }));
    }
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ 
    error: 'Not found',
    endpoints: {
      health: 'GET /health',
      api: 'GET /iptv/api?url=<url>&mac=<mac>&token=<token>&key=<api_key>',
      stream: 'GET /iptv/stream?url=<url>&mac=<mac>&token=<token>&key=<api_key>',
    }
  }));
});

server.listen(PORT, BIND_HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Hetzner VPS Proxy Server                          ║
╠═══════════════════════════════════════════════════════════╣
║  Host: ${BIND_HOST.padEnd(49)}║
║  Port: ${PORT.toString().padEnd(49)}║
║  API Key: ${API_KEY.substring(0, 8)}${'*'.repeat(Math.max(0, API_KEY.length - 8)).substring(0, 40).padEnd(41)}║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET /health              - Health check                ║
║    GET /stream?url=&referer=- HLS stream proxy (MegaUp)   ║
║    GET /iptv/api?url=&mac=  - Stalker API proxy           ║
║    GET /iptv/stream?url=    - IPTV stream proxy           ║
╠═══════════════════════════════════════════════════════════╣
║  Deploy behind nginx with SSL for production!             ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
