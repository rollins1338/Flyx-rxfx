/**
 * Combined Stream & TV Proxy Cloudflare Worker
 * 
 * Routes:
 *   /stream/*  - Anti-leech stream proxy (requires token)
 *   /tv/*      - TV proxy for DLHD live streams
 *   /decode    - Isolated decoder sandbox for untrusted scripts
 *   /health    - Health check endpoint
 * 
 * Anti-Leech Protection:
 *   - All stream requests require cryptographic tokens
 *   - Tokens are bound to browser fingerprint + session
 *   - Tokens expire after 5 minutes
 *   - Unauthorized requests get the ORIGINAL URL (not proxied)
 * 
 * Deploy: wrangler deploy
 * Tail logs: npx wrangler tail media-proxy
 */

import streamProxy from './stream-proxy';
import antiLeechProxy from './anti-leech-proxy';
import fortressProxy from './fortress-proxy';
import quantumShield from './quantum-shield';
import quantumShieldV2 from './quantum-shield-v2';
import quantumShieldV3 from './quantum-shield-v3';
import tvProxy from './tv-proxy';
import decoderSandbox from './decoder-sandbox';
import { createLogger, generateRequestId, type LogLevel } from './logger';

export interface Env {
  API_KEY?: string;
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
  LOG_LEVEL?: string;
  // Anti-leech settings
  ALLOWED_ORIGINS?: string;
  SIGNING_SECRET?: string;
  NONCE_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;
  BLACKLIST_KV?: KVNamespace;
  WATERMARK_SECRET?: string;
  // Protection modes: 'none' | 'basic' | 'fortress' | 'quantum'
  PROTECTION_MODE?: string;
  // Legacy - kept for backwards compatibility
  ENABLE_ANTI_LEECH?: string;
}

// Simple in-memory metrics (resets on worker restart)
const metrics = {
  requests: 0,
  errors: 0,
  streamRequests: 0,
  tvRequests: 0,
  decodeRequests: 0,
  startTime: Date.now(),
};

// CORS headers for all responses
function getCorsHeaders(origin?: string | null): Record<string, string> {
  // Always allow all origins for stream proxy - CORS is handled by the browser
  // The anti-leech protection is done via tokens, not CORS
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type, X-Request-ID, Authorization',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const logLevel = (env.LOG_LEVEL || 'debug') as LogLevel;
    const logger = createLogger(request, logLevel);
    const requestOrigin = request.headers.get('origin');

    metrics.requests++;

    // Handle CORS preflight for ALL routes
    if (request.method === 'OPTIONS') {
      logger.info('CORS preflight request', { path, origin: requestOrigin });
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(requestOrigin),
      });
    }

    // Health check endpoint
    if (path === '/health' || path === '/health/') {
      const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
      logger.info('Health check', { uptime, metrics });
      
      return new Response(JSON.stringify({
        status: 'healthy',
        uptime: `${uptime}s`,
        metrics: {
          totalRequests: metrics.requests,
          errors: metrics.errors,
          streamRequests: metrics.streamRequests,
          tvRequests: metrics.tvRequests,
          decodeRequests: metrics.decodeRequests,
        },
        timestamp: new Date().toISOString(),
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Route to stream proxy (with protection based on mode)
    if (path.startsWith('/stream')) {
      metrics.streamRequests++;
      
      // Determine protection mode
      const protectionMode = env.PROTECTION_MODE || 
        (env.ENABLE_ANTI_LEECH === 'true' ? 'basic' : 'none');
      
      try {
        const newUrl = new URL(request.url);
        newUrl.pathname = path.replace(/^\/stream/, '') || '/';
        const newRequest = new Request(newUrl.toString(), request);

        switch (protectionMode) {
          case 'quantum-v3':
          case 'paranoid':
            // QUANTUM V3 PARANOID MODE: Maximum security
            // Requires: 3 challenges, PoW, fingerprint, behavioral data
            // Tokens expire in 10 seconds, strict rate limiting
            logger.info('Routing to QUANTUM SHIELD V3 (PARANOID)', { path });
            return await quantumShieldV3.fetch(newRequest, env as any);

          case 'quantum-v2':
            // QUANTUM V2: Enhanced with behavioral analysis, automation detection
            // Dynamic challenges, impossible travel detection, mouse entropy
            logger.info('Routing to QUANTUM SHIELD V2', { path });
            return await quantumShieldV2.fetch(newRequest, env as any);

          case 'quantum':
            // QUANTUM MODE: The most paranoid protection ever created
            // Requires SESSION_KV, BLACKLIST_KV, WATERMARK_SECRET
            // Features: Browser proofs, WASM challenges, Merkle trees,
            // Honeypots, Watermarking, Behavioral analysis, ASN binding
            logger.info('Routing to QUANTUM SHIELD', { path });
            return await quantumShield.fetch(newRequest, env as any);

          case 'fortress':
            // FORTRESS MODE: PoW + Session + Chaining
            // Requires SESSION_KV binding and client-side fortress-client.ts
            logger.info('Routing to FORTRESS proxy', { path });
            return await fortressProxy.fetch(newRequest, env as any);
            
          case 'basic':
            // BASIC MODE: Token + Fingerprint binding
            logger.info('Routing to anti-leech proxy', { path });
            return await antiLeechProxy.fetch(newRequest, env as any);
            
          default:
            // NO PROTECTION: Legacy mode
            logger.info('Routing to stream proxy (NO PROTECTION)', { path });
            return await streamProxy.fetch(newRequest, env);
        }
      } catch (error) {
        metrics.errors++;
        logger.error('Stream proxy error', error as Error);
        return errorResponse('Stream proxy error', 500);
      }
    }
    
    // FORTRESS endpoints (session init, challenge)
    if (path === '/init' || path === '/challenge') {
      const mode = env.PROTECTION_MODE || 'fortress';
      if (mode === 'quantum') {
        logger.info('Routing to quantum endpoint', { path });
        return await quantumShield.fetch(request, env as any);
      }
      logger.info('Routing to fortress endpoint', { path });
      return await fortressProxy.fetch(request, env as any);
    }

    // QUANTUM SHIELD V3 endpoints (PARANOID MODE)
    if (path.startsWith('/v3/')) {
      logger.info('Routing to quantum shield v3 (PARANOID)', { path });
      return await quantumShieldV3.fetch(request, env as any);
    }

    // QUANTUM SHIELD V2 endpoints
    if (path.startsWith('/v2/')) {
      logger.info('Routing to quantum shield v2', { path });
      return await quantumShieldV2.fetch(request, env as any);
    }

    // QUANTUM SHIELD endpoints
    if (path.startsWith('/quantum/')) {
      logger.info('Routing to quantum shield', { path });
      return await quantumShield.fetch(request, env as any);
    }

    // Route to TV proxy
    if (path.startsWith('/tv')) {
      metrics.tvRequests++;
      logger.info('Routing to TV proxy', { path });
      
      try {
        const newUrl = new URL(request.url);
        newUrl.pathname = path.replace(/^\/tv/, '') || '/';
        const newRequest = new Request(newUrl.toString(), request);
        logger.debug('TV proxy request', { newUrl: newUrl.toString() });
        return await tvProxy.fetch(newRequest, env);
      } catch (error) {
        metrics.errors++;
        const err = error as Error;
        logger.error('TV proxy error', err);
        return new Response(JSON.stringify({
          error: 'TV proxy error',
          message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Route to decoder sandbox
    if (path === '/decode' || path === '/decode/') {
      metrics.decodeRequests++;
      logger.info('Routing to decoder sandbox');
      
      try {
        return await decoderSandbox.fetch(request, env);
      } catch (error) {
        metrics.errors++;
        logger.error('Decoder sandbox error', error as Error);
        return errorResponse('Decoder sandbox error', 500);
      }
    }

    // Root - show usage and status
    logger.info('Root endpoint accessed');
    
    const antiLeechEnabled = env.ENABLE_ANTI_LEECH === 'true';
    
    return new Response(JSON.stringify({
      name: 'Cloudflare Stream & TV Proxy',
      version: '3.0.0',
      status: 'operational',
      uptime: `${Math.floor((Date.now() - metrics.startTime) / 1000)}s`,
      antiLeech: {
        enabled: antiLeechEnabled,
        description: antiLeechEnabled 
          ? 'Requests require cryptographic tokens bound to browser fingerprint'
          : 'Legacy mode - no protection (set ENABLE_ANTI_LEECH=true to enable)',
      },
      routes: {
        stream: {
          path: '/stream/',
          description: antiLeechEnabled 
            ? 'Anti-leech HLS stream proxy (requires token)'
            : 'HLS stream proxy for 2embed',
          usage: antiLeechEnabled
            ? '/stream/?url=<url>&t=<token>&f=<fingerprint>&s=<session>'
            : '/stream/?url=<encoded_url>&source=2embed&referer=<encoded_referer>',
          tokenEndpoint: antiLeechEnabled ? '/stream/token' : undefined,
        },
        tv: {
          path: '/tv/',
          description: 'DLHD live TV proxy',
          usage: '/tv/?channel=<id>',
          subRoutes: {
            key: '/tv/key?url=<encoded_url>',
            segment: '/tv/segment?url=<encoded_url>',
          },
        },
        decode: {
          path: '/decode',
          description: 'Isolated decoder sandbox for untrusted scripts',
          method: 'POST',
          body: '{ script: string, divId: string, encodedContent: string }',
        },
        health: {
          path: '/health',
          description: 'Health check and metrics',
        },
      },
      observability: {
        logs: 'View in Cloudflare Dashboard > Workers > Logs',
        tailCommand: 'npx wrangler tail media-proxy',
        logLevel: logLevel,
      },
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ 
    error: message,
    timestamp: new Date().toISOString(),
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
