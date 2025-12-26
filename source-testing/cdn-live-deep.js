/**
 * cdn-live.tv Deep Analysis
 */

const fs = require('fs');

async function analyzeChannels() {
  console.log('=== Analyzing Channels API ===\n');
  
  const url = 'https://api.cdn-live.tv/api/v1/channels/?user=cdnlivetv&plan=free';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  });
  
  const data = await response.json();
  console.log('Response type:', typeof data);
  console.log('Is array:', Array.isArray(data));
  console.log('Keys:', Object.keys(data));
  
  // Check structure
  if (data.channels) {
    console.log('Channels count:', data.channels.length);
    console.log('Sample:', JSON.stringify(data.channels.slice(0, 2), null, 2));
    return data.channels;
  } else if (Array.isArray(data)) {
    console.log('Direct array, count:', data.length);
    return data;
  } else {
    console.log('Full response:', JSON.stringify(data, null, 2).substring(0, 2000));
    return Object.values(data).flat();
  }
}

async function analyzePlayer(channelName, countryCode) {
  console.log(`\n=== Analyzing Player: ${channelName} (${countryCode}) ===\n`);
  
  const url = `https://cdn-live.tv/api/v1/channels/player/?name=${channelName}&code=${countryCode}&user=cdnlivetv&plan=free`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
  });
  
  const html = await response.text();
  fs.writeFileSync(`cdn-player-${channelName}.html`, html);
  console.log('Saved HTML, length:', html.length);
  
  // Extract the obfuscated script
  const scriptMatch = html.match(/<script>var _0xc71e[\s\S]*?<\/script>/);
  if (scriptMatch) {
    console.log('Found obfuscated script, length:', scriptMatch[0].length);
    
    // Extract parameters from the eval call
    const evalParams = html.match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)<\/script>/);
    if (evalParams) {
      console.log('Eval parameters:');
      console.log('  u:', evalParams[1]);
      console.log('  charset:', evalParams[2]);
      console.log('  base:', evalParams[3]);
      console.log('  e:', evalParams[4]);
      console.log('  offset:', evalParams[5]);
    }
  }
  
  // Try to decode using the actual algorithm
  const decoded = decodePlayerScript(html);
  if (decoded) {
    fs.writeFileSync(`cdn-decoded-${channelName}.js`, decoded);
    console.log('\nDecoded script saved, length:', decoded.length);
    
    // Analyze decoded content
    analyzeDecodedScript(decoded);
  }
  
  return html;
}

function decodePlayerScript(html) {
  // The obfuscation uses a custom base conversion
  const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";
  
  function baseConvert(d, e, f) {
    const g = charset.split('');
    const h = g.slice(0, e);
    const i = g.slice(0, f);
    let j = d.split('').reverse().reduce((a, b, c) => {
      const idx = h.indexOf(b);
      if (idx !== -1) return a + idx * Math.pow(e, c);
      return a;
    }, 0);
    let k = '';
    while (j > 0) {
      k = i[j % f] + k;
      j = Math.floor(j / f);
    }
    return k || '0';
  }
  
  // Extract encoded data and parameters
  const funcStart = html.indexOf('eval(function(h,u,n,t,e,r)');
  if (funcStart === -1) return null;
  
  const dataStart = html.indexOf('("', funcStart) + 2;
  const paramsMatch = html.substring(dataStart).match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)/);
  if (!paramsMatch) return null;
  
  const encodedData = html.substring(dataStart, dataStart + paramsMatch.index);
  const n = paramsMatch[2]; // charset for encoding
  const e = parseInt(paramsMatch[4]); // base
  const t = parseInt(paramsMatch[5]); // offset
  
  console.log('Decoding with charset:', n, 'base:', e, 'offset:', t);
  
  let result = '';
  let i = 0;
  while (i < encodedData.length) {
    let s = '';
    while (encodedData[i] !== n[e]) {
      s += encodedData[i];
      i++;
    }
    i++; // skip delimiter
    
    // Replace charset characters with numbers
    for (let j = 0; j < n.length; j++) {
      s = s.split(n[j]).join(j.toString());
    }
    
    const charCode = parseInt(baseConvert(s, e, 10)) - t;
    result += String.fromCharCode(charCode);
  }
  
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}

function analyzeDecodedScript(decoded) {
  console.log('\n--- Decoded Script Analysis ---');
  
  // Look for key patterns
  const patterns = [
    { name: 'playlistUrl', regex: /playlistUrl\s*[=:]\s*["'`]([^"'`]+)["'`]/gi },
    { name: 'source/src', regex: /(?:source|src)\s*[=:]\s*["'`]([^"'`]+)["'`]/gi },
    { name: 'm3u8 URLs', regex: /https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*/gi },
    { name: 'API calls', regex: /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi },
    { name: 'edge/cdn URLs', regex: /https?:\/\/[^\s"'`]*(?:edge|cdn|stream|live)[^\s"'`]*/gi },
    { name: 'token/key', regex: /(?:token|key|auth)\s*[=:]\s*["'`]([^"'`]+)["'`]/gi },
  ];
  
  for (const p of patterns) {
    const matches = [...decoded.matchAll(p.regex)];
    if (matches.length > 0) {
      console.log(`\n${p.name}:`);
      matches.slice(0, 5).forEach(m => console.log('  ', m[1] || m[0]));
    }
  }
  
  // Look for the OPlayer initialization
  const oplayerMatch = decoded.match(/OPlayer\.make\s*\([^)]+\)/);
  if (oplayerMatch) {
    console.log('\nOPlayer.make call found');
  }
  
  // Look for HLS configuration
  const hlsMatch = decoded.match(/hls\s*[=:]\s*\{[^}]+\}/);
  if (hlsMatch) {
    console.log('\nHLS config:', hlsMatch[0].substring(0, 200));
  }
  
  // Print a section around "playlistUrl" or "source"
  const playlistIdx = decoded.indexOf('playlistUrl');
  if (playlistIdx !== -1) {
    console.log('\nContext around playlistUrl:');
    console.log(decoded.substring(Math.max(0, playlistIdx - 100), playlistIdx + 200));
  }
  
  const sourceIdx = decoded.indexOf('source:');
  if (sourceIdx !== -1) {
    console.log('\nContext around source:');
    console.log(decoded.substring(Math.max(0, sourceIdx - 50), sourceIdx + 150));
  }
}

async function main() {
  try {
    const channels = await analyzeChannels();
    
    // Find a US channel
    let testChannel = { name: 'espn', country: 'us' };
    if (channels && channels.length > 0) {
      const usChannel = channels.find(c => c.country === 'us' || c.code === 'us');
      if (usChannel) {
        testChannel = { name: usChannel.name, country: usChannel.country || usChannel.code };
      }
    }
    
    await analyzePlayer(testChannel.name, testChannel.country);
    
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
