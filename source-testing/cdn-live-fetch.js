/**
 * cdn-live.tv Fresh Fetch and Analysis
 * 
 * Fetches a fresh player page and analyzes the obfuscated JavaScript
 */

const API_BASE = 'https://api.cdn-live.tv';
const SITE_BASE = 'https://cdn-live.tv';
const DEFAULT_USER = 'cdnlivetv';
const DEFAULT_PLAN = 'free';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://cdn-live.tv/',
};

// Fetch channels to get a valid channel name
async function fetchChannels() {
  const url = `${API_BASE}/api/v1/channels/?user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
  const response = await fetch(url, { headers });
  return response.json();
}

// Fetch player page
async function fetchPlayer(channelName, countryCode) {
  const url = `${SITE_BASE}/api/v1/channels/player/?name=${encodeURIComponent(channelName)}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`;
  console.log('Fetching player:', url);
  
  const response = await fetch(url, { headers });
  return response.text();
}

// Decode the obfuscated JavaScript
function decodeObfuscated(html) {
  // Extract the decoder function and encoded data
  const _0xc71e = ["", "split", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/", "slice", "indexOf", "", "", ".", "pow", "reduce", "reverse", "0"];
  
  function _0xe63c(d, e, f) {
    const g = _0xc71e[2].split(_0xc71e[0]);
    const h = g.slice(0, e);
    const i = g.slice(0, f);
    let j = d.split(_0xc71e[0]).reverse().reduce(function(a, b, c) {
      if (h.indexOf(b) !== -1) {
        return a + h.indexOf(b) * (Math.pow(e, c));
      }
      return a;
    }, 0);
    let k = _0xc71e[0];
    while (j > 0) {
      k = i[j % f] + k;
      j = (j - (j % f)) / f;
    }
    return k || _0xc71e[11];
  }
  
  function decode(h, u, n, t, e) {
    let r = "";
    for (let i = 0, len = h.length; i < len; i++) {
      let s = "";
      while (h[i] !== n[e]) {
        s += h[i];
        i++;
      }
      for (let j = 0; j < n.length; j++) {
        s = s.replace(new RegExp(n[j], "g"), j);
      }
      const charCode = _0xe63c(s, e, 10) - t;
      r += String.fromCharCode(charCode);
    }
    try {
      return decodeURIComponent(escape(r));
    } catch (e) {
      return r;
    }
  }
  
  // Find the encoded data
  const funcStart = html.indexOf('eval(function(h,u,n,t,e,r)');
  if (funcStart === -1) return null;
  
  const dataStart = html.indexOf('("', funcStart) + 2;
  const closingPattern = /",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)/;
  const remaining = html.substring(dataStart);
  const closingMatch = remaining.match(closingPattern);
  
  if (!closingMatch) return null;
  
  const encodedData = remaining.substring(0, closingMatch.index);
  const charset = closingMatch[2];
  const e = parseInt(closingMatch[4]);
  const offset = parseInt(closingMatch[5]);
  
  return decode(encodedData, 0, charset, offset, e);
}

// Try to find stream URL in various ways
async function findStreamUrl(channelName, countryCode) {
  console.log(`\n=== Analyzing ${channelName} (${countryCode}) ===\n`);
  
  const html = await fetchPlayer(channelName, countryCode);
  console.log('Player page length:', html.length);
  
  // Save raw HTML
  require('fs').writeFileSync(`cdn-live-player-${channelName}.html`, html);
  
  // Try to decode
  const decoded = decodeObfuscated(html);
  if (decoded) {
    console.log('\nDecoded length:', decoded.length);
    
    // Save decoded
    require('fs').writeFileSync(`cdn-live-decoded-${channelName}.js`, decoded);
    
    // Look for playlistUrl pattern
    const playlistMatch = decoded.match(/playlistUrl[=:]\s*["']([^"']+)["']/i);
    if (playlistMatch) {
      console.log('\nFound playlistUrl:', playlistMatch[1]);
      return playlistMatch[1];
    }
    
    // Look for m3u8 URLs
    const m3u8Match = decoded.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
    if (m3u8Match) {
      console.log('\nFound m3u8 URLs:', m3u8Match);
      return m3u8Match[0];
    }
    
    // Look for src patterns
    const srcMatch = decoded.match(/src[=:]\s*["']?(https?:\/\/[^"'\s]+)/gi);
    if (srcMatch) {
      console.log('\nFound src patterns:', srcMatch);
    }
    
    // Print first 2000 chars of decoded for analysis
    console.log('\n--- Decoded preview ---');
    console.log(decoded.substring(0, 2000));
  }
  
  // Also check for direct m3u8 in HTML
  const directM3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
  if (directM3u8) {
    console.log('\nDirect m3u8 in HTML:', directM3u8);
  }
  
  return null;
}

// Try alternative API endpoints
async function tryStreamAPI(channelName, countryCode) {
  console.log('\n=== Trying Stream API endpoints ===\n');
  
  const endpoints = [
    `${API_BASE}/api/v1/channels/stream/?name=${channelName}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`,
    `${API_BASE}/api/v1/stream/?name=${channelName}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`,
    `${API_BASE}/api/v1/channels/${channelName}/stream/?user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`,
    `${API_BASE}/api/v1/hls/?name=${channelName}&code=${countryCode}&user=${DEFAULT_USER}&plan=${DEFAULT_PLAN}`,
  ];
  
  for (const url of endpoints) {
    try {
      console.log('Trying:', url);
      const response = await fetch(url, { headers });
      console.log('Status:', response.status);
      
      if (response.ok) {
        const text = await response.text();
        console.log('Response:', text.substring(0, 500));
        
        // Check if it's an m3u8
        if (text.includes('#EXTM3U') || text.includes('.m3u8')) {
          console.log('Found stream!');
          return text;
        }
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  
  return null;
}

async function main() {
  // Get channels list first
  console.log('Fetching channels list...');
  const channels = await fetchChannels();
  
  if (channels && channels.length > 0) {
    console.log(`Found ${channels.length} channels`);
    console.log('Sample channels:', channels.slice(0, 5).map(c => `${c.name} (${c.country})`));
    
    // Try with first US channel
    const usChannel = channels.find(c => c.country === 'us') || channels[0];
    console.log('\nUsing channel:', usChannel.name, usChannel.country);
    
    // Try stream API first
    await tryStreamAPI(usChannel.name, usChannel.country);
    
    // Then analyze player page
    await findStreamUrl(usChannel.name, usChannel.country);
  }
}

main().catch(console.error);
