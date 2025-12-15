#!/usr/bin/env node
/**
 * Raspberry Pi Simple Proxy Server
 * 
 * A minimal residential IP proxy for DLHD keys and m3u8 playlists.
 * Now uses Authorization header for key requests (discovered via reverse engineering).
 * 
 * Key Discovery:
 *   - DLHD key server requires: Authorization: Bearer <token>
 *   - Token is generated server-side and embedded in player page
 *   - Token is fetched from: https://epicplayplay.cfd/premiumtv/daddyhd.php?id=<channel>
 * 
 * Setup:
 *   1. Copy this folder to your Raspberry Pi
 *   2. Set API_KEY environment variable
 *   3. Run: node server.js
 *   4. Use Cloudflare Tunnel or ngrok to expose it
 * 
 * Usage:
 *   GET /proxy?url=<encoded_url>
 *   Header: X-API-Key: your-secret-key
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ============================================================================
// DLHD Auth Token Management
// The key server requires Authorization: Bearer <token>
// Token is fetched from the player page and cached per channel
// ============================================================================
const authTokenCache = new Map(); // channel -> { token, fetchedAt }
const AUTH_TOKEN_TTL = 30 * 60 * 1000; // 30 minutes (tokens expire after ~5 hours)

/**
 * Fetch auth token from the player page for a given channel
 */
async function fetchAuthToken(channel) {
  const cached = authTokenCache.get(channel);
  if (cached && (Date.now() - cached.fetchedAt) < AUTH_TOKEN_TTL) {
    console.log(`[Auth] Using cached token for channel ${channel}`);
    return cached.token;
  }
  
  console.log(`[Auth] Fetching fresh token for channel ${channel}...`);
  
  return new Promise((resolve) => {
    const url = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract AUTH_TOKEN from the page
        const match = data.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
        if (match) {
          const token = match[1];
          authTokenCache.set(channel, { token, fetchedAt: Date.now() });
          console.log(`[Auth] Got token for channel ${channel}: ${token.substring(0, 20)}...`);
          resolve(token);
        } else {
          console.log(`[Auth] No token found in page for channel ${channel}`);
          resolve(null);
        }
      });
    }).on('error', (e) => {
      console.error(`[Auth] Error fetching token: ${e.message}`);
      resolve(null);
    });
  });
}

/**
 * Extract channel number from key URL
 * e.g., https://chevy.kiko2.ru/key/premium51/5886102 -> 51
 */
function extractChannelFromKeyUrl(url) {
  const match = url.match(/premium(\d+)/);
  return match ? match[1] : null;
}

// Browser-based key fetcher (bypasses TLS fingerprint detection)
let keyFetcher = null;
try {
  keyFetcher = require('./key-fetcher');
  console.log('[Init] Browser key fetcher loaded');
} catch (e) {
  console.log('[Init] Browser key fetcher not available:', e.message);
}

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
  // Key URLs: wmsxx.php, .key, or new format like /key/premium39/5885913
  if (url.includes('.key') || url.includes('key.php') || url.includes('wmsxx.php') || url.includes('/key/premium')) return KEY_CACHE_TTL;
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
 * Fetch DLHD key with Authorization header
 * This is the correct method - the key server requires Bearer token auth
 */
async function fetchKeyWithAuth(keyUrl, res) {
  // Extract channel from URL
  const channel = extractChannelFromKeyUrl(keyUrl);
  if (!channel) {
    console.log(`[Key] Could not extract channel from URL: ${keyUrl}`);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid key URL format' }));
    return;
  }
  
  // Get auth token for this channel
  const authToken = await fetchAuthToken(channel);
  if (!authToken) {
    console.log(`[Key] Could not get auth token for channel ${channel}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get auth token' }));
    return;
  }
  
  // Fetch key with Authorization header
  const url = new URL(keyUrl);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
      'Authorization': `Bearer ${authToken}`,
      'X-Channel-Key': `premium${channel}`,
    },
  }, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      
      console.log(`[Key] Response: ${proxyRes.statusCode}, ${data.length} bytes`);
      
      // Check if we got a valid key
      if (data.length === 16) {
        const text = data.toString('utf8');
        if (text.includes('error')) {
          console.log(`[Key] Error response: ${text}`);
          // Token might be expired, clear cache and return error
          authTokenCache.delete(channel);
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Key server returned error', response: text }));
        } else {
          console.log(`[Key] Valid key: ${data.toString('hex')}`);
          setCache(keyUrl, data, 'application/octet-stream');
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': data.length,
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'MISS',
            'X-Fetched-By': 'auth-header',
          });
          res.end(data);
        }
      } else {
        console.log(`[Key] Unexpected response size: ${data.length}`);
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`[Key] Request error: ${e.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Key fetch failed', details: e.message }));
  });
  
  req.end();
}

/**
 * Proxy using curl for non-key requests
 */
function proxyWithCurl(targetUrl, res) {
  // Build args
  const args = ['-s', '--max-time', '30'];
  
  // Add HTTP/2 and ignore cert errors
  args.push('--http2', '-k');
  
  // Add browser headers
  args.push('-H', 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
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
    
    // CRITICAL: For key requests, if we get 401 but body is exactly 16 bytes,
    // the server might be returning the key data with an error status.
    // AES-128 keys are always exactly 16 bytes.
    // The {"error":"E3"} JSON response is also 16 bytes, so check if it's JSON
    const isKeyRequest = targetUrl.includes('/key/premium') || targetUrl.includes('wmsxx.php') || targetUrl.includes('.key');
    let finalStatus = statusCode;
    
    if (isKeyRequest && statusCode === 401 && data.length === 16) {
      // Check if it's JSON error or actual binary key data
      const dataStr = data.toString('utf8');
      const looksLikeJson = dataStr.startsWith('{') || dataStr.startsWith('[');
      
      if (looksLikeJson) {
        console.log(`[Key 401] Got JSON error response: ${dataStr}`);
        // It's a JSON error, keep 401 status
      } else {
        // It's likely binary key data! Return as 200
        console.log(`[Key 401] Got 16-byte binary data, treating as valid key!`);
        console.log(`[Key Data] Hex: ${data.toString('hex')}`);
        finalStatus = 200;
        setCache(targetUrl, data, 'application/octet-stream');
      }
    } else if (statusCode === 200) {
      setCache(targetUrl, data, 'application/octet-stream');
    }
    
    console.log(`[Response] ${finalStatus} - ${data.length} bytes`);
    
    res.writeHead(finalStatus, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS',
      'X-Original-Status': statusCode.toString(),
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
 * AnimeKai stream proxy - fetches MegaUp CDN streams from residential IP
 * MegaUp blocks:
 *   1. Datacenter IPs (Cloudflare, AWS, etc.)
 *   2. Requests with Origin header
 *   3. Requests with Referer header (sometimes)
 * 
 * This proxy fetches WITHOUT Origin/Referer headers from a residential IP.
 * 
 * IMPORTANT: The User-Agent MUST be consistent with what's sent to enc-dec.app
 * for decryption. Pass ?ua=<user-agent> to use a custom User-Agent.
 */
function proxyAnimeKaiStream(targetUrl, customUserAgent, res) {
  // Check cache (short TTL for m3u8, longer for segments)
  const cached = getCached(targetUrl);
  if (cached) {
    console.log(`[AnimeKai Cache HIT] ${targetUrl.substring(0, 60)}...`);
    res.writeHead(200, {
      'Content-Type': cached.contentType,
      'Content-Length': cached.data.length,
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'HIT',
    });
    res.end(cached.data);
    return;
  }

  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  // CRITICAL: Do NOT send Origin or Referer headers - MegaUp blocks them
  // IMPORTANT: User-Agent MUST match what's sent to enc-dec.app for decryption
  const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  const userAgent = customUserAgent || defaultUserAgent;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Don't request compression for video
      'Connection': 'keep-alive',
    },
    timeout: 30000,
    rejectUnauthorized: false, // Some CDNs have cert issues
  };

  console.log(`[AnimeKai] ${targetUrl.substring(0, 100)}...`);

  const proxyReq = client.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    const chunks = [];
    
    console.log(`[AnimeKai Response] ${proxyRes.statusCode} - ${contentType}`);
    
    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location;
      console.log(`[AnimeKai Redirect] Following to: ${redirectUrl.substring(0, 80)}...`);
      
      // Resolve relative URLs
      const absoluteUrl = redirectUrl.startsWith('http') 
        ? redirectUrl 
        : new URL(redirectUrl, targetUrl).toString();
      
      // Follow the redirect (preserve custom User-Agent)
      proxyAnimeKaiStream(absoluteUrl, customUserAgent, res);
      return;
    }
    
    proxyRes.on('data', chunk => chunks.push(chunk));
    
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      
      console.log(`[AnimeKai] ${proxyRes.statusCode} - ${data.length} bytes`);
      
      // Cache successful responses
      if (proxyRes.statusCode === 200) {
        setCache(targetUrl, data, contentType);
      }
      
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
        'X-Cache': 'MISS',
        'X-Proxied-By': 'rpi-residential',
      });
      res.end(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[AnimeKai Error] ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'AnimeKai proxy error', details: err.message }));
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'AnimeKai stream timeout' }));
    }
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

  // Key URLs: wmsxx.php, .key, or new format like /key/premium39/5885913
  const isKeyRequest = targetUrl.includes('wmsxx.php') || targetUrl.includes('.key') || targetUrl.includes('/key/premium');
  
  // For key requests, use Authorization header method (discovered via reverse engineering)
  // The key server requires: Authorization: Bearer <token>
  if (isKeyRequest) {
    console.log(`[Key Request] Using Authorization header method`);
    return fetchKeyWithAuth(targetUrl, res);
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

  // AnimeKai proxy endpoint - proxies MegaUp CDN streams from residential IP
  // MegaUp blocks datacenter IPs and requests with Origin/Referer headers
  if (reqUrl.pathname === '/animekai') {
    const targetUrl = reqUrl.searchParams.get('url');
    const customUserAgent = reqUrl.searchParams.get('ua');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      const decodedUa = customUserAgent ? decodeURIComponent(customUserAgent) : null;
      proxyAnimeKaiStream(decoded, decodedUa, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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
║       Raspberry Pi Proxy (DLHD Auth Token Method)         ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(49)}║
║  API Key: ${API_KEY.substring(0, 8)}${'*'.repeat(Math.max(0, API_KEY.length - 8)).padEnd(41)}║
║  Key Fetch: Authorization Bearer Token (auto-fetched)     ║
╠═══════════════════════════════════════════════════════════╣
║  DLHD Key Method:                                         ║
║    1. Fetch auth token from epicplayplay.cfd player page  ║
║    2. Use Authorization: Bearer <token> header            ║
║    3. Token cached for 30 minutes per channel             ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET /proxy?url=<encoded_url>  - Proxy a request        ║
║    GET /iptv/stream?url=&mac=&token= - IPTV stream proxy  ║
║    GET /animekai?url=<encoded_url> - AnimeKai/MegaUp CDN  ║
║    GET /health                   - Health check           ║
╠═══════════════════════════════════════════════════════════╣
║  Expose with:                                             ║
║    cloudflared tunnel --url localhost:${PORT.toString().padEnd(20)}║
║    ngrok http ${PORT.toString().padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});
