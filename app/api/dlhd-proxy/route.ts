/**
 * DLHD Stream Proxy API
 * 
 * Routes all DLHD requests through Cloudflare Worker → RPI Proxy
 * This ensures requests come from residential IP, not Vercel datacenter.
 * 
 * The Cloudflare Worker handles:
 *   - M3U8 playlist fetching and rewriting
 *   - Key proxying through RPI residential IP
 *   - Segment proxying
 * 
 * This Vercel route just forwards to the CF Worker.
 * Route is determined by NEXT_PUBLIC_USE_DLHD_PROXY:
 *   - true: /dlhd (Oxylabs residential proxy)
 *   - false: /tv (direct fetch with RPI fallback)
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Determine route based on env var
function getTvRoute(): string {
  return process.env.NEXT_PUBLIC_USE_DLHD_PROXY === 'true' ? '/dlhd' : '/tv';
}

export async function GET(request: NextRequest) {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL;
  
  if (!cfProxyUrl) {
    return NextResponse.json({
      error: 'DLHD proxy not configured',
      hint: 'Set NEXT_PUBLIC_CF_TV_PROXY_URL environment variable',
    }, { status: 503 });
  }
  
  // Strip trailing path if present
  const baseUrl = cfProxyUrl.replace(/\/(tv|dlhd)\/?$/, '');
  const route = getTvRoute();
  
  const searchParams = request.nextUrl.searchParams;
  const channel = searchParams.get('channel');

  if (!channel) {
    return NextResponse.json({
      error: 'Missing channel parameter',
      usage: 'GET /api/dlhd-proxy?channel=325',
    }, { status: 400 });
  }

  try {
    // Forward to Cloudflare Worker - route determined by NEXT_PUBLIC_USE_DLHD_PROXY
    const cfUrl = `${baseUrl}${route}?channel=${channel}`;
    
    const response = await fetch(cfUrl, {
      headers: {
        'Accept': 'application/vnd.apple.mpegurl',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DLHD] CF Worker error:', response.status, errorText);
      return NextResponse.json({
        error: 'Stream unavailable',
        details: errorText,
      }, { status: response.status });
    }

    const m3u8Content = await response.text();
    
    // Get headers from CF Worker response
    const iv = response.headers.get('X-DLHD-IV') || '';
    const serverKey = response.headers.get('X-DLHD-Server-Key') || '';

    return new NextResponse(m3u8Content, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-DLHD-IV': iv,
        'X-DLHD-Channel': channel,
        'X-DLHD-Server-Key': serverKey,
        'X-Proxied-Via': 'cloudflare-worker',
      },
    });

  } catch (error) {
    console.error('[DLHD] Proxy error:', error);
    return NextResponse.json({
      error: 'Proxy error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
