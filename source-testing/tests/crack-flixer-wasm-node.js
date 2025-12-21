/**
 * Crack Flixer.sh - Run WASM in Node.js
 * 
 * Load the WASM module directly in Node.js and use it to decrypt
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

// Generate request headers
function generateNonce() {
  return crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').substring(0, 22);
}

function generateFingerprint() {
  return 'jnurg'; // Use a consistent fingerprint
}

function generateSignature(key, timestamp, nonce, urlPath) {
  const message = `${key}:${timestamp}:${nonce}:${urlPath}`;
  return crypto.createHmac('sha256', key).update(message).digest('base64');
}

function makeRequest(urlPath, key, extraHeaders = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const fingerprint = generateFingerprint();
  const signature = generateSignature(key, timestamp, nonce, urlPath);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'Origin': 'https://flixer.sh',
    'Referer': 'https://flixer.sh/',
    'X-Api-Key': key,
    'X-Request-Timestamp': timestamp.toString(),
    'X-Request-Nonce': nonce,
    'X-Request-Signature': signature,
    'X-Client-Fingerprint': fingerprint,
    'bW90aGFmYWth': '1',
    ...extraHeaders,
  };
  
  return new Promise((resolve, reject) => {
    https.get(`${API_BASE}${urlPath}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function loadWasm() {
  console.log('=== Loading Flixer WASM in Node.js ===\n');
  
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // Create the imports object that the WASM expects
  const heap = new Array(128).fill(undefined);
  heap.push(undefined, null, true, false);
  let heap_next = heap.length;
  
  function getObject(idx) { return heap[idx]; }
  
  function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
  }
  
  function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
  }
  
  function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
  }
  
  let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
  let cachedTextEncoder = new TextEncoder();
  let cachedUint8Memory = null;
  let cachedDataView = null;
  let WASM_VECTOR_LEN = 0;
  let wasm;
  
  function getUint8Memory() {
    if (cachedUint8Memory === null || cachedUint8Memory.byteLength === 0) {
      cachedUint8Memory = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory;
  }
  
  function getDataView() {
    if (cachedDataView === null || cachedDataView.buffer.detached === true) {
      cachedDataView = new DataView(wasm.memory.buffer);
    }
    return cachedDataView;
  }
  
  function getStringFromWasm(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
  }
  
  function passStringToWasm(arg, malloc, realloc) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8Memory().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }
  
  // Mock browser APIs that the WASM expects
  const mockNavigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    language: 'en-US',
  };
  
  const mockScreen = {
    width: 1920,
    height: 1080,
    colorDepth: 24,
  };
  
  const mockDocument = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            fillText: () => {},
            fillRect: () => {},
          }),
          toDataURL: () => 'data:image/png;base64,AAAA',
        };
      }
      return {};
    },
    body: {},
    getElementsByTagName: () => [],
  };
  
  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  
  const imports = {
    wbg: {
      __wbg_navigator_1577371c070c8947: () => addHeapObject(mockNavigator),
      __wbg_platform_faf02c487289f206: (arg0) => {
        const ret = getObject(arg0).platform;
        const ptr = passStringToWasm(ret, wasm.__wbindgen_export_1, wasm.__wbindgen_export_2);
        getDataView().setInt32(arg0 + 4 * 1, WASM_VECTOR_LEN, true);
        getDataView().setInt32(arg0 + 4 * 0, ptr, true);
      },
      __wbg_language_d871ec78ee8eec62: (arg0) => {
        const ret = getObject(arg0).language;
        const ptr = passStringToWasm(ret, wasm.__wbindgen_export_1, wasm.__wbindgen_export_2);
        getDataView().setInt32(arg0 + 4 * 1, WASM_VECTOR_LEN, true);
        getDataView().setInt32(arg0 + 4 * 0, ptr, true);
      },
      __wbg_colorDepth_59677c81c61d599a: (arg0) => mockScreen.colorDepth,
      __wbg_localStorage_1406c99c39728187: () => addHeapObject(mockLocalStorage),
      __wbg_getItem_17f98dee3b43fa7e: () => 0,
      __wbg_setItem_212ecc915942ab0a: () => {},
      __wbg_random_3ad904d98382defe: () => Math.random(),
      __wbg_now_807e54c39636c349: () => Date.now(),
      __wbg_now_d18023d54d4e5500: () => performance.now(),
      __wbg_createElement_8c9931a732ee2fea: () => addHeapObject(mockDocument.createElement('canvas')),
      __wbg_getElementsByTagName_f03d41ce466561e8: () => addHeapObject([]),
      __wbg_length_347907d14a9ed873: (arg0) => getObject(arg0).length,
      __wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5: () => true,
      __wbg_setwidth_c5fed9f5e7f0b406: () => {},
      __wbg_setheight_7e0e28aa9d579028: () => {},
      __wbg_getContext_4d5e97892c9f6c63: () => addHeapObject(mockDocument.createElement('canvas').getContext('2d')),
      __wbg_fillText_6dfde0e13f9a7f67: () => {},
      __wbg_fillRect_6784dc7c5765e0a4: () => {},
      __wbg_toDataURL_97b108dd1a4b7454: (arg0) => {
        const ret = 'data:image/png;base64,AAAA';
        const ptr = passStringToWasm(ret, wasm.__wbindgen_export_1, wasm.__wbindgen_export_2);
        getDataView().setInt32(arg0 + 4 * 1, WASM_VECTOR_LEN, true);
        getDataView().setInt32(arg0 + 4 * 0, ptr, true);
      },
      __wbg_new0_f788a2397c7ca929: () => addHeapObject(new Date()),
      __wbg_getTimezoneOffset_6b5752021c499c47: (arg0) => getObject(arg0).getTimezoneOffset(),
      __wbindgen_export_0: (arg0) => { throw takeObject(arg0); },
      __wbindgen_string_new: (ptr, len) => addHeapObject(getStringFromWasm(ptr, len)),
      __wbindgen_object_drop_ref: dropObject,
      __wbindgen_is_undefined: (arg0) => getObject(arg0) === undefined,
      __wbindgen_is_null: (arg0) => getObject(arg0) === null,
      __wbindgen_string_get: (arg0, arg1) => {
        const obj = getObject(arg1);
        const ret = typeof obj === 'string' ? obj : undefined;
        if (ret === undefined) {
          getDataView().setInt32(arg0 + 4 * 1, 0, true);
          getDataView().setInt32(arg0 + 4 * 0, 0, true);
        } else {
          const ptr = passStringToWasm(ret, wasm.__wbindgen_export_1, wasm.__wbindgen_export_2);
          getDataView().setInt32(arg0 + 4 * 1, WASM_VECTOR_LEN, true);
          getDataView().setInt32(arg0 + 4 * 0, ptr, true);
        }
      },
      __wbindgen_throw: (ptr, len) => { throw new Error(getStringFromWasm(ptr, len)); },
      __wbindgen_cb_drop: () => true,
      __wbg_then_4866a7d9f55d8f3e: (arg0, arg1) => addHeapObject(getObject(arg0).then(getObject(arg1))),
      __wbg_then_3ab08cd4fbb91ae9: (arg0, arg1, arg2) => addHeapObject(getObject(arg0).then(getObject(arg1), getObject(arg2))),
      __wbg_resolve_6e1c6553a82f85b7: (arg0) => addHeapObject(Promise.resolve(getObject(arg0))),
      __wbg_new_1073970097e5a420: (arg0, arg1) => {
        const cb = (resolve, reject) => {
          const fn = wasm.__wbindgen_export_3.get(arg0);
          fn(arg1, addHeapObject(resolve), addHeapObject(reject));
        };
        return addHeapObject(new Promise(cb));
      },
      __wbindgen_closure_wrapper: () => {},
    },
  };
  
  try {
    const wasmModule = await WebAssembly.instantiate(wasmBuffer, imports);
    wasm = wasmModule.instance.exports;
    
    console.log('WASM loaded successfully!');
    console.log('Exports:', Object.keys(wasm));
    
    // Try to call get_img_key
    console.log('\nCalling get_img_key()...');
    
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.get_img_key(retptr);
    
    const r0 = getDataView().getInt32(retptr + 4 * 0, true);
    const r1 = getDataView().getInt32(retptr + 4 * 1, true);
    const r2 = getDataView().getInt32(retptr + 4 * 2, true);
    const r3 = getDataView().getInt32(retptr + 4 * 3, true);
    
    wasm.__wbindgen_add_to_stack_pointer(16);
    
    if (r3) {
      console.log('Error getting key:', takeObject(r2));
    } else {
      const key = getStringFromWasm(r0, r1);
      console.log('*** KEY EXTRACTED:', key, '***');
      
      // Now use this key to make API requests and decrypt
      return key;
    }
    
  } catch (err) {
    console.error('Failed to load WASM:', err.message);
    
    // List missing imports
    if (err.message.includes('import')) {
      console.log('\nMissing imports - need to implement more browser APIs');
    }
  }
  
  return null;
}

async function main() {
  const key = await loadWasm();
  
  if (key) {
    console.log('\n=== Testing with extracted key ===\n');
    
    const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
    
    // Get encrypted data
    const res = await makeRequest(testPath, key, {
      'X-Only-Sources': '1',
      'X-Server': 'alpha',
    });
    
    console.log(`Response status: ${res.status}`);
    console.log(`Response length: ${res.data.length}`);
    console.log(`Response preview: ${res.data.substring(0, 50)}...`);
    
    // TODO: Call process_img_data to decrypt
  }
}

main().catch(console.error);
