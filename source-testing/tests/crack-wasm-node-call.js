/**
 * Crack WASM - Call WASM Functions from Node.js
 * 
 * Now that we can load the WASM, let's try to call the decryption function.
 * We need to properly handle string passing to/from WASM.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Helper to make HTTPS requests
function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function callWasmDecrypt() {
  console.log('=== Call WASM Decryption from Node.js ===\n');
  
  // Read the WASM file
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // We need to track allocated memory
  let memoryOffset = 1048576; // Start after the initial memory
  let wasmMemory = null;
  let wasmInstance = null;
  
  // String handling
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  
  function allocString(str) {
    const bytes = textEncoder.encode(str);
    const ptr = memoryOffset;
    const view = new Uint8Array(wasmMemory.buffer, ptr, bytes.length);
    view.set(bytes);
    memoryOffset += bytes.length + 1; // +1 for null terminator
    return { ptr, len: bytes.length };
  }
  
  function readString(ptr, len) {
    const view = new Uint8Array(wasmMemory.buffer, ptr, len);
    return textDecoder.decode(view);
  }
  
  // Track JS objects for wbindgen
  const jsObjects = [undefined, null, true, false];
  let nextObjectId = jsObjects.length;
  
  function addObject(obj) {
    const id = nextObjectId++;
    jsObjects[id] = obj;
    return id;
  }
  
  function getObject(id) {
    return jsObjects[id];
  }
  
  function dropObject(id) {
    jsObjects[id] = undefined;
  }
  
  // Create import object
  const importObject = {
    wbg: {
      __wbg_now_807e54c39636c349: () => Date.now(),
      __wbindgen_string_new: (ptr, len) => {
        const str = readString(ptr, len);
        return addObject(str);
      },
      __wbg_now_d18023d54d4e5500: (obj) => Date.now(),
      __wbg_navigator_1577371c070c8947: (obj) => addObject({ userAgent: 'Mozilla/5.0', platform: 'Win32', language: 'en-US' }),
      __wbg_getElementsByTagName_f03d41ce466561e8: (doc, ptr, len) => addObject({ length: 0 }),
      __wbg_length_347907d14a9ed873: (obj) => {
        const o = getObject(obj);
        return o?.length || 0;
      },
      __wbg_colorDepth_59677c81c61d599a: (obj) => 24,
      __wbg_platform_faf02c487289f206: (retPtr, obj) => {
        const str = 'Win32';
        const { ptr, len } = allocString(str);
        const view = new DataView(wasmMemory.buffer);
        view.setInt32(retPtr, ptr, true);
        view.setInt32(retPtr + 4, len, true);
      },
      __wbg_language_d871ec78ee8eec62: (retPtr, obj) => {
        const str = 'en-US';
        const { ptr, len } = allocString(str);
        const view = new DataView(wasmMemory.buffer);
        view.setInt32(retPtr, ptr, true);
        view.setInt32(retPtr + 4, len, true);
      },
      __wbg_new0_f788a2397c7ca929: () => addObject(new Date()),
      __wbg_getTimezoneOffset_6b5752021c499c47: (obj) => new Date().getTimezoneOffset(),
      __wbg_localStorage_1406c99c39728187: (obj) => addObject({ getItem: () => null, setItem: () => {} }),
      __wbg_getItem_17f98dee3b43fa7e: (retPtr, storage, keyPtr, keyLen) => {
        const view = new DataView(wasmMemory.buffer);
        view.setInt32(retPtr, 1, true); // isNull = true
        view.setInt32(retPtr + 4, 0, true);
        view.setInt32(retPtr + 8, 0, true);
      },
      __wbg_random_3ad904d98382defe: () => Math.random(),
      __wbg_setItem_212ecc915942ab0a: () => {},
      __wbg_createElement_8c9931a732ee2fea: (doc, tagPtr, tagLen) => {
        const tag = readString(tagPtr, tagLen);
        return addObject({ tagName: tag, getContext: () => null, toDataURL: () => '', width: 300, height: 150 });
      },
      __wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5: (obj) => 1,
      __wbg_setwidth_c5fed9f5e7f0b406: (obj, val) => {},
      __wbg_setheight_da683a33fa99843c: (obj, val) => {},
      __wbg_getContext_e9cf379449413580: (canvas, typePtr, typeLen) => {
        return addObject({
          fillText: () => {},
          measureText: () => ({ width: 100 }),
          font: '',
          textBaseline: '',
        });
      },
      __wbg_instanceof_CanvasRenderingContext2d_df82a4d3437bf1cc: (obj) => 1,
      __wbg_settextBaseline_c28d2a6aa4ff9d9d: (ctx, ptr, len) => {},
      __wbg_toDataURL_eaec332e848fe935: (retPtr, canvas) => {
        const str = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const { ptr, len } = allocString(str);
        const view = new DataView(wasmMemory.buffer);
        view.setInt32(retPtr, ptr, true);
        view.setInt32(retPtr + 4, len, true);
      },
      __wbg_reject_b3fcf99063186ff7: (obj) => addObject(Promise.reject(getObject(obj))),
      __wbg_new_23a2665fac83c611: (resolve, reject) => addObject(new Promise((res, rej) => {})),
      __wbindgen_object_clone_ref: (obj) => addObject(getObject(obj)),
      __wbindgen_is_undefined: (obj) => getObject(obj) === undefined ? 1 : 0,
      __wbg_newnoargs_105ed471475aaf50: (ptr, len) => addObject(new Function(readString(ptr, len))),
      __wbg_call_672a4d21634d4a24: (fn, thisArg) => {
        try {
          const result = getObject(fn).call(getObject(thisArg));
          return addObject(result);
        } catch (e) {
          return addObject(undefined);
        }
      },
      __wbg_static_accessor_GLOBAL_88a902d13a557d07: () => addObject(global),
      __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: () => addObject(globalThis),
      __wbg_static_accessor_WINDOW_5de37043a91a9c40: () => addObject(undefined),
      __wbg_static_accessor_SELF_37c5d418e4bf5819: () => addObject(undefined),
      __wbg_call_7cccdd69e0791ae2: (fn, thisArg, arg) => {
        try {
          const result = getObject(fn).call(getObject(thisArg), getObject(arg));
          return addObject(result);
        } catch (e) {
          return addObject(undefined);
        }
      },
      __wbindgen_throw: (ptr, len) => {
        const msg = readString(ptr, len);
        throw new Error(`WASM error: ${msg}`);
      },
      __wbindgen_object_drop_ref: (obj) => dropObject(obj),
      __wbindgen_cb_drop: (obj) => {
        const o = getObject(obj);
        if (o && typeof o === 'function') {
          dropObject(obj);
          return 1;
        }
        return 0;
      },
      __wbg_then_44b73946d2fb3e7d: (promise, cb) => addObject(getObject(promise).then(getObject(cb))),
      __wbg_queueMicrotask_97d92b4fcc8a61c5: (cb) => queueMicrotask(() => getObject(cb)()),
      __wbg_queueMicrotask_d3219def82552485: (obj) => addObject(queueMicrotask),
      __wbindgen_is_function: (obj) => typeof getObject(obj) === 'function' ? 1 : 0,
      __wbg_resolve_4851785c9c5f573d: (val) => addObject(Promise.resolve(getObject(val))),
      __wbg_instanceof_Window_def73ea0955fc569: (obj) => 0,
      __wbg_setfont_42a163ef83420b93: (ctx, ptr, len) => {},
      __wbg_fillText_2a0055d8531355d1: (ctx, ptr, len, x, y) => {},
      __wbg_userAgent_12e9d8e62297563f: (retPtr, nav) => {
        const str = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const { ptr, len } = allocString(str);
        const view = new DataView(wasmMemory.buffer);
        view.setInt32(retPtr, ptr, true);
        view.setInt32(retPtr + 4, len, true);
      },
      __wbg_width_679079836447b4b7: (obj) => 1920,
      __wbg_height_614ba187d8cae9ca: (obj) => 1080,
      __wbg_document_d249400bd7bd996d: (win) => addObject({ getElementsByTagName: () => ({ length: 0 }), createElement: () => ({}) }),
      __wbg_screen_8edf8699f70d98bc: (win) => addObject({ width: 1920, height: 1080, colorDepth: 24 }),
      __wbg_performance_c185c0cdc2766575: (win) => addObject({ now: () => Date.now() }),
      __wbindgen_closure_wrapper982: (arg0, arg1, arg2) => addObject(() => {}),
    },
  };
  
  try {
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
    wasmMemory = wasmInstance.exports.memory;
    
    console.log('WASM loaded successfully');
    console.log(`Memory size: ${wasmMemory.buffer.byteLength} bytes`);
    
    // First, let's get an encrypted response from the API
    const testKey = crypto.randomBytes(32).toString('hex');
    console.log(`\nTest key: ${testKey}`);
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').substring(0, 22);
    const apiPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${testKey}:${timestamp}:${nonce}:${apiPath}`;
    const signature = crypto.createHmac('sha256', testKey).update(message).digest('base64');
    
    console.log('Fetching encrypted data from API...');
    
    const response = await httpsGet(`https://plsdontscrapemelove.flixer.sh${apiPath}`, {
      headers: {
        'X-Api-Key': testKey,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
        'Origin': 'https://flixer.sh',
        'Referer': 'https://flixer.sh/',
      },
    });
    
    console.log(`API response status: ${response.status}`);
    console.log(`Encrypted data length: ${response.data.length} chars`);
    
    // Now try to call the WASM function
    // The function signature is: process_img_data(encrypted_ptr, encrypted_len, key_ptr, key_len) -> result_ptr
    
    // Allocate memory for the encrypted data
    const encryptedData = response.data;
    const { ptr: encPtr, len: encLen } = allocString(encryptedData);
    
    // Allocate memory for the key
    const { ptr: keyPtr, len: keyLen } = allocString(testKey);
    
    console.log(`\nCalling process_img_data...`);
    console.log(`  encrypted: ptr=${encPtr}, len=${encLen}`);
    console.log(`  key: ptr=${keyPtr}, len=${keyLen}`);
    
    // Call the function
    const resultPtr = wasmInstance.exports.process_img_data(encPtr, encLen, keyPtr, keyLen);
    
    console.log(`Result pointer: ${resultPtr}`);
    
    // Read the result
    // The result is likely a pointer to a string with length
    const view = new DataView(wasmMemory.buffer);
    const resultDataPtr = view.getInt32(resultPtr, true);
    const resultLen = view.getInt32(resultPtr + 4, true);
    
    console.log(`Result data: ptr=${resultDataPtr}, len=${resultLen}`);
    
    if (resultLen > 0 && resultLen < 10000) {
      const result = readString(resultDataPtr, resultLen);
      console.log(`\nDecrypted result: ${result}`);
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
    console.log(e.stack);
  }
}

callWasmDecrypt().catch(console.error);
