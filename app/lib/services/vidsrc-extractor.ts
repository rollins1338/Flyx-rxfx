/**
 * VidSrc Extractor
 * Extracts streams from vidsrc-embed.ru → cloudnestra.com
 *
 * ⚠️ SECURITY WARNING ⚠️
 * This extractor executes remote JavaScript code from third-party sites
 * using new Function(). This is DISABLED BY DEFAULT for safety.
 *
 * To enable, set ENABLE_VIDSRC_PROVIDER=true in your environment.
 * By enabling this, you accept the security risk of running third-party code.
 *
 * TURNSTILE BYPASS:
 * If Cloudflare Turnstile appears, you can optionally use a captcha solving service.
 * Set CAPSOLVER_API_KEY in your environment to enable automatic Turnstile solving.
 * Cost: ~$2-3 per 1000 solves at https://capsolver.com
 */

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  status?: 'working' | 'down';
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  error?: string;
}

// ⚠️ SECURITY: VidSrc is DISABLED by default - must explicitly enable
// When enabled, decoder scripts run via new Function() - user accepts the risk
export const VIDSRC_ENABLED = process.env.ENABLE_VIDSRC_PROVIDER === 'true';

// Optional: Captcha solving service API key for Turnstile bypass
const CAPSOLVER_API_KEY = process.env.CAPSOLVER_API_KEY;

// Domain for stream URLs
const STREAM_DOMAIN = 'shadowlandschronicles.com';

/**
 * Fetch with proper headers and timeout
 * Uses browser-like headers to avoid Cloudflare detection
 */
async function fetchWithHeaders(url: string, referer?: string, timeoutMs: number = 15000): Promise<Response> {
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'cross-site' : 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };

  if (referer) {
    headers['Referer'] = referer;
    // Add Origin header for cross-origin requests
    try {
      const refererUrl = new URL(referer);
      headers['Origin'] = refererUrl.origin;
    } catch {
      // Invalid referer URL, skip Origin
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      // Follow redirects
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Custom atob for Edge runtime compatibility
 */
function customAtob(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('binary');
  }
  // Edge runtime has native atob
  return atob(str);
}

/**
 * Custom btoa for Edge runtime compatibility
 */
function customBtoa(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'binary').toString('base64');
  }
  return btoa(str);
}

/**
 * Solve Cloudflare Turnstile using CapSolver API
 * Requires CAPSOLVER_API_KEY environment variable
 * @returns The Turnstile token or null if solving fails/not configured
 */
async function solveTurnstile(
  siteKey: string,
  pageUrl: string
): Promise<string | null> {
  if (!CAPSOLVER_API_KEY) {
    console.log('[VidSrc] No CAPSOLVER_API_KEY configured - cannot solve Turnstile');
    return null;
  }

  console.log('[VidSrc] Attempting to solve Turnstile via CapSolver...');

  try {
    // Create task
    const createResponse = await fetch('https://api.capsolver.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: CAPSOLVER_API_KEY,
        task: {
          type: 'AntiTurnstileTaskProxyLess',
          websiteURL: pageUrl,
          websiteKey: siteKey,
        },
      }),
    });

    const createData = (await createResponse.json()) as {
      taskId?: string;
      errorId?: number;
    };
    if (!createData.taskId) {
      console.error('[VidSrc] CapSolver task creation failed');
      return null;
    }

    // Poll for result (max 60 seconds)
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const resultResponse = await fetch(
        'https://api.capsolver.com/getTaskResult',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientKey: CAPSOLVER_API_KEY,
            taskId: createData.taskId,
          }),
        }
      );

      const resultData = (await resultResponse.json()) as {
        status?: string;
        solution?: { token?: string };
      };

      if (resultData.status === 'ready' && resultData.solution?.token) {
        console.log('[VidSrc] Turnstile solved successfully!');
        return resultData.solution.token;
      }

      if (resultData.status === 'failed') {
        console.error('[VidSrc] CapSolver task failed');
        return null;
      }
    }

    console.error('[VidSrc] CapSolver timeout');
    return null;
  } catch (error) {
    console.error('[VidSrc] CapSolver error:', error);
    return null;
  }
}

/**
 * Submit Turnstile token to verify endpoint
 */
async function submitTurnstileToken(
  verifyUrl: string,
  token: string,
  referer: string
): Promise<string | null> {
  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: referer,
        Origin: new URL(referer).origin,
      },
      body: `token=${encodeURIComponent(token)}`,
    });

    if (response.ok) {
      return await response.text();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * STATIC DECODERS - No remote script fetching required!
 * These are reverse-engineered implementations of the encoding algorithms.
 * This avoids Cloudflare detection from fetching decoder scripts.
 */

// Custom base64 alphabet used by PlayerJS (shuffled)
const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';

/**
 * Custom base64 decoder with shuffled alphabet
 */
function customBase64Decode(encoded: string): string {
  let result = '';
  let i = 0;
  const clean = encoded.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < clean.length) {
    const s = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const o = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const u = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    const a = CUSTOM_ALPHABET.indexOf(clean.charAt(i++));
    
    const n = (s << 2) | (o >> 4);
    const r = ((o & 15) << 4) | (u >> 2);
    const c = ((u & 3) << 6) | a;
    
    result += String.fromCharCode(n);
    if (u !== 64) result += String.fromCharCode(r);
    if (a !== 64) result += String.fromCharCode(c);
  }
  
  // UTF-8 decode
  let decoded = '';
  let j = 0;
  while (j < result.length) {
    const code = result.charCodeAt(j);
    if (code < 128) {
      decoded += String.fromCharCode(code);
      j++;
    } else if (code > 191 && code < 224) {
      const c2 = result.charCodeAt(j + 1);
      decoded += String.fromCharCode(((code & 31) << 6) | (c2 & 63));
      j += 2;
    } else {
      const c2 = result.charCodeAt(j + 1);
      const c3 = result.charCodeAt(j + 2);
      decoded += String.fromCharCode(((code & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      j += 3;
    }
  }
  
  return decoded;
}

/**
 * ROT3 Decoder - for content starting with "eqqmp://"
 * The encoding shifts 'https' to 'eqqmp' (h->e, t->q, etc.)
 * So we need to shift FORWARD by 3 to decode (e->h, q->t)
 * NOTE: Only letters are shifted, NOT numbers!
 */
function decodeRot3(encoded: string): string {
  let decoded = '';
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const code = char.charCodeAt(0);
    
    // Lowercase letters: shift forward by 3
    if (code >= 97 && code <= 122) {
      decoded += String.fromCharCode(((code - 97 + 3) % 26) + 97);
    }
    // Uppercase letters: shift forward by 3
    else if (code >= 65 && code <= 90) {
      decoded += String.fromCharCode(((code - 65 + 3) % 26) + 65);
    }
    // Keep numbers and other characters as-is (NOT shifted!)
    else {
      decoded += char;
    }
  }
  return decoded;
}

/**
 * OLD Format Decoder - for div ID "eSfH1IRMyL" or content with colons
 * Algorithm: Reverse → Subtract 1 from each char → Hex decode
 */
function decodeOldFormat(encoded: string): string {
  // Step 1: Reverse the string
  const reversed = encoded.split('').reverse().join('');
  
  // Step 2: Subtract 1 from each character code
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  
  // Step 3: Convert hex pairs to ASCII
  let decoded = '';
  for (let i = 0; i < adjusted.length; i += 2) {
    const hexPair = adjusted.substring(i, i + 2);
    const charCode = parseInt(hexPair, 16);
    if (!isNaN(charCode) && charCode > 0) {
      decoded += String.fromCharCode(charCode);
    }
  }
  
  return decoded;
}

/**
 * BASE64 Format Decoder - for standard base64 content
 * Algorithm: Strip leading "=" → Reverse → URL-safe base64 decode → Subtract shift
 */
function decodeBase64Format(encoded: string, shift: number = 3): string {
  try {
    // Step 1: Strip leading "=" if present
    let data = encoded.startsWith('=') ? encoded.substring(1) : encoded;
    
    // Step 2: Reverse the string
    data = data.split('').reverse().join('');
    
    // Step 3: URL-safe base64 decode (replace - with + and _ with /)
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (data.length % 4 !== 0) {
      data += '=';
    }
    
    // Decode base64
    const decoded = customAtob(data);
    
    // Step 4: Subtract shift value from each character
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) - shift);
    }
    
    return result;
  } catch {
    return '';
  }
}

/**
 * PlayerJS Format Decoder - for #0 and #1 prefixed content
 * Uses custom shuffled base64 alphabet
 */
function decodePlayerJsFormat(encoded: string): string {
  if (encoded.startsWith('#0')) {
    // Direct custom base64 decode
    return customBase64Decode(encoded.substring(2));
  } else if (encoded.startsWith('#1')) {
    // Pepper transformation + custom base64 decode
    let data = encoded.substring(2);
    data = data.replace(/#/g, '+');
    return customBase64Decode(data);
  }
  return '';
}

/**
 * HEX Format Decoder - MAIN DECODER for cloudnestra content
 * Algorithm: Reverse → Subtract 1 from each char → Hex decode
 * This is the primary format used by cloudnestra.com as of December 2024
 */
function decodeHexFormat(encoded: string): string {
  // Step 1: Reverse the string
  const reversed = encoded.split('').reverse().join('');
  
  // Step 2: Subtract 1 from each character code
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  
  // Step 3: Remove any non-hex characters (like colons)
  const hexClean = adjusted.replace(/[^0-9a-fA-F]/g, '');
  
  // Step 4: Convert hex pairs to ASCII
  let decoded = '';
  for (let i = 0; i < hexClean.length; i += 2) {
    const hexPair = hexClean.substring(i, i + 2);
    const charCode = parseInt(hexPair, 16);
    if (!isNaN(charCode) && charCode > 0) {
      decoded += String.fromCharCode(charCode);
    }
  }
  
  return decoded;
}

/**
 * Detect encoding format and decode accordingly
 */
function staticDecode(divId: string, encodedContent: string): string | null {
  console.log(`[VidSrc] Static decoding - divId: ${divId}, content length: ${encodedContent.length}`);
  const contentPreview = encodedContent.substring(0, 80);
  
  // Check for ROT3 format (content starts with "eqqmp://")
  if (encodedContent.startsWith('eqqmp://')) {
    console.log('[VidSrc] Detected ROT3 format');
    const decoded = decodeRot3(encodedContent);
    if (decoded.includes('https://')) return decoded;
  }
  
  // Check for PlayerJS format (#0 or #1 prefix)
  if (encodedContent.startsWith('#0') || encodedContent.startsWith('#1')) {
    console.log('[VidSrc] Detected PlayerJS format');
    const decoded = decodePlayerJsFormat(encodedContent);
    if (decoded.includes('https://')) return decoded;
  }
  
  // Check for REVERSED BASE64 format (content starts with "==" which is reversed padding)
  // Algorithm: Reverse → Base64 decode → Subtract shift from each char
  // This is a common format as of December 2024
  if (encodedContent.startsWith('==') || encodedContent.startsWith('=')) {
    console.log('[VidSrc] Detected REVERSED BASE64 format (starts with =)');
    const shifts = [3, 5, 7, 1, 2, 4, 6];
    for (const shift of shifts) {
      const decoded = decodeBase64Format(encodedContent, shift);
      if (decoded.includes('https://') && decoded.includes('.m3u8')) {
        console.log(`[VidSrc] REVERSED BASE64 decode successful with shift ${shift}`);
        return decoded;
      }
    }
  }
  
  // Try HEX format (Reverse + Subtract 1 + Hex decode)
  // Content looks like: "946844e7f35848:7d7g325252525f5b8f77834f3b725:4:444258644869868357..."
  if (encodedContent.includes(':') || /^[0-9a-f]{10,}/i.test(contentPreview)) {
    console.log('[VidSrc] Trying HEX format (reverse + subtract 1 + hex decode)');
    const decoded = decodeHexFormat(encodedContent);
    if (decoded.includes('https://') && decoded.includes('.m3u8')) {
      console.log('[VidSrc] HEX format decode successful!');
      return decoded;
    }
  }
  
  // Try OLD format (same algorithm as HEX, different detection)
  console.log('[VidSrc] Trying OLD format decoder');
  const oldDecoded = decodeOldFormat(encodedContent);
  if (oldDecoded.includes('https://')) {
    console.log('[VidSrc] OLD format decode successful');
    return oldDecoded;
  }
  
  // Try BASE64 format with different shift values (fallback for any content)
  console.log('[VidSrc] Trying BASE64 format with various shifts');
  const shifts = [3, 5, 7, 1, 2, 4, 6];
  for (const shift of shifts) {
    const decoded = decodeBase64Format(encodedContent, shift);
    if (decoded.includes('https://') && (decoded.includes('.m3u8') || decoded.includes('shadowlandschronicles'))) {
      console.log(`[VidSrc] BASE64 decode successful with shift ${shift}`);
      return decoded;
    }
  }
  
  // Try custom base64 directly (without shift)
  try {
    const decoded = customBase64Decode(encodedContent);
    if (decoded.includes('https://')) {
      console.log('[VidSrc] Custom base64 decode successful');
      return decoded;
    }
  } catch {
    // Ignore
  }
  
  // Try standard base64 with URL-safe chars
  try {
    let data = encodedContent.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4 !== 0) data += '=';
    const decoded = customAtob(data);
    if (decoded.includes('https://')) {
      console.log('[VidSrc] Standard base64 decode successful');
      return decoded;
    }
  } catch {
    // Ignore
  }
  
  console.error('[VidSrc] Static decode failed - unknown format');
  console.error('[VidSrc] Content preview:', contentPreview);
  return null;
}

/**
 * Execute decoder - tries static decode first, falls back to remote script if needed
 */
async function executeDecoder(
  decoderScript: string | null, 
  divId: string, 
  encodedContent: string
): Promise<string | null> {
  // First, try static decoding (no remote script needed!)
  console.log('[VidSrc] Attempting static decode (no remote script)...');
  const staticResult = staticDecode(divId, encodedContent);
  
  if (staticResult && staticResult.includes('https://')) {
    console.log('[VidSrc] Static decode successful!');
    return staticResult;
  }
  
  // If static decode failed and we have a decoder script, try dynamic execution
  if (decoderScript) {
    console.log('[VidSrc] Static decode failed, trying dynamic decoder...');
    
    try {
      const mockWindow: Record<string, unknown> = {};
      const mockDocument = {
        getElementById: (id: string) => {
          if (id === divId) {
            return { innerHTML: encodedContent };
          }
          return null;
        }
      };
      
      const decoderFn = new Function(
        'window',
        'document', 
        'atob',
        'btoa',
        decoderScript
      );
      
      decoderFn(mockWindow, mockDocument, customAtob, customBtoa);
      
      const result = mockWindow[divId];
      if (typeof result === 'string' && result.includes('https://')) {
        console.log('[VidSrc] Dynamic decoder execution successful');
        return result;
      }
      
      for (const key of Object.keys(mockWindow)) {
        const value = mockWindow[key];
        if (typeof value === 'string' && value.includes('https://') && value.includes('.m3u8')) {
          console.log(`[VidSrc] Found URL in window.${key}`);
          return value;
        }
      }
    } catch (error) {
      console.error('[VidSrc] Dynamic decoder execution failed:', error);
    }
  }
  
  console.error('[VidSrc] All decode attempts failed');
  return null;
}

/**
 * Small delay to avoid rate limiting (100-300ms random)
 */
function randomDelay(): Promise<void> {
  const delay = 100 + Math.random() * 200;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Check if a stream URL is accessible
 */
async function checkStreamAvailability(url: string): Promise<'working' | 'down'> {
  try {
    const response = await fetchWithHeaders(url, 'https://cloudnestra.com/', 5000);
    const text = await response.text();
    return response.ok && (text.includes('#EXTM3U') || text.includes('#EXT-X')) ? 'working' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Main extraction function
 * 
 * ⚠️ DISABLED BY DEFAULT - Set ENABLE_VIDSRC_PROVIDER=true to enable
 */
export async function extractVidSrcStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  // ⚠️ SECURITY CHECK: VidSrc must be explicitly enabled
  if (!VIDSRC_ENABLED) {
    console.warn('[VidSrc] Provider is DISABLED for security. Set ENABLE_VIDSRC_PROVIDER=true to enable.');
    return {
      success: false,
      sources: [],
      error: 'VidSrc provider is disabled. Set ENABLE_VIDSRC_PROVIDER=true to enable (security risk).'
    };
  }

  console.log(`[VidSrc] Extracting streams for ${type} ID ${tmdbId}...`);

  try {
    // Step 1: Fetch vidsrc-embed.ru page
    const embedUrl = type === 'tv' && season && episode
      ? `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    
    console.log('[VidSrc] Fetching embed page:', embedUrl);
    const embedResponse = await fetchWithHeaders(embedUrl);
    
    if (!embedResponse.ok) {
      throw new Error(`Embed page returned ${embedResponse.status}`);
    }
    
    const embedHtml = await embedResponse.text();

    // Step 2: Extract RCP iframe URL
    const iframeMatch = embedHtml.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
    if (!iframeMatch) {
      throw new Error('Could not find RCP iframe in embed page');
    }
    
    const rcpPath = iframeMatch[2];
    console.log('[VidSrc] Found RCP hash');

    // Small delay to avoid rate limiting
    await randomDelay();

    // Step 3: Fetch RCP page to get prorcp URL
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpPath}`;
    console.log('[VidSrc] Fetching RCP page');
    const rcpResponse = await fetchWithHeaders(rcpUrl, 'https://vidsrc-embed.ru/');
    
    if (!rcpResponse.ok) {
      throw new Error(`RCP page returned ${rcpResponse.status}`);
    }
    
    let rcpHtml = await rcpResponse.text();

    // Step 4: Extract prorcp OR srcrcp URL (site uses both dynamically)
    // The URL can be in various formats depending on how the page loads
    let rcpEndpointPath: string | null = null;
    let rcpEndpointType: 'prorcp' | 'srcrcp' = 'prorcp';
    
    // FIRST: Check for Cloudflare Turnstile
    // NOTE: As of December 2024, the RCP hash structure is:
    //   base64(MD5:base64(base64(AES_ENCRYPTED_DATA)))
    // The MD5 and encrypted data change on EVERY request (server-side random).
    // The second part after the colon is NOT the prorcp path - it's encrypted data.
    if (rcpHtml.includes('cf-turnstile') || rcpHtml.includes('turnstile')) {
      console.log('[VidSrc] Cloudflare Turnstile detected');

      // Try to solve Turnstile if API key is configured
      const siteKeyMatch = rcpHtml.match(
        /data-sitekey=["']([^"']+)["']|sitekey:\s*["']([^"']+)["']/i
      );
      const siteKey = siteKeyMatch?.[1] || siteKeyMatch?.[2];

      if (siteKey && CAPSOLVER_API_KEY) {
        console.log('[VidSrc] Attempting Turnstile solve via CapSolver...');
        const token = await solveTurnstile(siteKey, rcpUrl);

        if (token) {
          // Find the verify endpoint
          const verifyMatch = rcpHtml.match(
            /\$\.post\s*\(\s*["']([^"']+)["']\s*,\s*\{\s*token/i
          );
          const verifyUrl = verifyMatch
            ? `https://cloudnestra.com${verifyMatch[1]}`
            : 'https://cloudnestra.com/verify';

          const verifyResult = await submitTurnstileToken(
            verifyUrl,
            token,
            rcpUrl
          );

          if (verifyResult) {
            // Re-fetch the RCP page after verification
            console.log('[VidSrc] Turnstile verified, re-fetching RCP page...');
            const newRcpResponse = await fetchWithHeaders(
              rcpUrl,
              'https://vidsrc-embed.ru/'
            );
            rcpHtml = await newRcpResponse.text();

            // Check if Turnstile is gone
            if (
              !rcpHtml.includes('cf-turnstile') &&
              !rcpHtml.includes('turnstile')
            ) {
              console.log('[VidSrc] Turnstile bypass successful!');
            } else {
              console.warn(
                '[VidSrc] Turnstile still present after verification'
              );
              throw new Error(
                'Turnstile verification failed - page still protected'
              );
            }
          } else {
            throw new Error('Turnstile token verification failed');
          }
        } else {
          throw new Error(
            'Failed to solve Turnstile - check CAPSOLVER_API_KEY'
          );
        }
      } else {
        console.warn(
          '[VidSrc] ⚠️ Turnstile detected but no CAPSOLVER_API_KEY configured'
        );
        console.warn(
          '[VidSrc] Set CAPSOLVER_API_KEY env var to enable automatic solving'
        );
        throw new Error(
          'VidSrc is protected by Cloudflare Turnstile. Set CAPSOLVER_API_KEY to enable bypass.'
        );
      }
    }
    
    // If no Turnstile (or bypass failed), try to extract from page content
    if (!rcpEndpointPath) {
      // Try multiple patterns - the site structure varies
      const patterns = [
        // Pattern 1: src: '/prorcp/...' or src: '/srcrcp/...'
        { regex: /src:\s*['"]\/prorcp\/([^'"]+)['"]/i, type: 'prorcp' as const },
        { regex: /src:\s*['"]\/srcrcp\/([^'"]+)['"]/i, type: 'srcrcp' as const },
        // Pattern 2: Direct URL in script
        { regex: /['"]\/prorcp\/([A-Za-z0-9+\/=\-_]+)['"]/i, type: 'prorcp' as const },
        { regex: /['"]\/srcrcp\/([A-Za-z0-9+\/=\-_]+)['"]/i, type: 'srcrcp' as const },
        // Pattern 3: loadIframe function call
        { regex: /loadIframe\s*\(\s*['"]\/prorcp\/([^'"]+)['"]/i, type: 'prorcp' as const },
        { regex: /loadIframe\s*\(\s*['"]\/srcrcp\/([^'"]+)['"]/i, type: 'srcrcp' as const },
        // Pattern 4: iframe src attribute
        { regex: /<iframe[^>]+src=["']\/prorcp\/([^"']+)["']/i, type: 'prorcp' as const },
        { regex: /<iframe[^>]+src=["']\/srcrcp\/([^"']+)["']/i, type: 'srcrcp' as const },
        // Pattern 5: data attribute
        { regex: /data-src=["']\/prorcp\/([^"']+)["']/i, type: 'prorcp' as const },
        { regex: /data-src=["']\/srcrcp\/([^"']+)["']/i, type: 'srcrcp' as const },
      ];
      
      for (const { regex, type } of patterns) {
        const match = rcpHtml.match(regex);
        if (match) {
          rcpEndpointPath = match[1];
          rcpEndpointType = type;
          console.log(`[VidSrc] Found ${type.toUpperCase()} hash via pattern: ${regex.source.substring(0, 30)}...`);
          break;
        }
      }
    }
    
    if (!rcpEndpointPath) {
      // Log for debugging
      console.error('[VidSrc] RCP HTML length:', rcpHtml.length);
      console.error('[VidSrc] RCP HTML preview:', rcpHtml.substring(0, 500));
      
      // Check if this is a JS-rendered page (no prorcp in static HTML)
      if (rcpHtml.length < 5000 && !rcpHtml.includes('prorcp') && !rcpHtml.includes('srcrcp')) {
        throw new Error('RCP page requires JavaScript execution - VidSrc may have changed their protection');
      }
      
      throw new Error('Could not find prorcp/srcrcp URL in RCP page');
    }

    // Small delay before next request
    await randomDelay();

    // Step 5: Fetch PRORCP/SRCRCP page
    const endpointUrl = `https://cloudnestra.com/${rcpEndpointType}/${rcpEndpointPath}`;
    console.log(`[VidSrc] Fetching ${rcpEndpointType.toUpperCase()} page`);
    const prorcpResponse = await fetchWithHeaders(endpointUrl, 'https://vidsrc-embed.ru/');
    
    if (!prorcpResponse.ok) {
      throw new Error(`PRORCP page returned ${prorcpResponse.status}`);
    }
    
    const prorcpHtml = await prorcpResponse.text();

    // Step 6: Extract div ID and encoded content
    const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) {
      throw new Error('Could not find encoded div in PRORCP page');
    }
    
    const divId = divMatch[1];
    const encodedContent = divMatch[2];
    console.log('[VidSrc] Div ID:', divId, 'Encoded length:', encodedContent.length);

    // Step 7: Try STATIC DECODING FIRST (avoids Cloudflare on script fetch!)
    console.log('[VidSrc] Attempting static decode (no remote script needed)...');
    let decodedContent = await executeDecoder(null, divId, encodedContent);
    
    // If static decode failed, try fetching the decoder script as fallback
    if (!decodedContent) {
      console.log('[VidSrc] Static decode failed, trying remote decoder script...');
      
      const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
      if (scriptMatch) {
        // Small delay before fetching script
        await randomDelay();
        
        const scriptHash = scriptMatch[1];
        const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js?_=${Date.now()}`;
        console.log('[VidSrc] Fetching decoder script');
        
        try {
          const scriptResponse = await fetchWithHeaders(scriptUrl, 'https://cloudnestra.com/');
          if (scriptResponse.ok) {
            const decoderScript = await scriptResponse.text();
            console.log('[VidSrc] Decoder script length:', decoderScript.length);
            
            // Try with the fetched script
            decodedContent = await executeDecoder(decoderScript, divId, encodedContent);
          }
        } catch (scriptError) {
          console.warn('[VidSrc] Failed to fetch decoder script:', scriptError);
        }
      }
    }
    
    if (!decodedContent) {
      throw new Error('Decoder execution failed - no content captured');
    }
    
    console.log('[VidSrc] Decoded successfully, preview:', decodedContent.substring(0, 100));

    // Step 9: Extract m3u8 URLs
    const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    
    // Replace domain variables and deduplicate
    const resolvedUrls = Array.from(new Set(urls.map(url => url.replace(/\{v\d+\}/g, STREAM_DOMAIN))));
    console.log(`[VidSrc] Found ${resolvedUrls.length} unique m3u8 URLs`);

    if (resolvedUrls.length === 0) {
      throw new Error('No stream URLs found in decoded content');
    }

    // Step 10: Build sources and check availability
    const sources: StreamSource[] = [];
    
    for (let i = 0; i < resolvedUrls.length; i++) {
      const url = resolvedUrls[i];
      
      // Skip URLs with domains that don't resolve (app2, etc.)
      if (url.includes('app2.') || url.includes('app3.')) {
        continue;
      }
      
      const status = await checkStreamAvailability(url);
      
      sources.push({
        quality: 'auto',
        title: `VidSrc ${i + 1}`,
        url,
        type: 'hls',
        referer: 'https://cloudnestra.com/',
        requiresSegmentProxy: true,
        status
      });
    }

    // Filter to working sources first, but include all
    const workingSources = sources.filter(s => s.status === 'working');
    console.log(`[VidSrc] ${workingSources.length}/${sources.length} sources working`);

    if (workingSources.length === 0 && sources.length > 0) {
      return {
        success: false,
        sources,
        error: 'All VidSrc sources currently unavailable'
      };
    }

    if (sources.length === 0) {
      throw new Error('No valid stream sources found');
    }

    return {
      success: true,
      sources
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[VidSrc] Extraction failed:', errorMessage);
    
    return {
      success: false,
      sources: [],
      error: errorMessage
    };
  }
}
