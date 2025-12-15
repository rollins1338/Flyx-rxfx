/**
 * DLHD Key Proxy API
 * 
 * Routes key requests through Cloudflare Worker → RPI Proxy
 * Keys MUST come from residential IP - datacenter IPs are blocked.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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
  
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const channel = searchParams.get('channel');

  if (!url && !channel) {
    return NextResponse.json({
      error: 'Missing parameters',
      usage: {
        url: 'GET /api/dlhd-proxy/key?url=<encoded_key_url>',
        channel: 'GET /api/dlhd-proxy/key?channel=325',
      },
    }, { status: 400 });
  }

  try {
    // Forward to Cloudflare Worker DLHD key endpoint
    let cfUrl: string;
    if (url) {
      cfUrl = `${baseUrl}/dlhd/key?url=${encodeURIComponent(url)}`;
    } else {
      cfUrl = `${baseUrl}/dlhd/key?channel=${channel}`;
    }
    
    const response = await fetch(cfUrl, {
      headers: {
        'Accept': 'application/octet-stream',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DLHD Key] CF Worker error:', response.status, errorText);
      return NextResponse.json({
        error: 'Key fetch failed',
        details: errorText,
      }, { status: response.status });
    }

    const keyBuffer = await response.arrayBuffer();
    
    // Validate key size (AES-128 keys should be 16 bytes)
    if (keyBuffer.byteLength !== 16) {
      console.error('[DLHD Key] Invalid key size:', keyBuffer.byteLength);
      return NextResponse.json({
        error: 'Invalid key data',
        size: keyBuffer.byteLength,
        expected: 16,
      }, { status: 502 });
    }

    return new NextResponse(keyBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': '16',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Cache-Control': 'no-cache',
        'X-Proxied-Via': 'cloudflare-worker',
      },
    });

  } catch (error) {
    console.error('[DLHD Key] Proxy error:', error);
    return NextResponse.json({
      error: 'Key proxy error',
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
