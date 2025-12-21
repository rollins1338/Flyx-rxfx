/**
 * Flixer WASM Loader using JSDOM
 * Uses JSDOM to provide a complete browser environment for the WASM module.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const WASM_PATH = path.join(__dirname, 'wasm-analysis/client-assets/img_data_bg.wasm');
const JS_WRAPPER_PATH = path.join(__dirname, 'wasm-analysis/client-assets/img_data.js');

async function loadFlixerWasm(options = {}) {
  const sessionId = options.sessionId || crypto.randomBytes(16).toString('hex');
  
  // Create a JSDOM instance with canvas support
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://flixer.sh/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  
  const { window } = dom;
  const { document } = window;
  
  // Set up localStorage with session ID
  window.localStorage.setItem('tmdb_session_id', sessionId);
  
  // Mock screen properties
  Object.defineProperty(window, 'screen', {
    value: {
      width: options.screenWidth || 1920,
      height: options.screenHeight || 1080,
      availWidth: options.screenWidth || 1920,
      availHeight: options.screenHeight || 1080,
      colorDepth: options.colorDepth || 24,
      pixelDepth: options.colorDepth || 24,
    },
    writable: false,
  });
  
  // Mock navigator properties
  Object.defineProperty(window.navigator, 'platform', { value: options.platform || 'Win32' });
  Object.defineProperty(window.navigator, 'language', { value: options.language || 'en-US' });
  
  // Read the WASM binary
  const wasmBuffer = fs.readFileSync(WASM_PATH);
  
  // Read and modify the JS wrapper to work in Node.js
  let jsWrapper = fs.readFileSync(JS_WRAPPER_PATH, 'utf8');
  
  // Convert ES module to CommonJS-compatible
  jsWrapper = jsWrapper.replace(/export\s+function/g, 'module.exports.');
  jsWrapper = jsWrapper.replace(/export\s+\{[^}]+\}/g, '');
  jsWrapper = jsWrapper.replace(/export\s+default\s+/g, 'module.exports.init = ');
  
  // Create a module context
  const moduleCode = `
    const window = this.window;
    const document = this.document;
    const localStorage = this.localStorage;
    const navigator = this.navigator;
    const screen = this.screen;
    const performance = this.performance;
    const Date = this.Date;
    const Math = this.Math;
    const Promise = this.Promise;
    const Function = this.Function;
    const TextEncoder = this.TextEncoder;
    const TextDecoder = this.TextDecoder;
    const WebAssembly = this.WebAssembly;
    const queueMicrotask = this.queueMicrotask;
    const globalThis = this.globalThis;
    const self = this.window;
    
    ${jsWrapper}
  `;
  
  // Execute in the JSDOM context
  const script = new window.Function('module', moduleCode);
  const moduleExports = {};
  
  try {
    script.call({
      window,
      document,
      localStorage: window.localStorage,
      navigator: window.navigator,
      screen: window.screen,
      performance: window.performance,
      Date: window.Date,
      Math: window.Math,
      Promise: window.Promise,
      Function: window.Function,
      TextEncoder: window.TextEncoder,
      TextDecoder: window.TextDecoder,
      WebAssembly: global.WebAssembly,
      queueMicrotask: global.queueMicrotask,
      globalThis: window,
    }, { exports: moduleExports });
  } catch (e) {
    console.error('Error executing JS wrapper:', e);
    throw e;
  }
  
  console.log('Module exports:', Object.keys(moduleExports));
  
  // Initialize the WASM module
  if (moduleExports.init) {
    await moduleExports.init(wasmBuffer);
  }
  
  return {
    getImgKey: moduleExports.get_img_key,
    processImgData: moduleExports.process_img_data,
    sessionId,
    close: () => dom.window.close(),
  };
}

// Test
async function test() {
  console.log('=== Testing Flixer WASM with JSDOM ===');
  
  try {
    const wasm = await loadFlixerWasm();
    console.log('WASM loaded, session:', wasm.sessionId.slice(0, 8) + '...');
    
    const key = wasm.getImgKey();
    console.log('Generated Key:', key);
    console.log('Key Length:', key.length, 'chars');
    
    wasm.close();
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

module.exports = { loadFlixerWasm };

if (require.main === module) {
  test();
}
