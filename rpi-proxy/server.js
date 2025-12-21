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
// Token is fetched from the player page - NO CACHING to avoid stale token issues
// ============================================================================

// ============================================================================
// DLHD Heartbeat Session Management  
// The key server requires a heartbeat session to be established BEFORE key fetch
// Heartbeat must be called from residential IP (datacenter IPs get 403)
// NO CACHING - always establish fresh session to avoid stale session issues
// ============================================================================

/**
 * Fetch auth data from the player page for a given channel
 * Returns: { token, country, timestamp }
 * NO CACHING - always fetch fresh to avoid stale token issues
 */
async function fetchAuthToken(channel) {
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
        const tokenMatch = data.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
        if (tokenMatch) {
          const token = tokenMatch[1];
          
          // Extract AUTH_COUNTRY
          const countryMatch = data.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
          const country = countryMatch ? countryMatch[1] : 'US';
          
          // Extract AUTH_TS
          const tsMatch = data.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);
          const timestamp = tsMatch ? tsMatch[1] : String(Math.floor(Date.now() / 1000));
          
          const authData = { token, country, timestamp };
          console.log(`[Auth] Got token for channel ${channel}: ${token.substring(0, 20)}... country=${country} ts=${timestamp}`);
          resolve(authData);
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

/**
 * Extract server from key URL
 * e.g., https://chevy.kiko2.ru/key/premium51/5886102 -> { server: 'chevy', domain: 'kiko2.ru' }
 */
function extractServerFromKeyUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.hostname.split('.');
    if (parts.length >= 3) {
      return { server: parts[0], domain: parts.slice(1).join('.') };
    }
  } catch {}
  return null;
}

/**
 * Generate CLIENT_TOKEN for heartbeat authentication
 * This mimics the browser's generateClientToken() function
 * 
 * Format: base64(channelKey|country|timestamp|userAgent|fingerprint)
 * Where fingerprint = userAgent|screen|timezone|language
 */
function generateClientToken(channelKey, country, timestamp, userAgent) {
  const screen = '1920x1080'; // Common resolution
  const tz = 'America/New_York'; // Common timezone
  const lang = 'en-US';
  const fingerprint = `${userAgent}|${screen}|${tz}|${lang}`;
  const signData = `${channelKey}|${country}|${timestamp}|${userAgent}|${fingerprint}`;
  return Buffer.from(signData).toString('base64');
}

/**
 * Establish heartbeat session for a channel on a specific server
 * This MUST be called before fetching keys - the key server returns E2 error otherwise
 * 
 * CRITICAL: Heartbeat requires X-Client-Token header (base64 fingerprint)
 * Without it, server returns 403 "Missing client token"
 * 
 * @param {string} channel - Channel number (e.g., "51")
 * @param {string} server - Server name (e.g., "zeko", "chevy")
 * @param {string} domain - Domain (e.g., "kiko2.ru", "giokko.ru")
 * @param {string} authToken - Auth token from player page
 * @param {string} country - Country code (e.g., "US")
 * @param {string} timestamp - Auth timestamp from player page
 * @returns {Promise<{success: boolean, expiry?: number, error?: string}>}
 */
async function establishHeartbeatSession(channel, server, domain, authToken, country = 'US', timestamp = null) {
  // NO CACHING - always establish fresh session to avoid stale session issues
  console.log(`[Heartbeat] Establishing fresh session for channel ${channel} on ${server}.${domain}...`);
  
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const channelKey = `premium${channel}`;
  const ts = timestamp || String(Math.floor(Date.now() / 1000));
  const clientToken = generateClientToken(channelKey, country, ts, userAgent);
  
  console.log(`[Heartbeat] Using CLIENT_TOKEN: ${clientToken.substring(0, 40)}...`);
  
  return new Promise((resolve) => {
    const hbUrl = `https://${server}.${domain}/heartbeat`;
    
    const req = https.get(hbUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
        'Authorization': `Bearer ${authToken}`,
        'X-Channel-Key': channelKey,
        'X-Client-Token': clientToken,
        'X-User-Agent': userAgent,
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[Heartbeat] Response: ${res.statusCode} - ${data.substring(0, 100)}`);
        
        // 404 = endpoint doesn't exist on this server, not an error
        if (res.statusCode === 404) {
          console.log(`[Heartbeat] Server ${server}.${domain} doesn't have heartbeat endpoint`);
          resolve({ success: false, error: 'No heartbeat endpoint (404)' });
          return;
        }
        
        // Check for success - heartbeat returns {"status":"ok","expiry":1734567890}
        if (res.statusCode === 200 && (data.includes('"ok"') || data.includes('"status":"ok"'))) {
          // Extract expiry timestamp
          let expiry = Math.floor(Date.now() / 1000) + 1800; // Default 30 min
          try {
            const json = JSON.parse(data);
            if (json.expiry) expiry = json.expiry;
          } catch {}
          
          console.log(`[Heartbeat] ✅ Session established for ${channel}:${server}, expires at ${expiry}`);
          resolve({ success: true, expiry });
        } else {
          console.log(`[Heartbeat] ❌ Failed for ${channel}:${server}: ${res.statusCode} - ${data.substring(0, 100)}`);
          resolve({ success: false, error: data.substring(0, 200) });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`[Heartbeat] Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
  });
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

// Simple response cache - NO CACHING FOR KEYS OR AUTH!
// Keys and auth tokens must be fresh every request
const cache = new Map();
const KEY_CACHE_TTL = 0; // NO CACHING for keys - must be fresh!
const M3U8_CACHE_TTL = 0; // NO CACHING for m3u8 - must be fresh!

function getCacheTTL(url) {
  // NO CACHING for keys - they require fresh auth tokens
  if (url.includes('.key') || url.includes('key.php') || url.includes('wmsxx.php') || url.includes('/key/premium')) return 0;
  // NO CACHING for m3u8 - they update frequently
  if (url.includes('.m3u8') || url.includes('mono.css')) return 0;
  // Only cache static segments
  return 30000; // 30 seconds for segments only
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

// Cache cleanup disabled - we don't cache keys/auth anymore

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
 * IMPORTANT: Must establish heartbeat session FIRST, then fetch key
 * 
 * Flow:
 *   1. Get FRESH auth token from player page (NO CACHING)
 *   2. Call heartbeat endpoint to establish FRESH session (NO CACHING)
 *   3. Fetch key with Authorization header
 */
async function fetchKeyWithAuth(keyUrl, res) {
  // Extract channel from URL
  const channel = extractChannelFromKeyUrl(keyUrl);
  if (!channel) {
    console.log(`[Key] Could not extract channel from URL: ${keyUrl}`);
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Invalid key URL format' }));
    return;
  }
  
  // Extract server info from URL
  const serverInfo = extractServerFromKeyUrl(keyUrl);
  if (!serverInfo) {
    console.log(`[Key] Could not extract server from URL: ${keyUrl}`);
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Invalid key URL format - cannot extract server' }));
    return;
  }
  
  console.log(`[Key] Fetching key for channel ${channel} from ${serverInfo.server}.${serverInfo.domain}`);
  
  // Step 1: Get auth data for this channel (token, country, timestamp)
  const authData = await fetchAuthToken(channel);
  if (!authData || !authData.token) {
    console.log(`[Key] Could not get auth token for channel ${channel}`);
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Failed to get auth token' }));
    return;
  }
  
  // Step 2: Try to establish heartbeat session with CLIENT_TOKEN
  // If heartbeat returns 404, the server doesn't have that endpoint - proceed anyway
  // If heartbeat returns 403, we're blocked (datacenter IP) - proceed anyway and hope for the best
  const hbResult = await establishHeartbeatSession(channel, serverInfo.server, serverInfo.domain, authData.token, authData.country, authData.timestamp);
  if (hbResult.success) {
    console.log(`[Key] Heartbeat OK, session expires at ${hbResult.expiry}`);
  } else {
    console.log(`[Key] Heartbeat skipped/failed: ${hbResult.error} - proceeding with key fetch`);
  }
  
  // Generate CLIENT_TOKEN for key request
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const channelKey = `premium${channel}`;
  const clientToken = generateClientToken(channelKey, authData.country, authData.timestamp, userAgent);
  
  // Step 3: Fetch key with all auth headers (same as browser's xhrSetup)
  const url = new URL(keyUrl);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
      'Authorization': `Bearer ${authData.token}`,
      'X-Channel-Key': channelKey,
      'X-Client-Token': clientToken,
      'X-User-Agent': userAgent,
    },
  }, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      const text = data.toString('utf8');
      
      console.log(`[Key] Response: ${proxyRes.statusCode}, ${data.length} bytes`);
      
      // Check for E2 error (session not established)
      if (text.includes('"E2"') || text.includes('Session must be created')) {
        console.log(`[Key] E2 error - session not established`);
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ 
          error: 'Session not established', 
          code: 'E2',
          hint: 'Heartbeat session required but failed. Retry may help.',
          response: text 
        }));
        return;
      }
      
      // Check for E3 error (token expired)
      if (text.includes('"E3"') || text.includes('Token expired')) {
        console.log(`[Key] E3 error - token expired`);
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Token expired', code: 'E3', response: text }));
        return;
      }
      
      // Check if we got a valid key (AES-128 keys are exactly 16 bytes)
      if (data.length === 16) {
        // Make sure it's not a JSON error that happens to be 16 bytes
        if (text.startsWith('{') || text.startsWith('[')) {
          console.log(`[Key] Got JSON error: ${text}`);
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Key server returned error', response: text }));
          return;
        }
        
        console.log(`[Key] ✅ Valid key: ${data.toString('hex')}`);
        // NO CACHING - keys change frequently
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length,
          'Access-Control-Allow-Origin': '*',
          'X-Fetched-By': 'fresh-auth-no-cache',
        });
        res.end(data);
      } else {
        console.log(`[Key] Unexpected response: ${data.length} bytes - ${text.substring(0, 100)}`);
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
        // NO CACHING for keys
      }
    }
    // NO CACHING for keys
    
    console.log(`[Response] ${finalStatus} - ${data.length} bytes`);
    
    res.writeHead(finalStatus, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
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
 * AnimeKai/Flixer stream proxy - fetches CDN streams from residential IP
 * 
 * MegaUp CDN (AnimeKai) blocks:
 *   1. Datacenter IPs (Cloudflare, AWS, etc.)
 *   2. Requests with Origin header
 *   3. Requests with Referer header (sometimes)
 * 
 * Flixer CDN (p.XXXXX.workers.dev) blocks:
 *   1. Datacenter IPs (Cloudflare, AWS, etc.)
 *   2. Requests WITHOUT Referer header (requires https://flixer.sh/)
 * 
 * This proxy fetches from a residential IP with appropriate headers.
 * 
 * IMPORTANT: The User-Agent MUST be consistent with what's sent to enc-dec.app
 * for decryption. Pass ?ua=<user-agent> to use a custom User-Agent.
 * Pass ?referer=<url> to include a Referer header (needed for Flixer CDN).
 */
function proxyAnimeKaiStream(targetUrl, customUserAgent, customReferer, res) {
  // NO CACHING - always fetch fresh

  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  // Check if this is Flixer CDN (p.XXXXX.workers.dev)
  const isFlixerCdn = url.hostname.match(/^p\.\d+\.workers\.dev$/);
  
  // IMPORTANT: User-Agent MUST match what's sent to enc-dec.app for decryption
  const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  const userAgent = customUserAgent || defaultUserAgent;
  
  // Build headers based on CDN type
  const headers = {
    'User-Agent': userAgent,
    'Accept': '*/*',
    'Accept-Encoding': 'identity', // Don't request compression for video
    'Connection': 'keep-alive',
  };
  
  // Flixer CDN REQUIRES Referer header, MegaUp CDN BLOCKS it
  if (isFlixerCdn) {
    // Flixer CDN needs Referer header
    headers['Referer'] = customReferer || 'https://flixer.sh/';
    console.log(`[AnimeKai] Flixer CDN detected - adding Referer: ${headers['Referer']}`);
  } else if (customReferer) {
    // Only add Referer if explicitly provided for non-Flixer CDNs
    headers['Referer'] = customReferer;
  }
  // For MegaUp CDN (AnimeKai), do NOT send Origin or Referer headers
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers,
    timeout: 30000,
    rejectUnauthorized: false, // Some CDNs have cert issues
  };

  console.log(`[AnimeKai] ${targetUrl.substring(0, 100)}...`);
  console.log(`[AnimeKai] Headers:`, JSON.stringify(headers, null, 2));

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
      
      // Follow the redirect (preserve custom User-Agent and Referer)
      proxyAnimeKaiStream(absoluteUrl, customUserAgent, customReferer, res);
      return;
    }
    
    proxyRes.on('data', chunk => chunks.push(chunk));
    
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      
      console.log(`[AnimeKai] ${proxyRes.statusCode} - ${data.length} bytes`);
      
      // NO CACHING
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
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
  // NO CACHING for proxy requests - always fetch fresh

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
      
      // NO CACHING
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Access-Control-Allow-Origin': '*',
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

const server = http.createServer(async (req, res) => {
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
      method: 'FRESH-AUTH-EVERY-REQUEST',
      caching: 'DISABLED for keys/auth/m3u8',
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

  // DLHD Heartbeat endpoint - establishes session for key fetching
  // This is needed because heartbeat endpoint blocks datacenter IPs
  // CF Worker calls this BEFORE fetching keys
  if (reqUrl.pathname === '/heartbeat') {
    const channel = reqUrl.searchParams.get('channel');
    const server = reqUrl.searchParams.get('server');
    const domain = reqUrl.searchParams.get('domain') || 'kiko2.ru';
    
    if (!channel || !server) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ 
        error: 'Missing channel or server parameter',
        usage: '/heartbeat?channel=51&server=zeko&domain=kiko2.ru'
      }));
    }
    
    // Get auth data first (token, country, timestamp)
    const authData = await fetchAuthToken(channel);
    if (!authData || !authData.token) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Failed to get auth token' }));
    }
    
    // Establish heartbeat session with CLIENT_TOKEN
    const result = await establishHeartbeatSession(channel, server, domain, authData.token, authData.country, authData.timestamp);
    
    res.writeHead(result.success ? 200 : 502, { 
      'Content-Type': 'application/json', 
      'Access-Control-Allow-Origin': '*' 
    });
    res.end(JSON.stringify({
      success: result.success,
      channel,
      server,
      domain,
      expiry: result.expiry,
      error: result.error,
    }));
    return;
  }

  // DLHD Key endpoint - fetches encryption key from residential IP
  // The key server (chevy.kiko2.ru) blocks Cloudflare IPs
  // CF Worker calls this when direct key fetch fails
  if (reqUrl.pathname === '/dlhd-key') {
    const targetUrl = reqUrl.searchParams.get('url');
    const authToken = reqUrl.searchParams.get('auth_token');
    const channelKey = reqUrl.searchParams.get('channel_key');
    const clientToken = reqUrl.searchParams.get('client_token');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ 
        error: 'Missing url parameter',
        usage: '/dlhd-key?url=<key_url>&auth_token=<token>&channel_key=<key>&client_token=<token>'
      }));
    }
    
    console.log(`[DLHD-Key] Fetching key from residential IP: ${targetUrl.substring(0, 80)}...`);
    
    const url = new URL(targetUrl);
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // Build headers - use provided auth or fetch fresh
    const headers = {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    };
    
    if (authToken) {
      headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    }
    if (channelKey) {
      headers['X-Channel-Key'] = channelKey;
    }
    if (clientToken) {
      headers['X-Client-Token'] = clientToken;
    }
    
    console.log(`[DLHD-Key] Headers:`, JSON.stringify(headers, null, 2));
    
    const keyReq = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers,
      timeout: 10000,
    }, (keyRes) => {
      const chunks = [];
      keyRes.on('data', chunk => chunks.push(chunk));
      keyRes.on('end', () => {
        const data = Buffer.concat(chunks);
        const text = data.toString('utf8');
        
        console.log(`[DLHD-Key] Response: ${keyRes.statusCode}, ${data.length} bytes`);
        
        // Check for valid 16-byte key
        if (data.length === 16 && !text.startsWith('{') && !text.startsWith('[')) {
          console.log(`[DLHD-Key] ✅ Valid key: ${data.toString('hex')}`);
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': data.length,
            'Access-Control-Allow-Origin': '*',
            'X-Fetched-By': 'rpi-residential',
          });
          res.end(data);
        } else {
          console.log(`[DLHD-Key] Response: ${text.substring(0, 100)}`);
          res.writeHead(keyRes.statusCode, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': data.length,
            'Access-Control-Allow-Origin': '*',
          });
          res.end(data);
        }
      });
    });
    
    keyReq.on('error', (err) => {
      console.error(`[DLHD-Key] Error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Key fetch failed', details: err.message }));
    });
    
    keyReq.on('timeout', () => {
      keyReq.destroy();
      res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Key fetch timeout' }));
    });
    
    keyReq.end();
    return;
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

  // AnimeKai proxy endpoint - proxies MegaUp/Flixer CDN streams from residential IP
  // MegaUp blocks datacenter IPs and requests with Origin/Referer headers
  // Flixer CDN blocks datacenter IPs but REQUIRES Referer header
  if (reqUrl.pathname === '/animekai') {
    const targetUrl = reqUrl.searchParams.get('url');
    const customUserAgent = reqUrl.searchParams.get('ua');
    const customReferer = reqUrl.searchParams.get('referer');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      const decodedUa = customUserAgent ? decodeURIComponent(customUserAgent) : null;
      const decodedReferer = customReferer ? decodeURIComponent(customReferer) : null;
      proxyAnimeKaiStream(decoded, decodedUa, decodedReferer, res);
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
║     Raspberry Pi Proxy (DLHD Heartbeat + Auth Token)      ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(49)}║
║  API Key: ${API_KEY.substring(0, 8)}${'*'.repeat(Math.max(0, API_KEY.length - 8)).padEnd(41)}║
╠═══════════════════════════════════════════════════════════╣
║  DLHD Key Method (Dec 2024):                              ║
║    1. Fetch auth token from epicplayplay.cfd player page  ║
║    2. Call heartbeat endpoint to establish session        ║
║    3. Fetch key with Authorization: Bearer <token>        ║
║    4. Sessions cached for 25 min, tokens for 30 min       ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET /proxy?url=<encoded_url>  - Proxy a request        ║
║    GET /heartbeat?channel=&server=&domain= - DLHD session ║
║    GET /iptv/stream?url=&mac=&token= - IPTV stream proxy  ║
║    GET /animekai?url=&referer= - AnimeKai/Flixer CDN      ║
║    GET /health                   - Health check           ║
╠═══════════════════════════════════════════════════════════╣
║  CDN Support:                                             ║
║    - MegaUp (AnimeKai): No Referer header                 ║
║    - Flixer (p.XXXXX.workers.dev): Requires Referer       ║
╠═══════════════════════════════════════════════════════════╣
║  Expose with:                                             ║
║    cloudflared tunnel --url localhost:${PORT.toString().padEnd(20)}║
║    ngrok http ${PORT.toString().padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});
