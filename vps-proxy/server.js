/**
 * VPS Proxy Server for DLHD Live TV Streams
 * 
 * A lightweight proxy that runs on a VPS to bypass CORS and add proper headers.
 * Works with Cloudflare Workers as a fallback proxy.
 * 
 * Usage:
 *   GET /proxy?url=<encoded_url>  - Proxy any URL
 *   GET /health                   - Health check
 * 
 * Environment Variables:
 *   API_KEY  - Required API key for authentication
 *   PORT     - Server port (default: 3001)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('ERROR: API_KEY environment variable is required');
  console.error('Run: export API_KEY=$(openssl rand -hex 32)');
  process.exit(1);
}

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT = 200; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }
  
  record.count++;
  rateLimits.set(ip, record);
  
  return record.count <= RATE_LIMIT;
}

// Clean up old rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimits) {
    if (now > record.resetAt + RATE_WINDOW) {
      rateLimits.delete(ip);
    }
  }
}, 300000);

const server = http.createServer(async (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Proxy endpoint
  if (url.pathname === '/proxy') {
    // Check API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    
    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }
    
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }
    
    try {
      const response = await proxyRequest(targetUrl);
      
      // Forward response headers
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.writeHead(response.statusCode, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      
      // Stream the response
      response.pipe(res);
      
    } catch (error) {
      console.error(`Proxy error for ${targetUrl}:`, error.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', details: error.message }));
    }
    return;
  }
  
  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    error: 'Not found',
    routes: {
      proxy: '/proxy?url=<encoded_url>',
      health: '/health'
    }
  }));
});

function proxyRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // Determine referer based on URL
    let referer = 'https://epicplayplay.cfd/';
    if (targetUrl.includes('giokko.ru')) {
      referer = 'https://epicplayplay.cfd/';
    }
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer,
        'Origin': referer.replace(/\/$/, ''),
      },
      timeout: 30000,
    };
    
    const request = client.request(options, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        proxyRequest(response.headers.location).then(resolve).catch(reject);
        return;
      }
      resolve(response);
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    request.end();
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           VPS Proxy Server for DLHD Live TV                ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║                                                            ║
║  Endpoints:                                                ║
║    GET /proxy?url=<encoded_url>  - Proxy requests          ║
║    GET /health                   - Health check            ║
║                                                            ║
║  API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}                              ║
╚════════════════════════════════════════════════════════════╝
  `);
});
