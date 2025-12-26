import { NextRequest, NextResponse } from 'next/server';
import vm from 'vm';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SITE_BASE = 'https://cdn-live.tv';
const DEFAULT_USER = 'cdnlivetv';
const DEFAULT_PLAN = 'free';

/**
 * Extracts the m3u8 stream URL from cdn-live.tv player page
 * The URL is embedded in obfuscated JavaScript that we decode
 */
async function extractStreamUrl(channelName: string, countryCode: string): Promise<string | null> {
  const playerUrl = `${SITE_BASE}/api/v1/channels/player/?name=${encodeURIComponent(channelName)}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
  
  const response = await fetch(playerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Referer': 'https://cdn-live.tv/',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch player page: ${response.status}`);
  }

  const html = await response.text();
  
  // Find the obfuscated script
  const scriptStart = html.indexOf('<script>var _0xc');
  if (scriptStart === -1) {
    throw new Error('No obfuscated script found in player page');
  }
  
  const scriptEnd = html.indexOf('</script>', scriptStart);
  const script = html.substring(scriptStart + 8, scriptEnd);
  
  // Replace eval with a function that returns the result
  const modifiedScript = script.replace(
    /eval\(function\(h,u,n,t,e,r\)/,
    'result = (function(h,u,n,t,e,r)'
  );
  
  // Create sandbox context
  const sandbox: Record<string, unknown> = {
    result: null,
    window: { location: { hostname: 'cdn-live.tv', href: '' } },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {} }),
      body: { appendChild: () => {} },
      head: { appendChild: () => {} },
    },
    console: { log: () => {}, error: () => {} },
    OPlayer: { make: () => ({ use: () => ({ create: () => {} }) }) },
    OUI: () => ({}),
    OHls: () => ({}),
    OPlugin: { AirPlay: class {}, Chromecast: class {} },
    fetch: () => Promise.resolve({ ok: true, status: 200 }),
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout: () => {},
    AbortController: class { signal = {}; abort() {} },
    MutationObserver: class { observe() {} },
  };
  
  try {
    vm.createContext(sandbox);
    vm.runInContext(modifiedScript, sandbox, { timeout: 5000 });
    
    const decoded = sandbox.result as string;
    
    if (!decoded) {
      throw new Error('Failed to decode obfuscated script');
    }
    
    // Extract playlistUrl from decoded script
    const playlistMatch = decoded.match(/playlistUrl\s*=\s*['"]([^'"]+)['"]/);
    if (playlistMatch) {
      return playlistMatch[1];
    }
    
    // Try alternative pattern
    const srcMatch = decoded.match(/src:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
    if (srcMatch) {
      return srcMatch[1];
    }
    
    // Try to find any m3u8 URL
    const m3u8Match = decoded.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/);
    if (m3u8Match) {
      return m3u8Match[0];
    }
    
    throw new Error('Could not find stream URL in decoded script');
  } catch (error) {
    // Fallback: try regex on the raw script for the URL pattern
    const urlMatch = html.match(/https:\/\/edge\.cdn-live-tv\.ru\/api\/v1\/channels\/[^'"]+\.m3u8\?token=[^'"]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
    throw error;
  }
}

/**
 * Alternative extraction using regex patterns
 * This is a fallback if VM execution fails
 */
function extractStreamUrlFallback(html: string): string | null {
  // The stream URL pattern
  const patterns = [
    /https:\/\/edge\.cdn-live-tv\.ru\/api\/v1\/channels\/[^'"]+\.m3u8\?token=[^'"]+/,
    /playlistUrl\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
    /src:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const channelName = searchParams.get('name');
  const countryCode = searchParams.get('code') || 'us';

  if (!channelName) {
    return NextResponse.json(
      { error: 'Channel name is required' },
      { status: 400 }
    );
  }

  try {
    // First try with VM execution
    let streamUrl: string | null = null;
    
    try {
      streamUrl = await extractStreamUrl(channelName, countryCode);
    } catch (vmError) {
      console.warn('VM extraction failed, trying fallback:', vmError);
      
      // Fallback: fetch page and use regex
      const playerUrl = `${SITE_BASE}/api/v1/channels/player/?name=${encodeURIComponent(channelName)}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
      const response = await fetch(playerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Referer': 'https://cdn-live.tv/',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        streamUrl = extractStreamUrlFallback(html);
      }
    }

    if (!streamUrl) {
      return NextResponse.json(
        { error: 'Could not extract stream URL', channel: channelName },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      channel: channelName,
      country: countryCode,
      streamUrl,
      source: 'cdn-live.tv',
    });
  } catch (error) {
    console.error('CDN Live stream extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract stream', details: String(error) },
      { status: 500 }
    );
  }
}
