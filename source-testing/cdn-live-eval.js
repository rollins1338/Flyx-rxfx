/**
 * cdn-live.tv - Execute the decoder directly
 * This extracts and runs the actual decoder from the page
 */

const fs = require('fs');
const vm = require('vm');

function extractAndDecode(filename) {
  const html = fs.readFileSync(filename, 'utf-8');
  
  // Find the obfuscated script
  const scriptStart = html.indexOf('<script>var _0xc');
  if (scriptStart === -1) {
    console.log('No obfuscated script found');
    return null;
  }
  
  const scriptEnd = html.indexOf('</script>', scriptStart);
  const script = html.substring(scriptStart + 8, scriptEnd); // +8 to skip "<script>"
  
  console.log('Script length:', script.length);
  
  // Create a sandbox to capture the result
  const sandbox = {
    result: null,
    console: console,
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {} }),
      body: { appendChild: () => {} },
      head: { appendChild: () => {} },
    },
    OPlayer: { make: () => ({ use: () => ({ create: () => {} }) }) },
    OUI: {},
    OHls: {},
    OPlugins: { Chromecast: () => {} },
    fetch: () => Promise.resolve({ ok: true, status: 200 }),
    setTimeout: () => {},
    setInterval: () => {},
    location: { href: '', reload: () => {} },
    AbortController: class { signal = {}; abort() {} },
    MutationObserver: class { observe() {} },
  };
  
  // Replace eval with a function that captures the result
  const modifiedScript = script.replace(
    /eval\(function\(h,u,n,t,e,r\)/,
    'result = (function(h,u,n,t,e,r)'
  );
  
  try {
    vm.createContext(sandbox);
    vm.runInContext(modifiedScript, sandbox, { timeout: 5000 });
    
    if (sandbox.result) {
      console.log('\n=== Decoded result ===\n');
      console.log('Length:', sandbox.result.length);
      console.log('\nFirst 5000 chars:\n');
      console.log(sandbox.result.substring(0, 5000));
      
      fs.writeFileSync('cdn-decoded-eval.js', sandbox.result);
      console.log('\nSaved to cdn-decoded-eval.js');
      
      // Look for patterns
      console.log('\n=== Pattern Analysis ===\n');
      
      const playlistMatch = sandbox.result.match(/playlistUrl\s*[=:]\s*["'`]([^"'`]+)["'`]/i);
      if (playlistMatch) console.log('playlistUrl:', playlistMatch[1]);
      
      const srcMatch = sandbox.result.match(/src\s*:\s*["'`]([^"'`]+)["'`]/g);
      if (srcMatch) console.log('src patterns:', srcMatch);
      
      const m3u8Match = sandbox.result.match(/https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*/gi);
      if (m3u8Match) console.log('m3u8 URLs:', m3u8Match);
      
      const edgeMatch = sandbox.result.match(/https?:\/\/edge[^\s"'`]+/gi);
      if (edgeMatch) console.log('edge URLs:', edgeMatch);
      
      // Look for the actual stream URL construction
      const streamConstruction = sandbox.result.match(/https?:\/\/[^\s"'`]*(?:edge|stream|live|hls)[^\s"'`]*/gi);
      if (streamConstruction) console.log('Stream URLs:', [...new Set(streamConstruction)]);
      
      return sandbox.result;
    }
  } catch (e) {
    console.error('Error executing script:', e.message);
  }
  
  return null;
}

extractAndDecode('cdn-player-ABC.html');
