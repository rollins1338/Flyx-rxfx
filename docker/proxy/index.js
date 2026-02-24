/**
 * Flyx Local Stream Proxy
 * Replaces Cloudflare Workers for self-hosted Docker deployment.
 * 
 * Routes:
 *   /stream/*    - HLS stream proxy (m3u8 + segments)
 *   /tmdb/*      - TMDB API proxy
 *   /analytics/* - Analytics sink (no-op locally)
 *   /health      - Health check
 *   /decode      - Decoder sandbox (basic)
 *   /cdn-live/*  - CDN-Live stream proxy
 *   /viprow/*    - VIPRow stream proxy
 *   /hianime/*   - HiAnime proxy
 *   /vidsrc/*    - VidSrc proxy
 *   /animekai/*  - AnimeKai proxy
 *   /flixer/*    - Flixer proxy
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 8787;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const RPI_PROXY_URL = process.env.RPI_PROXY_URL || '';
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, X-Request-ID, Authorization',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  'Access-Control-Max-Age': '86400',
};

const metrics = { requests: 0, errors: 0, startTime: Date.now() };

function jsonResponse(data, status = 200) {
  return { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }, body: JSON.stringify(data) };
}

function sendResponse(res, { status = 200, headers = {}, body = '' }) {
  res.writeHead(status, headers);
  res.end(body);
}

function proxyFetch(targetUrl, reqHeaders = {}, referer = '') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const mod = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...reqHeaders,
    };
    if (referer) {
      headers['Referer'] = referer;
      headers['Origin'] = new URL(referer).origin;
    }
    // Remove host header to avoid conflicts
    delete headers['host'];
    delete headers['Host'];

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    };

    const req = mod.request(options, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        resolve({
          status: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// Rewrite m3u8 URLs to go through our proxy
function rewriteM3U8(content, baseUrl, proxyBase, route) {
  const lines = content.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      // Rewrite URI= in EXT-X-KEY tags
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
          const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).toString();
          return `URI="${proxyBase}/${route}/stream?url=${encodeURIComponent(absoluteUri)}"`;
        });
      }
      return line;
    }
    if (!trimmed.startsWith('http')) {
      // Relative URL - make absolute then proxy
      const absoluteUrl = new URL(trimmed, baseUrl).toString();
      return `${proxyBase}/${route}/stream?url=${encodeURIComponent(absoluteUrl)}`;
    }
    // Absolute URL - proxy it
    return `${proxyBase}/${route}/stream?url=${encodeURIComponent(trimmed)}`;
  }).join('\n');
}

async function handleStreamProxy(url, query, reqHeaders, proxyBase) {
  const targetUrl = query.get('url');
  const source = query.get('source') || '2embed';
  const referer = query.get('referer') || '';

  if (!targetUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  try {
    const result = await proxyFetch(targetUrl, {
      ...(reqHeaders['range'] ? { Range: reqHeaders['range'] } : {}),
    }, referer);

    const contentType = result.headers['content-type'] || '';
    const responseHeaders = { ...CORS_HEADERS };

    // Copy relevant headers
    if (result.headers['content-type']) responseHeaders['Content-Type'] = result.headers['content-type'];
    if (result.headers['content-length']) responseHeaders['Content-Length'] = result.headers['content-length'];
    if (result.headers['content-range']) responseHeaders['Content-Range'] = result.headers['content-range'];
    if (result.headers['accept-ranges']) responseHeaders['Accept-Ranges'] = result.headers['accept-ranges'];

    let body = result.body;

    // Rewrite m3u8 manifests
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.includes('.m3u8')) {
      const text = body.toString('utf-8');
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      body = Buffer.from(rewriteM3U8(text, baseUrl, proxyBase, 'stream'));
      responseHeaders['Content-Type'] = 'application/vnd.apple.mpegurl';
      responseHeaders['Content-Length'] = String(body.length);
    }

    return { status: result.status, headers: responseHeaders, body };
  } catch (err) {
    metrics.errors++;
    return jsonResponse({ error: 'Stream proxy error', message: err.message }, 502);
  }
}

async function handleTMDBProxy(path, query) {
  if (!TMDB_API_KEY) {
    return jsonResponse({ error: 'TMDB API key not configured' }, 500);
  }

  // Strip /tmdb prefix
  const tmdbPath = path.replace(/^\/tmdb/, '');
  const tmdbUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}`);

  // Forward query params
  for (const [key, value] of query.entries()) {
    tmdbUrl.searchParams.set(key, value);
  }

  // Use bearer token if it starts with 'ey', otherwise use api_key param
  const headers = {};
  if (TMDB_API_KEY.startsWith('ey')) {
    headers['Authorization'] = `Bearer ${TMDB_API_KEY}`;
  } else {
    tmdbUrl.searchParams.set('api_key', TMDB_API_KEY);
  }

  try {
    const result = await proxyFetch(tmdbUrl.toString(), headers);
    return {
      status: result.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...CORS_HEADERS,
      },
      body: result.body,
    };
  } catch (err) {
    metrics.errors++;
    return jsonResponse({ error: 'TMDB proxy error', message: err.message }, 502);
  }
}

function handleAnalytics() {
  // Analytics is a no-op in self-hosted mode - just acknowledge
  return jsonResponse({ success: true, message: 'Analytics received (local mode)' });
}

function handleSync(body) {
  // Basic sync - store in memory (could be extended to SQLite)
  return jsonResponse({ success: true, message: 'Sync acknowledged (local mode)', data: {} });
}

async function handleGenericStreamProxy(path, query, reqHeaders, proxyBase, route) {
  const targetUrl = query.get('url');
  if (!targetUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  try {
    const result = await proxyFetch(targetUrl, {
      ...(reqHeaders['range'] ? { Range: reqHeaders['range'] } : {}),
    });

    const contentType = result.headers['content-type'] || '';
    const responseHeaders = { ...CORS_HEADERS };

    if (result.headers['content-type']) responseHeaders['Content-Type'] = result.headers['content-type'];
    if (result.headers['content-length']) responseHeaders['Content-Length'] = result.headers['content-length'];
    if (result.headers['content-range']) responseHeaders['Content-Range'] = result.headers['content-range'];

    let body = result.body;

    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.includes('.m3u8')) {
      const text = body.toString('utf-8');
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      body = Buffer.from(rewriteM3U8(text, baseUrl, proxyBase, route));
      responseHeaders['Content-Type'] = 'application/vnd.apple.mpegurl';
      responseHeaders['Content-Length'] = String(body.length);
    }

    return { status: result.status, headers: responseHeaders, body };
  } catch (err) {
    metrics.errors++;
    return jsonResponse({ error: `${route} proxy error`, message: err.message }, 502);
  }
}

const server = http.createServer(async (req, res) => {
  metrics.requests++;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const query = url.searchParams;
  const proxyBase = `http://${req.headers.host || `localhost:${PORT}`}`;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return sendResponse(res, { status: 204, headers: CORS_HEADERS });
  }

  let result;

  try {
    if (path === '/health' || path === '/health/') {
      result = jsonResponse({
        status: 'healthy',
        mode: 'self-hosted',
        uptime: `${Math.floor((Date.now() - metrics.startTime) / 1000)}s`,
        metrics,
      });
    } else if (path.startsWith('/stream')) {
      result = await handleStreamProxy(url, query, req.headers, proxyBase);
    } else if (path.startsWith('/tmdb')) {
      result = await handleTMDBProxy(path, query);
    } else if (path.startsWith('/analytics')) {
      result = handleAnalytics();
    } else if (path.startsWith('/sync')) {
      result = handleSync(null);
    } else if (path.startsWith('/cdn-live')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'cdn-live');
    } else if (path.startsWith('/viprow')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'viprow');
    } else if (path.startsWith('/hianime')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'hianime');
    } else if (path.startsWith('/vidsrc')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'vidsrc');
    } else if (path.startsWith('/animekai')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'animekai');
    } else if (path.startsWith('/flixer')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'flixer');
    } else if (path.startsWith('/tv')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'tv');
    } else if (path.startsWith('/dlhd')) {
      result = await handleGenericStreamProxy(path, query, req.headers, proxyBase, 'dlhd');
    } else if (path === '/decode' || path === '/decode/') {
      // Basic decoder - just return empty for self-hosted
      result = jsonResponse({ error: 'Decoder sandbox not available in self-hosted mode' }, 501);
    } else if (path === '/' || path === '') {
      result = jsonResponse({
        name: 'Flyx Local Stream Proxy',
        version: '1.0.0',
        mode: 'self-hosted',
        status: 'operational',
        routes: ['/stream', '/tmdb', '/analytics', '/cdn-live', '/viprow', '/hianime', '/vidsrc', '/animekai', '/flixer', '/tv', '/dlhd', '/health'],
      });
    } else {
      result = jsonResponse({ error: 'Not found' }, 404);
    }
  } catch (err) {
    metrics.errors++;
    console.error(`[proxy] Error handling ${path}:`, err.message);
    result = jsonResponse({ error: 'Internal proxy error', message: err.message }, 500);
  }

  // Handle Buffer bodies (from proxy responses)
  if (Buffer.isBuffer(result.body)) {
    res.writeHead(result.status, result.headers);
    res.end(result.body);
  } else {
    sendResponse(res, result);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[flyx-proxy] Local stream proxy running on http://0.0.0.0:${PORT}`);
  console.log(`[flyx-proxy] TMDB API: ${TMDB_API_KEY ? 'configured' : 'NOT configured'}`);
  console.log(`[flyx-proxy] RPI Proxy: ${RPI_PROXY_URL ? 'configured' : 'NOT configured'}`);
});
