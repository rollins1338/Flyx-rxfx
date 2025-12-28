/**
 * CDN Live Stream Decoder
 * 
 * Reverse engineered decoder for cdn-live.tv obfuscated player scripts.
 * Extracts the actual m3u8 stream URLs with authentication tokens.
 * 
 * The obfuscation uses a custom base conversion with variable alphabets.
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface DecodedStream {
  success: boolean;
  streamUrl?: string;
  channelId?: string;
  token?: string;
  expiresAt?: number;
  error?: string;
}

/**
 * Decode the obfuscated script to extract the m3u8 URL
 * 
 * The obfuscation pattern:
 * eval(function(h,u,n,t,e,r){
 *   r="";
 *   for(var i=0;i<h.length;i++){
 *     var s="";
 *     while(h[i]!==n[e]){s+=h[i];i++}  // Read until delimiter
 *     for(var j=0;j<n.length;j++) s=s.replace(n[j],j);  // Replace chars with indices
 *     r+=String.fromCharCode(baseConvert(s,e,10)-t)  // Convert and get char
 *   }
 *   return decodeURIComponent(escape(r))
 * }("ENCODED",u,"ALPHABET",offset,base,r))
 */
function decodeObfuscatedScript(encoded: string, alphabet: string, offset: number, base: number): string {
  let result = '';
  let i = 0;
  const delimiter = alphabet[base]; // Character at index 'base' is the delimiter
  
  while (i < encoded.length) {
    let segment = '';
    
    // Read characters until we hit the delimiter
    while (i < encoded.length && encoded[i] !== delimiter) {
      segment += encoded[i];
      i++;
    }
    i++; // Skip the delimiter
    
    if (segment.length > 0) {
      // Replace each alphabet character with its index
      let numStr = '';
      for (const char of segment) {
        const idx = alphabet.indexOf(char);
        if (idx !== -1) {
          numStr += idx.toString();
        }
      }
      
      // Convert from base to decimal
      let decimal = 0;
      for (let j = 0; j < numStr.length; j++) {
        decimal = decimal * base + parseInt(numStr[j], 10);
      }
      
      // Subtract offset to get the character code
      const charCode = decimal - offset;
      if (charCode > 0 && charCode < 65536) {
        result += String.fromCharCode(charCode);
      }
    }
  }
  
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}

/**
 * Extract obfuscation parameters from the script
 */
function extractObfuscationParams(script: string): {
  encoded: string;
  alphabet: string;
  offset: number;
  base: number;
} | null {
  // Find the eval call and extract parameters
  const evalIndex = script.indexOf('eval(function');
  if (evalIndex === -1) return null;
  
  const argsStart = script.indexOf('}("', evalIndex);
  if (argsStart === -1) return null;
  
  // Extract the encoded string
  const argsSection = script.substring(argsStart + 3);
  let encodedEnd = 0;
  
  for (let i = 0; i < argsSection.length; i++) {
    if (argsSection[i] === '"' && argsSection[i - 1] !== '\\') {
      encodedEnd = i;
      break;
    }
  }
  
  const encoded = argsSection.substring(0, encodedEnd);
  
  // Extract the other parameters
  const afterEncoded = argsSection.substring(encodedEnd + 1);
  const paramsPattern = /,\s*(\d+),\s*"([^"]+)",\s*(\d+),\s*(\d+),\s*(\d+)\)/;
  const paramsMatch = afterEncoded.match(paramsPattern);
  
  if (!paramsMatch) return null;
  
  return {
    encoded,
    alphabet: paramsMatch[2],
    offset: parseInt(paramsMatch[3], 10),
    base: parseInt(paramsMatch[4], 10),
  };
}

/**
 * Extract the m3u8 URL from decoded script
 */
function extractStreamUrl(decodedScript: string): string | null {
  // Look for playlistUrl assignment
  const playlistPattern = /playlistUrl\s*=\s*['"]([^'"]+)['"]/;
  const match = decodedScript.match(playlistPattern);
  
  if (match) {
    return match[1];
  }
  
  // Fallback: look for any m3u8 URL
  const m3u8Pattern = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i;
  const m3u8Match = decodedScript.match(m3u8Pattern);
  
  return m3u8Match ? m3u8Match[0] : null;
}

/**
 * Parse the stream URL to extract components
 */
function parseStreamUrl(url: string): { channelId: string; token: string; expiresAt?: number } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Path format: /api/v1/channels/{channelId}/index.m3u8
    const channelIndex = pathParts.indexOf('channels');
    const channelId = channelIndex !== -1 ? pathParts[channelIndex + 1] : '';
    
    const token = urlObj.searchParams.get('token') || '';
    
    // Token format: hash.timestamp.hash.hash.hash.hash
    // The second part is the expiration timestamp
    const tokenParts = token.split('.');
    let expiresAt: number | undefined;
    if (tokenParts.length >= 2) {
      const timestamp = parseInt(tokenParts[1], 10);
      if (!isNaN(timestamp)) {
        expiresAt = timestamp;
      }
    }
    
    return { channelId, token, expiresAt };
  } catch {
    return null;
  }
}

/**
 * Fetch and decode stream URL from CDN Live player page
 */
export async function decodeStreamFromPlayer(playerUrl: string): Promise<DecodedStream> {
  try {
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `Player page returned ${response.status}` };
    }
    
    const html = await response.text();
    
    // Find the obfuscated script
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let obfuscatedScript = '';
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      if (match[1].includes('eval(function')) {
        obfuscatedScript = match[1];
        break;
      }
    }
    
    if (!obfuscatedScript) {
      return { success: false, error: 'No obfuscated script found in player page' };
    }
    
    // Extract obfuscation parameters
    const params = extractObfuscationParams(obfuscatedScript);
    if (!params) {
      return { success: false, error: 'Could not extract obfuscation parameters' };
    }
    
    // Decode the script
    const decodedScript = decodeObfuscatedScript(
      params.encoded,
      params.alphabet,
      params.offset,
      params.base
    );
    
    if (!decodedScript) {
      return { success: false, error: 'Failed to decode obfuscated script' };
    }
    
    // Extract the stream URL
    const streamUrl = extractStreamUrl(decodedScript);
    if (!streamUrl) {
      return { success: false, error: 'Could not find stream URL in decoded script' };
    }
    
    // Parse the URL components
    const urlInfo = parseStreamUrl(streamUrl);
    
    return {
      success: true,
      streamUrl,
      channelId: urlInfo?.channelId,
      token: urlInfo?.token,
      expiresAt: urlInfo?.expiresAt,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to decode stream' };
  }
}

/**
 * Get stream URL for a CDN Live channel
 */
export async function getCDNLiveStreamUrl(
  channelName: string,
  countryCode: string = 'us'
): Promise<DecodedStream> {
  // Construct the player URL
  const encodedName = encodeURIComponent(channelName.toLowerCase());
  const playerUrl = `https://cdn-live.tv/api/v1/channels/player/?name=${encodedName}&code=${countryCode}&user=cdnlivetv&plan=free`;
  
  return decodeStreamFromPlayer(playerUrl);
}

/**
 * Check if a token is still valid
 */
export function isTokenValid(expiresAt?: number): boolean {
  if (!expiresAt) return true; // Assume valid if no expiration
  
  const now = Math.floor(Date.now() / 1000);
  return expiresAt > now;
}

/**
 * Get time until token expires (in seconds)
 */
export function getTokenTTL(expiresAt?: number): number {
  if (!expiresAt) return Infinity;
  
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, expiresAt - now);
}
