import { NextResponse } from 'next/server';

const API_BASE = 'https://api.cdn-live.tv';
const DEFAULT_USER = 'cdnlivetv';
const DEFAULT_PLAN = 'free';

export interface CDNLiveChannel {
  name: string;
  code: string;
  url: string;
  image: string;
  status: string;
  viewers: number;
}

export interface CDNLiveChannelsResponse {
  total_channels: number;
  channels: CDNLiveChannel[];
}

export async function GET() {
  try {
    const url = `${API_BASE}/api/v1/channels/?user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch channels', status: response.status },
        { status: response.status }
      );
    }

    const data: CDNLiveChannelsResponse = await response.json();
    
    // Group channels by country for easier filtering
    const channelsByCountry: Record<string, CDNLiveChannel[]> = {};
    for (const channel of data.channels) {
      const country = channel.code || 'other';
      if (!channelsByCountry[country]) {
        channelsByCountry[country] = [];
      }
      channelsByCountry[country].push(channel);
    }

    return NextResponse.json({
      total: data.total_channels,
      channels: data.channels,
      byCountry: channelsByCountry,
      countries: Object.keys(channelsByCountry).sort(),
    });
  } catch (error) {
    console.error('CDN Live channels error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels', details: String(error) },
      { status: 500 }
    );
  }
}
