/**
 * Crack WASM - Run WASM Directly in Node.js
 * 
 * Instead of trying to reverse engineer the PRNG, let's try to run the WASM
 * directly in Node.js by providing mock browser APIs.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mock browser APIs
const mockWindow = {
  crypto: {
    getRandomValues: (arr) => {
      const randomBytes = crypto.randomBytes(arr.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = randomBytes[i];
      }
      return arr;
    },
    subtle: {
      importKey: async () => ({}),
      sign: async () => new ArrayBuffer(32),
    },
  },
  performance: {
    now: () => Date.now(),
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    language: 'en-US',
  },
  document: {
    getElementsByTagName: () => ({ length: 0 }),
    createElement: () => ({
      getContext: () => ({
        fillText: () => {},
        measureText: () => ({ width: 100 }),
      }),
      toDataURL: () => 'data:image/png;base64,',
      width: 300,
      height: 150,
    }),
  },
  screen: {
    width: 1920,
    height: 1080,
    colorDepth: 24,
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
  },
  Date: Date,
};

async function runWasmDirect() {
  console.log('=== Run WASM Directly in Node.js ===\n');
  
  // Read the WASM file
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('WASM file not found. Downloading...');
    
    // We need to download the WASM from flixer.sh
    const https = require('https');
    
    // First, get the page to find the WASM URL
    const pageHtml = await new Promise((resolve, reject) => {
      https.get('https://flixer.sh/watch/tv/106379/1/1', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });
    });
    
    // Find the WASM URL in the page
    const wasmUrlMatch = pageHtml.match(/flixer_img_data.*?\.wasm/);
    if (wasmUrlMatch) {
      console.log(`Found WASM URL: ${wasmUrlMatch[0]}`);
    } else {
      console.log('Could not find WASM URL in page');
      return;
    }
  }
  
  const wasmBuffer = fs.readFileSync(wasmPath);
  console.log(`WASM file size: ${wasmBuffer.length} bytes`);
  
  // Create import object with mock browser APIs
  const importObject = {
    wbg: {
      __wbg_now_807e54c39636c349: () => Date.now(),
      __wbindgen_string_new: (ptr, len) => {
        // This would need memory access
        return 0;
      },
      __wbg_now_d18023d54d4e5500: (obj) => Date.now(),
      __wbg_navigator_1577371c070c8947: (obj) => 0,
      __wbg_getElementsByTagName_f03d41ce466561e8: () => 0,
      __wbg_length_347907d14a9ed873: () => 0,
      __wbg_colorDepth_59677c81c61d599a: () => 24,
      __wbg_platform_faf02c487289f206: () => {},
      __wbg_language_d871ec78ee8eec62: () => {},
      __wbg_new0_f788a2397c7ca929: () => 0,
      __wbg_getTimezoneOffset_6b5752021c499c47: () => -360,
      __wbg_localStorage_1406c99c39728187: () => 0,
      __wbg_getItem_17f98dee3b43fa7e: () => {},
      __wbg_random_3ad904d98382defe: () => Math.random(),
      __wbg_setItem_212ecc915942ab0a: () => {},
      __wbg_createElement_8c9931a732ee2fea: () => 0,
      __wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5: () => 0,
      __wbg_setwidth_c5fed9f5e7f0b406: () => {},
      __wbg_setheight_da683a33fa99843c: () => {},
      __wbg_getContext_e9cf379449413580: () => 0,
      __wbg_instanceof_CanvasRenderingContext2d_df82a4d3437bf1cc: () => 0,
      __wbg_settextBaseline_c28d2a6aa4ff9d9d: () => {},
      __wbg_toDataURL_eaec332e848fe935: () => {},
      __wbg_reject_b3fcf99063186ff7: () => 0,
      __wbg_new_23a2665fac83c611: () => 0,
      __wbindgen_object_clone_ref: () => 0,
      __wbindgen_is_undefined: () => 1,
      __wbg_newnoargs_105ed471475aaf50: () => 0,
      __wbg_call_672a4d21634d4a24: () => 0,
      __wbg_static_accessor_GLOBAL_88a902d13a557d07: () => 0,
      __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: () => 0,
      __wbg_static_accessor_WINDOW_5de37043a91a9c40: () => 0,
      __wbg_static_accessor_SELF_37c5d418e4bf5819: () => 0,
      __wbg_call_7cccdd69e0791ae2: () => 0,
      __wbindgen_throw: (ptr, len) => {
        throw new Error('WASM threw an error');
      },
      __wbindgen_object_drop_ref: () => {},
      __wbindgen_cb_drop: () => 0,
      __wbg_then_44b73946d2fb3e7d: () => 0,
      __wbg_queueMicrotask_97d92b4fcc8a61c5: () => {},
      __wbg_queueMicrotask_d3219def82552485: () => 0,
      __wbindgen_is_function: () => 0,
      __wbg_resolve_4851785c9c5f573d: () => 0,
      __wbg_instanceof_Window_def73ea0955fc569: () => 1,
      __wbg_setfont_42a163ef83420b93: () => {},
      __wbg_fillText_2a0055d8531355d1: () => {},
      __wbg_userAgent_12e9d8e62297563f: () => {},
      __wbg_width_679079836447b4b7: () => 1920,
      __wbg_height_614ba187d8cae9ca: () => 1080,
      __wbg_document_d249400bd7bd996d: () => 0,
      __wbg_screen_8edf8699f70d98bc: () => 0,
      __wbg_performance_c185c0cdc2766575: () => 0,
      __wbindgen_closure_wrapper982: () => 0,
    },
  };
  
  try {
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    console.log('WASM compiled successfully');
    
    const wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
    console.log('WASM instantiated successfully');
    console.log('Exports:', Object.keys(wasmInstance.exports));
    
    // Try to call the process_img_data function
    // But we need to set up memory properly first
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
    console.log(e.stack);
  }
}

runWasmDirect().catch(console.error);
