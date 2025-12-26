/**
 * cdn-live.tv Research Script - FINAL VERSION
 * 
 * FULLY REVERSE ENGINEERED:
 * 
 * API Structure:
 * - Main site: cdn-live.tv
 * - API domain: api.cdn-live.tv
 * - Edge/Stream server: edge.cdn-live-tv.ru
 * 
 * Authentication:
 * - Query params: user=cdnlivetv&plan=free
 * - No API key required
 * 
 * Endpoints:
 * - Channels: https://api.cdn-live.tv/api/v1/channels/?user=cdnlivetv&plan=free
 * - Player: https://cdn-live.tv/api/v1/channels/player/?name={channel}&code={country}&user=cdnlivetv&plan=free
 * 
 * Stream URL Pattern:
 * https://edge.cdn-live-tv.ru/api/v1/channels/{country}-{channel}/index.m3u8?token={token}
 * 
 * Token is embedded in obfuscated JavaScript in the player page.
 * Tokens are time-limited (contain timestamp).
 */

const fs = require('fs');
const vm = require('vm');

const API_BASE = 'https://api.cdn-live.tv';
const SITE_BASE = 'https://cdn-live.tv';
const DEFAULT_USER = 'cdnlivetv';
const DEFAULT_PLAN = 'free';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Origin': 'https://cdn-live.tv',
  'Referer': 'https://cdn-live.tv/',
};

/**
 * Fetch all channels from cdn-live.tv
 */
async function fetchChannels() {
  console.log('=== Fetching Channels ===\n');
  
  const url = `${API_BASE}/api/v1/channels/?user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
  console.log('URL:', url);
  
  const response = await fetch(url, { headers });
  const data = await response.json();
  
  console.log('Total channels:', data.total_channels);
  console.log('Sample channels:', data.channels.slice(0, 3));
  
  // Group by country
  const byCountry = {};
  for (const ch of data.channels) {
    const country = ch.code || 'other';
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(ch);
  }
  
  console.log('\nChannels by country:');
  for (const [country, channels] of Object.entries(byCountry)) {
    console.log(`  ${country}: ${channels.length} channels`);
  }
  
  return data.channels;
}

/**
 * Extract stream URL from player page using VM execution
 */
async function extractStreamUrl(channelName, countryCode) {
  console.log(`\n=== Extracting Stream: ${channelName} (${countryCode}) ===\n`);
  
  const playerUrl = `${SITE_BASE}/api/v1/channels/player/?name=${encodeURIComponent(channelName)}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
  console.log('Player URL:', playerUrl);
  
  const response = await fetch(playerUrl, { headers });
  const html = await response.text();
  
  console.log('HTML length:', html.length);
  
  // Find the obfuscated script
  const scriptStart = html.indexOf('<script>var _0xc');
  if (scriptStart === -1) {
    console.log('No obfuscated script found');
    return null;
  }
  
  const scriptEnd = html.indexOf('</script>', scriptStart);
  const script = html.substring(scriptStart + 8, scriptEnd);
  
  console.log('Script length:', script.length);
  
  // Replace eval with result capture
  const modifiedScript = script.replace(
    /eval\(function\(h,u,n,t,e,r\)/,
    'result = (function(h,u,n,t,e,r)'
  );
  
  // Create sandbox
  const sandbox = {
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
    
    const decoded = sandbox.result;
    
    if (!decoded) {
      console.log('Failed to decode script');
      return null;
    }
    
    console.log('Decoded length:', decoded.length);
    
    // Extract playlistUrl
    const playlistMatch = decoded.match(/playlistUrl\s*=\s*['"]([^'"]+)['"]/);
    if (playlistMatch) {
      const streamUrl = playlistMatch[1];
      console.log('\n✓ Stream URL found:', streamUrl);
      return streamUrl;
    }
    
    // Fallback patterns
    const m3u8Match = decoded.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/);
    if (m3u8Match) {
      console.log('\n✓ M3U8 URL found:', m3u8Match[0]);
      return m3u8Match[0];
    }
    
    console.log('Could not find stream URL in decoded script');
    return null;
    
  } catch (error) {
    console.error('VM execution error:', error.message);
    return null;
  }
}

/**
 * Test stream URL validity
 */
async function testStreamUrl(streamUrl) {
  console.log('\n=== Testing Stream URL ===\n');
  
  try {
    const response = await fetch(streamUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    if (response.ok) {
      console.log('✓ Stream URL is valid!');
      return true;
    } else {
      console.log('✗ Stream URL returned error');
      return false;
    }
  } catch (error) {
    console.error('Error testing stream:', error.message);
    return false;
  }
}

async function main() {
  // Fetch channels
  const channels = await fetchChannels();
  
  // Test with a US channel
  const testChannel = channels.find(c => c.code === 'us') || channels[0];
  console.log('\nTest channel:', testChannel.name, testChannel.code);
  
  // Extract stream URL
  const streamUrl = await extractStreamUrl(testChannel.name, testChannel.code);
  
  if (streamUrl) {
    // Test the stream
    await testStreamUrl(streamUrl);
    
    // Parse token info
    const tokenMatch = streamUrl.match(/token=([^&]+)/);
    if (tokenMatch) {
      const tokenParts = tokenMatch[1].split('.');
      console.log('\nToken parts:', tokenParts.length);
      if (tokenParts.length >= 2) {
        const timestamp = parseInt(tokenParts[1]);
        const expiry = new Date(timestamp * 1000);
        console.log('Token expires:', expiry.toISOString());
      }
    }
  }
}

main().catch(console.error);
