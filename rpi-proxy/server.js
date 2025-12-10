#!/usr/bin/env node
/**
 * Raspberry Pi Simple Proxy Server
 * 
 * A minimal residential IP proxy for DLHD keys and m3u8 playlists.
 * No special headers needed - residential IP is all that matters!
 * 
 * Setup:
 *   1. Copy this folder to your Raspberry Pi
 *   2. npm install
 *   3. Set API_KEY environment variable
 *   4. Run: node server.js
 *   5. Use Cloudflare Tunnel or ngrok to expose it
 * 
 * Usage:
 *   GET /proxy?url=<encoded_url>
 *   Header: X-API-Key: your-secret-key
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'change-this-secret-key';

// Simple rate limiting
const rateLimiter = new Map();
const RATE_LIMIT = 500; // requests per minute
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

// Simple response cache
const cache = new Map();
const KEY_CACHE_TTL = 3600000; // 1 hour for keys
const M3U8_CACHE_TTL = 5000;   // 5 seconds for m3u8 (they update frequently)

function getCacheTTL(url) {
  if (url.includes('.key') || url.includes('key.php') || url.includes('wmsxx.php')) return KEY_CACHE_TTL;
  if (url.includes('.m3u8') || url.includes('mono.css')) return M3U8_CACHE_TTL;
  return 30000; // 30 seconds default
}

function getCached(url) {
  const ttl = getCacheTTL(url);
  if (ttl === 0) return null;
  
  const cached = cache.get(url);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > ttl) {
    cache.delete(url);
    return null;
  }
  
  return cached;
}

function setCache(url, data, contentType) {
  const ttl = getCacheTTL(url);
  if (ttl === 0) return;
  cache.set(url, { data, contentType, timestamp: Date.now() });
}

// Clean cache every minute
setInterval(() => {
  const now = Date.now();
  for (const [url, cached] of cache.entries()) {
    if (now - cached.timestamp > getCacheTTL(url)) {
      cache.delete(url);
    }
  }
}, 60000);

/**
 * Generate fake AWS auth headers (server checks presence, not validity)
 */
function getAwsHeaders() {
  const now = new Date();
  // Format: 20251210T004300Z
  const pad = (n) => n.toString().padStart(2, '0');
  const amzDate = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const dateStamp = amzDate.substring(0, 8);
  const fakeSignature = '0'.repeat(64);
  const authorization = `AWS4-HMAC-SHA256 Credential=/${dateStamp}/us-east-1//aws4_request, SignedHeaders=host;x-amz-date, Signature=${fakeSignature}`;
  
  return { amzDate, authorization };
}

const { spawn } = require('child_process');

/**
 * Proxy using curl (bypasses Node TLS fingerprinting issues)
 */
function proxyWithCurl(targetUrl, res) {
  const isKeyRequest = targetUrl.includes('wmsxx.php') || targetUrl.includes('.key');
  
  // Force HTTP/2, disable cert verification (like Insomnia)
  // Note: removed -L (follow redirects) as it may cause issues
  const args = ['-s', '--max-time', '30', '--http2', '-k'];
  
  // Match Insomnia's exact header order and format
  args.push('-H', 'user-agent: insomnia/2022.4.2');
  
  // Add AWS headers for key requests
  if (isKeyRequest) {
    const { amzDate, authorization } = getAwsHeaders();
    args.push('-H', `x-amz-date: ${amzDate}`);
    args.push('-H', `authorization: ${authorization}`);
    console.log(`[Key Request] Using curl with AWS headers (HTTP/2)`);
  }
  
  args.push('-H', 'accept: */*');
  args.push('-i'); // Include response headers
  args.push(targetUrl);
  
  console.log(`[Curl] ${targetUrl.substring(0, 80)}...`);
  console.log(`[Curl Args] ${args.join(' ')}`);
  
  const curl = spawn('curl', args);
  const chunks = [];
  let stderr = '';
  
  curl.stdout.on('data', (data) => chunks.push(data));
  curl.stderr.on('data', (data) => { stderr += data.toString(); });
  
  curl.on('close', (code) => {
    if (code !== 0) {
      console.error(`[Curl Error] Exit ${code}: ${stderr}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Curl failed', details: stderr }));
      }
      return;
    }
    
    const output = Buffer.concat(chunks);
    console.log(`[Curl Raw Output] ${output.length} bytes total`);
    
    // With -i flag, output is: HTTP headers + \r\n\r\n + body
    // Parse status from first line: "HTTP/2 200" or "HTTP/1.1 200 OK"
    let statusCode = 200;
    let data = output;
    
    // Find the header/body separator (double CRLF)
    const headerEnd = output.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > 0) {
      const headers = output.slice(0, headerEnd).toString();
      data = output.slice(headerEnd + 4);
      
      // Parse status from first line
      const statusMatch = headers.match(/HTTP\/[\d.]+ (\d+)/);
      if (statusMatch) {
        statusCode = parseInt(statusMatch[1], 10);
      }
      console.log(`[Curl Headers] ${headers.split('\r\n')[0]}`);
    }
    
    console.log(`[Curl Parsed] Status: ${statusCode}, Body: ${data.length} bytes`);
    
    console.log(`[Response] ${statusCode} - ${data.length} bytes`);
    
    if (statusCode === 200) {
      setCache(targetUrl, data, 'application/octet-stream');
    }
    
    res.writeHead(statusCode, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS',
    });
    res.end(data);
  });
  
  curl.on('error', (err) => {
    console.error(`[Curl Spawn Error] ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Curl spawn failed', details: err.message }));
    }
  });
}

/**
 * IPTV API proxy - makes Stalker portal API calls from residential IP
 * This is needed because stream tokens are bound to the requesting IP
 */
function proxyIPTVApi(targetUrl, mac, token, res) {
  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  // STB Device Headers - must match exactly what works from Vercel
  const encodedMac = mac ? encodeURIComponent(mac) : '';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Referer': `${url.protocol}//${url.host}/`,
  };
  
  if (mac) {
    headers['Cookie'] = `mac=${encodedMac}; stb_lang=en; timezone=GMT`;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[IPTV API] Headers:`, JSON.stringify(headers, null, 2));

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 15000,
    rejectUnauthorized: false,
  };

  console.log(`[IPTV API] ${targetUrl.substring(0, 100)}...`);

  const proxyReq = client.request(options, (proxyRes) => {
    const chunks = [];
    
    proxyRes.on('data', chunk => chunks.push(chunk));
    
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      const contentType = proxyRes.headers['content-type'] || 'application/json';
      
      console.log(`[IPTV API Response] ${proxyRes.statusCode} - ${data.length} bytes`);
      
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
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
 * IPTV Stream proxy - streams raw MPEG-TS data with STB headers
 * This is for Stalker portal streams that need residential IP
 * Follows redirects automatically (IPTV servers often return 302)
 */
function proxyIPTVStream(targetUrl, mac, token, res, redirectCount = 0) {
  // Prevent infinite redirect loops
  if (redirectCount > 5) {
    console.error(`[IPTV Error] Too many redirects`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many redirects' }));
    return;
  }

  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  // STB Device Headers - Required for Stalker Portal authentication
  // Must match exactly what works from Vercel
  const encodedMac = mac ? encodeURIComponent(mac) : '';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Referer': `${url.protocol}//${url.host}/`,
  };
  
  if (mac) {
    headers['Cookie'] = `mac=${encodedMac}; stb_lang=en; timezone=GMT`;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 30000,
    rejectUnauthorized: false, // Some IPTV CDNs have bad certs
  };

  console.log(`[IPTV Stream] ${targetUrl.substring(0, 80)}...`);
  console.log(`[IPTV Stream] Headers:`, JSON.stringify(headers, null, 2));

  const proxyReq = client.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'video/mp2t';
    
    console.log(`[IPTV Response] ${proxyRes.statusCode} - ${contentType}`);
    
    // Handle redirects (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location;
      console.log(`[IPTV Redirect] Following redirect to: ${redirectUrl.substring(0, 80)}...`);
      
      // Resolve relative URLs
      const absoluteUrl = redirectUrl.startsWith('http') 
        ? redirectUrl 
        : new URL(redirectUrl, targetUrl).toString();
      
      // Follow the redirect
      proxyIPTVStream(absoluteUrl, mac, token, res, redirectCount + 1);
      return;
    }
    
    // Stream directly - don't buffer (these can be huge/infinite)
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
      'Cache-Control': 'no-store',
    });
    
    proxyRes.pipe(res);
    
    proxyRes.on('error', (err) => {
      console.error(`[IPTV Stream Error] ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end();
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[IPTV Error] ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'IPTV proxy error', details: err.message }));
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'IPTV stream timeout' }));
    }
  });

  // Handle client disconnect (user closes player)
  res.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.end();
}

/**
 * Simple proxy - uses curl for key requests, Node https for others
 */
function proxyRequest(targetUrl, res) {
  // Check cache
  const cached = getCached(targetUrl);
  if (cached) {
    console.log(`[Cache HIT] ${targetUrl.substring(0, 60)}...`);
    res.writeHead(200, {
      'Content-Type': cached.contentType,
      'Content-Length': cached.data.length,
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'HIT',
    });
    res.end(cached.data);
    return;
  }

  // Use curl for key requests (TLS fingerprint matters)
  const isKeyRequest = targetUrl.includes('wmsxx.php') || targetUrl.includes('.key');
  if (isKeyRequest) {
    return proxyWithCurl(targetUrl, res);
  }

  // Use Node https for everything else
  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
    },
    timeout: 30000,
  };

  console.log(`[Fetch] ${targetUrl.substring(0, 80)}...`);

  const proxyReq = client.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    const chunks = [];
    
    proxyRes.on('data', chunk => chunks.push(chunk));
    
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      
      console.log(`[Response] ${proxyRes.statusCode} - ${data.length} bytes`);
      
      if (proxyRes.statusCode === 200) {
        setCache(targetUrl, data, contentType);
      }
      
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
      });
      res.end(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Error] ${err.message}`);
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
      timestamp: Date.now(),
      cacheSize: cache.size 
    }));
  }

  // Check API key (header or query param) for all other endpoints
  const apiKey = req.headers['x-api-key'] || reqUrl.searchParams.get('key');
  if (apiKey !== API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Rate limited' }));
  }

  // IPTV API proxy - makes Stalker portal API calls from residential IP
  // This is needed because stream tokens are bound to the requesting IP
  if (reqUrl.pathname === '/iptv/api') {
    const targetUrl = reqUrl.searchParams.get('url');
    const mac = reqUrl.searchParams.get('mac');
    const token = reqUrl.searchParams.get('token');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      proxyIPTVApi(decoded, mac, token, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
    return;
  }

  // IPTV Stream endpoint - streams raw TS data
  if (reqUrl.pathname === '/iptv/stream') {
    const targetUrl = reqUrl.searchParams.get('url');
    const mac = reqUrl.searchParams.get('mac');
    const token = reqUrl.searchParams.get('token');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      proxyIPTVStream(decoded, mac, token, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
    return;
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
      proxyRequest(decoded, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       Raspberry Pi Simple Proxy (Residential IP)          ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(49)}║
║  API Key: ${API_KEY.substring(0, 8)}${'*'.repeat(Math.max(0, API_KEY.length - 8)).padEnd(41)}║
╠═══════════════════════════════════════════════════════════╣
║  No Puppeteer, no special headers - just simple fetches!  ║
║  Residential IP is all that's needed.                     ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET /proxy?url=<encoded_url>  - Proxy a request        ║
║    GET /iptv/stream?url=&mac=&token= - IPTV stream proxy  ║
║    GET /health                   - Health check           ║
╠═══════════════════════════════════════════════════════════╣
║  Expose with:                                             ║
║    cloudflared tunnel --url localhost:${PORT.toString().padEnd(20)}║
║    ngrok http ${PORT.toString().padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});
