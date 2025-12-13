/**
 * Run MegaUp decryption in a sandboxed VM
 * We'll mock the browser environment and capture the decrypted output
 */

const vm = require('vm');
const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function main() {
  console.log('Setting up sandboxed environment...\n');
  
  // Fetch the embed page
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  // Extract __PAGE_DATA
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  const pageData = pageDataMatch[1];
  
  // Extract ua
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  const ua = uaMatch[1];
  
  console.log('PAGE_DATA:', pageData);
  console.log('UA:', ua.substring(0, 60) + '...');
  
  // Fetch app.js
  const appJsMatch = html.match(/src="([^"]+app\.js[^"]*)"/);
  const jsResponse = await fetch(appJsMatch[1], { headers: HEADERS });
  const appJs = await jsResponse.text();
  
  // Create a mock browser environment
  const capturedSetup = [];
  
  const sandbox = {
    window: {
      __PAGE_DATA: pageData,
      location: { href: 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ' },
      addEventListener: () => {},
      removeEventListener: () => {},
      document: {
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: () => ({ style: {} }),
        documentElement: { innerHTML: '' },
        addEventListener: () => {},
        readyState: 'complete',
      },
      navigator: {
        userAgent: ua,
        platform: 'Win32',
      },
      screen: { width: 1920, height: 1080 },
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 1,
      performance: { now: () => Date.now() },
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      console: console,
      atob: (s) => Buffer.from(s, 'base64').toString('binary'),
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      JSON: JSON,
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Math: Math,
      Date: Date,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      Symbol: Symbol,
      Promise: Promise,
      Uint8Array: Uint8Array,
      ArrayBuffer: ArrayBuffer,
      Function: Function,
    },
    document: null, // Will be set to window.document
    navigator: null, // Will be set to window.navigator
    ua: ua,
    jwplayer: function(id) {
      return {
        setup: function(config) {
          console.log('\n✓✓✓ CAPTURED JWPLAYER SETUP! ✓✓✓');
          console.log('Config:', JSON.stringify(config, null, 2));
          capturedSetup.push(config);
          return this;
        },
        on: () => ({ on: () => ({}) }),
        getState: () => 'idle',
        play: () => {},
        pause: () => {},
        seek: () => {},
        getPosition: () => 0,
        getDuration: () => 0,
        getVolume: () => 100,
        setVolume: () => {},
        getMute: () => false,
        setMute: () => {},
        getFullscreen: () => false,
        setFullscreen: () => {},
        getQualityLevels: () => [],
        getCurrentQuality: () => 0,
        setCurrentQuality: () => {},
        getAudioTracks: () => [],
        getCurrentAudioTrack: () => 0,
        setCurrentAudioTrack: () => {},
        getCaptionsList: () => [],
        getCurrentCaptions: () => 0,
        setCurrentCaptions: () => {},
        getBuffer: () => 0,
        getContainer: () => ({ querySelector: () => null }),
        remove: () => {},
      };
    },
    jQuery: function() {
      return {
        ready: (fn) => fn(),
        on: () => {},
        off: () => {},
        find: () => ({ length: 0 }),
        addClass: () => {},
        removeClass: () => {},
        css: () => {},
        attr: () => {},
        html: () => {},
        text: () => {},
        val: () => {},
        append: () => {},
        prepend: () => {},
        remove: () => {},
        show: () => {},
        hide: () => {},
        fadeIn: () => {},
        fadeOut: () => {},
        animate: () => {},
        each: () => {},
        ajax: () => Promise.resolve({}),
        get: () => Promise.resolve({}),
        post: () => Promise.resolve({}),
      };
    },
    $: null, // Will be set to jQuery
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
  };
  
  sandbox.document = sandbox.window.document;
  sandbox.navigator = sandbox.window.navigator;
  sandbox.$ = sandbox.jQuery;
  sandbox.self = sandbox.window;
  sandbox.top = sandbox.window;
  sandbox.parent = sandbox.window;
  
  console.log('\nExecuting app.js in sandbox...');
  
  try {
    // Create the context
    const context = vm.createContext(sandbox);
    
    // Run the script
    const script = new vm.Script(appJs, { filename: 'app.js' });
    script.runInContext(context, { timeout: 10000 });
    
    console.log('\nScript executed successfully');
    
    if (capturedSetup.length > 0) {
      console.log('\nCaptured configs:', capturedSetup.length);
      for (const config of capturedSetup) {
        if (config.sources) {
          console.log('Sources:', config.sources);
        }
        if (config.file) {
          console.log('File:', config.file);
        }
      }
    } else {
      console.log('\nNo jwplayer setup captured - the script may need DOM events to trigger');
    }
  } catch (error) {
    console.log('\nScript error:', error.message);
    
    // The error might give us clues about what's missing
    if (error.message.includes('is not defined')) {
      console.log('Missing global:', error.message);
    }
  }
}

main().catch(console.error);
