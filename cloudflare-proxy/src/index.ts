/**
 * Combined Stream & TV Proxy Cloudflare Worker
 * 
 * Routes:
 *   /stream/*  - Stream proxy for 2embed/HLS streams
 *   /tv/*      - TV proxy for DLHD live streams
 *   /decode    - Isolated decoder sandbox for untrusted scripts
 *   /health    - Health check endpoint
 *   /logs      - Recent logs summary (if enabled)
 * 
 * Deploy: wrangler deploy
 * Tail logs: npx wrangler tail media-proxy
 */

import streamProxy from './stream-proxy';
import tvProxy from './tv-proxy';
import decoderSandbox from './decoder-sandbox';
import { createLogger, generateRequestId, type LogLevel } from './logger';

export interface Env {
  API_KEY?: string;
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
  LOG_LEVEL?: string;
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const logLevel = (env.LOG_LEVEL || 'debug') as LogLevel;
    const logger = createLogger(request, logLevel);

    metrics.requests++;

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

    // Route to stream proxy
    if (path.startsWith('/stream')) {
      metrics.streamRequests++;
      logger.info('Routing to stream proxy', { path });
      
      try {
        const newUrl = new URL(request.url);
        newUrl.pathname = path.replace(/^\/stream/, '') || '/';
        const newRequest = new Request(newUrl.toString(), request);
        return await streamProxy.fetch(newRequest, env);
      } catch (error) {
        metrics.errors++;
        logger.error('Stream proxy error', error as Error);
        return errorResponse('Stream proxy error', 500);
      }
    }

    // Route to TV proxy
    if (path.startsWith('/tv')) {
      metrics.tvRequests++;
      logger.info('Routing to TV proxy', { path });
      
      try {
        const newUrl = new URL(request.url);
        newUrl.pathname = path.replace(/^\/tv/, '') || '/';
        const newRequest = new Request(newUrl.toString(), request);
        return await tvProxy.fetch(newRequest, env);
      } catch (error) {
        metrics.errors++;
        logger.error('TV proxy error', error as Error);
        return errorResponse('TV proxy error', 500);
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
    
    return new Response(JSON.stringify({
      name: 'Cloudflare Stream & TV Proxy',
      version: '2.0.0',
      status: 'operational',
      uptime: `${Math.floor((Date.now() - metrics.startTime) / 1000)}s`,
      routes: {
        stream: {
          path: '/stream/',
          description: 'HLS stream proxy for 2embed',
          usage: '/stream/?url=<encoded_url>&source=2embed&referer=<encoded_referer>',
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
