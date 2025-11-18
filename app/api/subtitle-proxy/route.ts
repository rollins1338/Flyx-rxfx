/**
 * Subtitle Proxy - Downloads and serves subtitles with proper CORS headers
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log('[SUBTITLE-PROXY] Fetching subtitle from:', url);

    // Fetch the subtitle file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('[SUBTITLE-PROXY] Failed to fetch subtitle:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch subtitle' },
        { status: response.status }
      );
    }

    const content = await response.text();

    // Return with proper CORS headers and content type
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('[SUBTITLE-PROXY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy subtitle' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
