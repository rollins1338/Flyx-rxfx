/**
 * Step 18: Dynamic hooking approach
 * 
 * Create a modified version of the code that logs decrypted values
 */

const fs = require('fs');

console.log('=== Step 18: Dynamic Hooking Setup ===\n');

// Read the original code
const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Create a hook script that can be injected
const hookScript = `
// Hook script to capture decrypted values
(function() {
  const originalSetup = window.jwplayer ? window.jwplayer.prototype.setup : null;
  
  // Hook jwplayer setup
  if (window.jwplayer) {
    const origJW = window.jwplayer;
    window.jwplayer = function(id) {
      const player = origJW(id);
      const origSetup = player.setup;
      player.setup = function(config) {
        console.log('[HOOK] JWPlayer setup called with:', JSON.stringify(config, null, 2));
        return origSetup.call(this, config);
      };
      return player;
    };
  }
  
  // Hook fetch
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    console.log('[HOOK] fetch called:', args[0]);
    return origFetch.apply(this, args).then(response => {
      console.log('[HOOK] fetch response:', response.url, response.status);
      return response;
    });
  };
  
  // Hook XMLHttpRequest
  const origXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new origXHR();
    const origOpen = xhr.open;
    xhr.open = function(method, url, ...args) {
      console.log('[HOOK] XHR open:', method, url);
      return origOpen.call(this, method, url, ...args);
    };
    return xhr;
  };
  
  // Log when PAGE_DATA is accessed
  let pageData = window.__PAGE_DATA;
  Object.defineProperty(window, '__PAGE_DATA', {
    get: function() {
      console.log('[HOOK] __PAGE_DATA accessed:', pageData);
      return pageData;
    },
    set: function(val) {
      console.log('[HOOK] __PAGE_DATA set:', val);
      pageData = val;
    }
  });
  
  console.log('[HOOK] Hooks installed');
})();
`;

// Save the hook script
fs.writeFileSync('rapidshare-hook.js', hookScript);
console.log('Created rapidshare-hook.js');

// Now let's try to understand the decryption by looking at the code structure
console.log('\n=== Analyzing Code Structure ===');

// Find all function definitions
const funcDefs = original.match(/function\s+\w+\s*\([^)]*\)/g);
console.log('Named functions:', funcDefs ? funcDefs.length : 0);
if (funcDefs) {
  console.log('Sample:', funcDefs.slice(0, 10).join('\n'));
}

// Find all arrow functions
const arrowFuncs = original.match(/\([^)]*\)\s*=>/g);
console.log('\nArrow functions:', arrowFuncs ? arrowFuncs.length : 0);

// Find all IIFE patterns
const iifes = original.match(/\(\s*function\s*\([^)]*\)\s*\{/g);
console.log('IIFEs:', iifes ? iifes.length : 0);

// Look for the main entry point
console.log('\n=== Looking for Entry Point ===');

// The code likely starts with an IIFE or DOMContentLoaded
const domReady = original.match(/DOMContentLoaded|onload|ready/gi);
console.log('DOM ready patterns:', domReady ? domReady.length : 0);

// Look for the actual video initialization
// It might be triggered by a specific condition
const initPatterns = original.match(/init|start|play|load/gi);
console.log('Init patterns:', initPatterns ? initPatterns.length : 0);

// Create a test HTML file that loads the scripts with hooks
const testHtml = `<!DOCTYPE html>
<html>
<head>
    <title>RapidShare Hook Test</title>
</head>
<body>
    <div id="player-container">
        <div id="player"></div>
    </div>
    
    <script>
        // Set up PAGE_DATA
        window.__PAGE_DATA = "3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4";
    </script>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js"></script>
    
    <!-- Hook script must be loaded before the app -->
    <script src="rapidshare-hook.js"></script>
    
    <!-- JWPlayer -->
    <script src="rapidshare-jwplayer.js"></script>
    
    <!-- Main app -->
    <script src="rapidshare-app.js"></script>
    
    <script>
        console.log('Page loaded, checking for player...');
        setTimeout(() => {
            if (window.jwplayer) {
                console.log('JWPlayer available');
            }
        }, 1000);
    </script>
</body>
</html>`;

fs.writeFileSync('rapidshare-test.html', testHtml);
console.log('\nCreated rapidshare-test.html');
console.log('Open this file in a browser with DevTools to see hooked values');

// Also create a Node.js test that tries to run parts of the code
console.log('\n=== Creating Node.js Test ===');

const nodeTest = `
// Node.js test to run parts of the obfuscated code
const vm = require('vm');
const fs = require('fs');

// Create a mock browser environment
const mockWindow = {
  __PAGE_DATA: "3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4",
  document: {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {} }),
    body: { appendChild: () => {} }
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
  },
  location: { href: 'https://rapidshare.cc/e/test' },
  setTimeout: setTimeout,
  setInterval: setInterval,
  console: console,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  Math: Math,
  JSON: JSON,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  btoa: (str) => Buffer.from(str, 'binary').toString('base64')
};

// Add self-references
mockWindow.window = mockWindow;
mockWindow.self = mockWindow;
mockWindow.top = mockWindow;
mockWindow.globalThis = mockWindow;

// Read the app code
const appCode = fs.readFileSync('rapidshare-app.js', 'utf8');

// Create a context
const context = vm.createContext(mockWindow);

// Try to run the code
try {
  console.log('Running obfuscated code...');
  vm.runInContext(appCode, context, { timeout: 5000 });
  console.log('Code executed successfully');
  
  // Check what was created
  console.log('\\nGlobal objects created:');
  Object.keys(context).filter(k => !Object.keys(mockWindow).includes(k)).forEach(k => {
    console.log('  ' + k + ':', typeof context[k]);
  });
} catch (e) {
  console.log('Error:', e.message);
  console.log('Stack:', e.stack);
}
`;

fs.writeFileSync('rapidshare-node-test.js', nodeTest);
console.log('Created rapidshare-node-test.js');
