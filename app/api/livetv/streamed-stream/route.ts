/**
 * Streamed.pk Stream Extractor API
 * 
 * Fetches stream URLs from streamed.pk for a given match.
 * Returns embed URLs that can be used to play the stream.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const API_BASE = 'https://streamed.pk/api';

interface StreamedStream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
  viewers?: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract m3u8 URL from embed page
 */
async function extractM3U8FromEmbed(embedUrl: string): Promise<string | null> {
  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Referer': 'https://streamed.pk/',
      },
    });

    const html = await response.text();

    // Look for m3u8 URLs in the page
    const m3u8Patterns = [
      /["']([^"']*\.m3u8[^"']*)["']/gi,
      /source:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
      /file:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
      /src:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
      /hls\.loadSource\s*\(\s*["']([^"']+)["']/gi,
    ];

    for (const pattern of m3u8Patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        if (url.includes('.m3u8') && !url.includes('example')) {
          return url;
        }
      }
    }

    // Look for base64 encoded URLs
    const base64Pattern = /atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/gi;
    let match;
    while ((match = base64Pattern.exec(html)) !== null) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        if (decoded.includes('.m3u8')) {
          return decoded;
        }
      } catch {
        // Ignore decode errors
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting m3u8:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const id = searchParams.get('id');
    const streamNo = searchParams.get('streamNo') || '1';

    if (!source || !id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: source and id',
      }, { status: 400 });
    }

    // Fetch streams from API
    const streams = await fetchJson<StreamedStream[]>(`${API_BASE}/stream/${source}/${id}`);

    if (!streams || streams.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No streams available for this match',
      }, { status: 404 });
    }

    // Find requested stream
    const streamIndex = parseInt(streamNo, 10) - 1;
    const stream = streams[streamIndex] || streams[0];

    // Try to extract m3u8 from embed URL
    let streamUrl: string | null = null;
    if (stream.embedUrl) {
      streamUrl = await extractM3U8FromEmbed(stream.embedUrl);
    }

    return NextResponse.json({
      success: true,
      stream: {
        id: stream.id,
        streamNo: stream.streamNo,
        language: stream.language,
        hd: stream.hd,
        source: stream.source,
        viewers: stream.viewers,
        embedUrl: stream.embedUrl,
        streamUrl, // May be null if extraction failed
      },
      allStreams: streams.map(s => ({
        streamNo: s.streamNo,
        language: s.language,
        hd: s.hd,
        source: s.source,
      })),
    });

  } catch (error: any) {
    console.error('[Streamed Stream API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch stream',
    }, { status: 500 });
  }
}
