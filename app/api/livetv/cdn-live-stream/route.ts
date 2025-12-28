import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SITE_BASE = 'https://cdn-live.tv';
const DEFAULT_USER = 'cdnlivetv';
const DEFAULT_PLAN = 'free';

// Base charset for the obfuscation decoder
const BASE_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

/**
 * Base conversion function used by the obfuscation
 * Converts a number string from base `e` to base `f`
 */
function baseConvert(d: string, e: number, f: number): string {
  const g = BASE_CHARSET.split('');
  const h = g.slice(0, e);
  const i = g.slice(0, f);
  
  // Convert from base e to decimal
  let j = d.split('').reverse().reduce((a, b, c) => {
    const idx = h.indexOf(b);
    if (idx !== -1) {
      return a + idx * Math.pow(e, c);
    }
    return a;
  }, 0);
  
  // Convert from decimal to base f
  let k = '';
  while (j > 0) {
    k = i[j % f] + k;
    j = Math.floor(j / f);
  }
  return k || '0';
}

/**
 * Decodes the obfuscated JavaScript from cdn-live.tv player pages
 * 
 * The obfuscation format is: eval(function(h,u,n,t,e,r){...}("encoded",u,"charset",t,e,r))
 * Where:
 * - h = encoded data
 * - n = charset for encoding
 * - t = offset to subtract from char codes
 * - e = delimiter index in charset
 */
function decodeObfuscatedScript(html: string): string | null {
  // Find the obfuscated script
  const scriptStart = html.indexOf('<script>var _0x');
  if (scriptStart === -1) {
    return null;
  }
  
  const scriptEnd = html.indexOf('</script>', scriptStart);
  const script = html.substring(scriptStart + 8, scriptEnd);
  
  // Extract parameters from the end: ",u,"charset",t,e,r))
  const endMatch = script.match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)$/);
  if (!endMatch) {
    return null;
  }
  
  const charset = endMatch[2];          // n - charset for encoding
  const offset = parseInt(endMatch[3]); // t - offset to subtract
  const delimiterIdx = parseInt(endMatch[4]); // e - delimiter index
  const delimiter = charset[delimiterIdx];
  
  // Find the encoded data
  const evalIdx = script.indexOf('eval(function(h,u,n,t,e,r)');
  if (evalIdx === -1) {
    return null;
  }
  
  const dataStartIdx = script.indexOf('("', evalIdx) + 2;
  const dataEndIdx = script.lastIndexOf('",');
  const encoded = script.substring(dataStartIdx, dataEndIdx);
  
  // Decode
  let result = '';
  let i = 0;
  
  while (i < encoded.length) {
    let s = '';
    // Read until delimiter
    while (i < encoded.length && encoded[i] !== delimiter) {
      s += encoded[i];
      i++;
    }
    i++; // Skip delimiter
    
    // Replace charset chars with their indices
    for (let j = 0; j < charset.length; j++) {
      s = s.split(charset[j]).join(j.toString());
    }
    
    // Convert from base delimiterIdx to base 10, subtract offset
    const charCode = parseInt(baseConvert(s, delimiterIdx, 10)) - offset;
    result += String.fromCharCode(charCode);
  }
  
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}

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
  
  // Decode the obfuscated script
  const decoded = decodeObfuscatedScript(html);
  
  if (!decoded) {
    throw new Error('Failed to decode obfuscated script');
  }
  
  // Extract playlistUrl from decoded script
  const playlistMatch = decoded.match(/playlistUrl\s*=\s*['"]([^'"]+)['"]/);
  if (playlistMatch) {
    return playlistMatch[1];
  }
  
  // Try alternative pattern - src in source object
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
    const streamUrl = await extractStreamUrl(channelName, countryCode);

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
