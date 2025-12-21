/**
 * Flixer Node.js WASM Loader
 * Loads the Flixer WASM module in pure Node.js by mocking all browser APIs.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WASM_PATH = path.join(__dirname, 'wasm-analysis/client-assets/img_data_bg.wasm');

class FlixerWasmLoader {
  constructor(options = {}) {
    this.wasm = null;
    this.heap = new Array(128).fill(undefined);
    this.heap.push(undefined, null, true, false);
    this.heap_next = this.heap.length;
    this.WASM_VECTOR_LEN = 0;
    this.cachedUint8ArrayMemory0 = null;
    this.cachedDataViewMemory0 = null;
    this.cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    this.cachedTextEncoder = new TextEncoder();
    this.localStorage = new Map();
    this.sessionId = options.sessionId || crypto.randomBytes(16).toString('hex');
    this.timestamp = options.timestamp || Date.now();
    this.randomSeed = options.randomSeed || 0.5;
    this.screenWidth = options.screenWidth || 1920;
    this.screenHeight = options.screenHeight || 1080;
    this.colorDepth = options.colorDepth || 24;
    this.platform = options.platform || 'Win32';
    this.language = options.language || 'en-US';
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.timezoneOffset = options.timezoneOffset || 0;
  }

  getObject(idx) { return this.heap[idx]; }
  addHeapObject(obj) {
    if (this.heap_next === this.heap.length) this.heap.push(this.heap.length + 1);
    const idx = this.heap_next;
    this.heap_next = this.heap[idx];
    this.heap[idx] = obj;
    return idx;
  }
  dropObject(idx) {
    if (idx < 132) return;
    this.heap[idx] = this.heap_next;
    this.heap_next = idx;
  }
  takeObject(idx) {
    const ret = this.getObject(idx);
    this.dropObject(idx);
    return ret;
  }
  getUint8ArrayMemory0() {
    if (this.cachedUint8ArrayMemory0 === null || this.cachedUint8ArrayMemory0.byteLength === 0) {
      this.cachedUint8ArrayMemory0 = new Uint8Array(this.wasm.memory.buffer);
    }
    return this.cachedUint8ArrayMemory0;
  }
  getDataViewMemory0() {
    if (this.cachedDataViewMemory0 === null || this.cachedDataViewMemory0.buffer !== this.wasm.memory.buffer) {
      this.cachedDataViewMemory0 = new DataView(this.wasm.memory.buffer);
    }
    return this.cachedDataViewMemory0;
  }
  getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return this.cachedTextDecoder.decode(this.getUint8ArrayMemory0().subarray(ptr, ptr + len));
  }
  passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
      const buf = this.cachedTextEncoder.encode(arg);
      const ptr = malloc(buf.length, 1) >>> 0;
      this.getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
      this.WASM_VECTOR_LEN = buf.length;
      return ptr;
    }
    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = this.getUint8ArrayMemory0();
    let offset = 0;
    for (; offset < len; offset++) {
      const code = arg.charCodeAt(offset);
      if (code > 0x7F) break;
      mem[ptr + offset] = code;
    }
    if (offset !== len) {
      if (offset !== 0) arg = arg.slice(offset);
      ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
      const view = this.getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
      const ret = this.cachedTextEncoder.encodeInto(arg, view);
      offset += ret.written;
      ptr = realloc(ptr, len, offset, 1) >>> 0;
    }
    this.WASM_VECTOR_LEN = offset;
    return ptr;
  }
  isLikeNone(x) { return x === undefined || x === null; }
  handleError(f, args) {
    try { return f.apply(this, args); }
    catch (e) { this.wasm.__wbindgen_export_0(this.addHeapObject(e)); }
  }
  createMockCanvas() {
    const canvasDataUrl = 'data:image/png;base64,' + Buffer.from(this.sessionId).toString('base64');
    return {
      width: 200, height: 50,
      getContext: (type) => type === '2d' ? {
        _font: '14px Arial', _textBaseline: 'alphabetic',
        fillText: () => {},
        set font(v) { this._font = v; }, get font() { return this._font; },
        set textBaseline(v) { this._textBaseline = v; }, get textBaseline() { return this._textBaseline; },
      } : null,
      toDataURL: () => canvasDataUrl,
      set width(v) {}, set height(v) {},
    };
  }

  buildImports() {
    const self = this;
    const mockDocument = {
      createElement: (tag) => tag === 'canvas' ? self.createMockCanvas() : {},
      getElementsByTagName: () => ({ length: 0 }),
    };
    const mockLocalStorage = {
      getItem: (k) => k === 'tmdb_session_id' ? self.sessionId : self.localStorage.get(k) || null,
      setItem: (k, v) => self.localStorage.set(k, v),
    };
    const mockNavigator = { platform: this.platform, language: this.language, userAgent: this.userAgent };
    const mockScreen = { width: this.screenWidth, height: this.screenHeight, colorDepth: this.colorDepth };
    const mockPerformance = { now: () => Date.now() - this.timestamp };
    const mockWindow = { document: mockDocument, localStorage: mockLocalStorage, navigator: mockNavigator, screen: mockScreen, performance: mockPerformance };
    const imports = { wbg: {} };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return self.handleError(function(a0, a1) { return self.addHeapObject(self.getObject(a0).call(self.getObject(a1))); }, arguments); };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return self.handleError(function(a0, a1, a2) { return self.addHeapObject(self.getObject(a0).call(self.getObject(a1), self.getObject(a2))); }, arguments); };
    imports.wbg.__wbg_colorDepth_59677c81c61d599a = function() { return self.handleError(function(a0) { return self.getObject(a0).colorDepth; }, arguments); };
    imports.wbg.__wbg_height_614ba187d8cae9ca = function() { return self.handleError(function(a0) { return self.getObject(a0).height; }, arguments); };
    imports.wbg.__wbg_width_679079836447b4b7 = function() { return self.handleError(function(a0) { return self.getObject(a0).width; }, arguments); };
    imports.wbg.__wbg_screen_8edf8699f70d98bc = function() { return self.handleError(function() { return self.addHeapObject(mockScreen); }, arguments); };
    imports.wbg.__wbg_document_d249400bd7bd996d = function() { return self.addHeapObject(mockDocument); };
    imports.wbg.__wbg_createElement_8c9931a732ee2fea = function() { return self.handleError(function(a0, a1, a2) { return self.addHeapObject(mockDocument.createElement(self.getStringFromWasm0(a1, a2))); }, arguments); };
    imports.wbg.__wbg_getElementsByTagName_f03d41ce466561e8 = function(a0, a1, a2) { return self.addHeapObject(mockDocument.getElementsByTagName(self.getStringFromWasm0(a1, a2))); };
    imports.wbg.__wbg_getContext_e9cf379449413580 = function() { return self.handleError(function(a0, a1, a2) { const ret = self.getObject(a0).getContext(self.getStringFromWasm0(a1, a2)); return self.isLikeNone(ret) ? 0 : self.addHeapObject(ret); }, arguments); };
    imports.wbg.__wbg_fillText_2a0055d8531355d1 = function() { return self.handleError(function(a0, a1, a2) { self.getObject(a0).fillText(self.getStringFromWasm0(a1, a2), 0, 0); }, arguments); };
    imports.wbg.__wbg_setfont_42a163ef83420b93 = function(a0, a1, a2) { self.getObject(a0).font = self.getStringFromWasm0(a1, a2); };
    imports.wbg.__wbg_settextBaseline_c28d2a6aa4ff9d9d = function(a0, a1, a2) { self.getObject(a0).textBaseline = self.getStringFromWasm0(a1, a2); };
    imports.wbg.__wbg_setheight_da683a33fa99843c = function(a0, a1) { self.getObject(a0).height = a1 >>> 0; };
    imports.wbg.__wbg_setwidth_c5fed9f5e7f0b406 = function(a0, a1) { self.getObject(a0).width = a1 >>> 0; };
    imports.wbg.__wbg_toDataURL_eaec332e848fe935 = function() { return self.handleError(function(a0, a1) { const ret = self.getObject(a1).toDataURL(); const ptr = self.passStringToWasm0(ret, self.wasm.__wbindgen_export_1, self.wasm.__wbindgen_export_2); self.getDataViewMemory0().setInt32(a0 + 4, self.WASM_VECTOR_LEN, true); self.getDataViewMemory0().setInt32(a0, ptr, true); }, arguments); };
    imports.wbg.__wbg_instanceof_CanvasRenderingContext2d_df82a4d3437bf1cc = function() { return true; };
    imports.wbg.__wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5 = function() { return true; };
    imports.wbg.__wbg_instanceof_Window_def73ea0955fc569 = function() { return true; };
    imports.wbg.__wbg_localStorage_1406c99c39728187 = function() { return self.handleError(function() { return self.addHeapObject(mockLocalStorage); }, arguments); };
    imports.wbg.__wbg_getItem_17f98dee3b43fa7e = function() { return self.handleError(function(a0, a1, a2, a3) { const ret = mockLocalStorage.getItem(self.getStringFromWasm0(a2, a3)); const ptr = self.isLikeNone(ret) ? 0 : self.passStringToWasm0(ret, self.wasm.__wbindgen_export_1, self.wasm.__wbindgen_export_2); self.getDataViewMemory0().setInt32(a0 + 4, self.WASM_VECTOR_LEN, true); self.getDataViewMemory0().setInt32(a0, ptr, true); }, arguments); };
    imports.wbg.__wbg_setItem_212ecc915942ab0a = function() { return self.handleError(function(a0, a1, a2, a3, a4) { mockLocalStorage.setItem(self.getStringFromWasm0(a1, a2), self.getStringFromWasm0(a3, a4)); }, arguments); };
    imports.wbg.__wbg_navigator_1577371c070c8947 = function() { return self.addHeapObject(mockNavigator); };
    imports.wbg.__wbg_language_d871ec78ee8eec62 = function(a0, a1) { const ret = self.getObject(a1).language; const ptr = self.isLikeNone(ret) ? 0 : self.passStringToWasm0(ret, self.wasm.__wbindgen_export_1, self.wasm.__wbindgen_export_2); self.getDataViewMemory0().setInt32(a0 + 4, self.WASM_VECTOR_LEN, true); self.getDataViewMemory0().setInt32(a0, ptr, true); };
    imports.wbg.__wbg_platform_faf02c487289f206 = function() { return self.handleError(function(a0, a1) { const ret = self.getObject(a1).platform; const ptr = self.passStringToWasm0(ret, self.wasm.__wbindgen_export_1, self.wasm.__wbindgen_export_2); self.getDataViewMemory0().setInt32(a0 + 4, self.WASM_VECTOR_LEN, true); self.getDataViewMemory0().setInt32(a0, ptr, true); }, arguments); };
    imports.wbg.__wbg_userAgent_12e9d8e62297563f = function() { return self.handleError(function(a0, a1) { const ret = self.getObject(a1).userAgent; const ptr = self.passStringToWasm0(ret, self.wasm.__wbindgen_export_1, self.wasm.__wbindgen_export_2); self.getDataViewMemory0().setInt32(a0 + 4, self.WASM_VECTOR_LEN, true); self.getDataViewMemory0().setInt32(a0, ptr, true); }, arguments); };
    imports.wbg.__wbg_new0_f788a2397c7ca929 = function() { return self.addHeapObject(new Date(self.timestamp)); };
    imports.wbg.__wbg_now_807e54c39636c349 = function() { return self.timestamp; };
    imports.wbg.__wbg_getTimezoneOffset_6b5752021c499c47 = function() { return self.timezoneOffset; };
    imports.wbg.__wbg_performance_c185c0cdc2766575 = function() { return self.addHeapObject(mockPerformance); };
    imports.wbg.__wbg_now_d18023d54d4e5500 = function(a0) { return self.getObject(a0).now(); };
    imports.wbg.__wbg_random_3ad904d98382defe = function() { return self.randomSeed; };
    imports.wbg.__wbg_length_347907d14a9ed873 = function(a0) { return self.getObject(a0).length; };

    imports.wbg.__wbg_new_23a2665fac83c611 = function(a0, a1) { try { var state0 = { a: a0, b: a1 }; var cb0 = (arg0, arg1) => { const a = state0.a; state0.a = 0; try { return self.wasm.__wbindgen_export_6(a, state0.b, self.addHeapObject(arg0), self.addHeapObject(arg1)); } finally { state0.a = a; } }; return self.addHeapObject(new Promise(cb0)); } finally { state0.a = state0.b = 0; } };
    imports.wbg.__wbg_resolve_4851785c9c5f573d = function(a0) { return self.addHeapObject(Promise.resolve(self.getObject(a0))); };
    imports.wbg.__wbg_reject_b3fcf99063186ff7 = function(a0) { return self.addHeapObject(Promise.reject(self.getObject(a0))); };
    imports.wbg.__wbg_then_44b73946d2fb3e7d = function(a0, a1) { return self.addHeapObject(self.getObject(a0).then(self.getObject(a1))); };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(a0, a1) { return self.addHeapObject(new Function(self.getStringFromWasm0(a0, a1))); };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() { return typeof global === 'undefined' ? 0 : self.addHeapObject(global); };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() { return typeof globalThis === 'undefined' ? 0 : self.addHeapObject(globalThis); };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() { return self.addHeapObject(mockWindow); };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() { return self.addHeapObject(mockWindow); };
    imports.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = function(a0) { queueMicrotask(self.getObject(a0)); };
    imports.wbg.__wbg_queueMicrotask_d3219def82552485 = function(a0) { return self.addHeapObject(self.getObject(a0).queueMicrotask); };
    imports.wbg.__wbindgen_cb_drop = function(a0) { const obj = self.takeObject(a0).original; if (obj.cnt-- == 1) { obj.a = 0; return true; } return false; };
    imports.wbg.__wbindgen_closure_wrapper982 = function(a0, a1, a2) { const state = { a: a0, b: a1, cnt: 1, dtor: 36 }; const real = (...args) => { state.cnt++; const a = state.a; state.a = 0; try { return self.wasm.__wbindgen_export_5(a, state.b, self.addHeapObject(args[0])); } finally { if (--state.cnt === 0) self.wasm.__wbindgen_export_3.get(state.dtor)(a, state.b); else state.a = a; } }; real.original = state; return self.addHeapObject(real); };
    imports.wbg.__wbindgen_is_function = function(a0) { return typeof self.getObject(a0) === 'function'; };
    imports.wbg.__wbindgen_is_undefined = function(a0) { return self.getObject(a0) === undefined; };
    imports.wbg.__wbindgen_object_clone_ref = function(a0) { return self.addHeapObject(self.getObject(a0)); };
    imports.wbg.__wbindgen_object_drop_ref = function(a0) { self.takeObject(a0); };
    imports.wbg.__wbindgen_string_new = function(a0, a1) { return self.addHeapObject(self.getStringFromWasm0(a0, a1)); };
    imports.wbg.__wbindgen_throw = function(a0, a1) { throw new Error(self.getStringFromWasm0(a0, a1)); };
    return imports;
  }

  async initialize() {
    const wasmBuffer = fs.readFileSync(WASM_PATH);
    const imports = this.buildImports();
    const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
    this.wasm = instance.exports;
    console.log('[FlixerWasm] Initialized with session:', this.sessionId.slice(0, 8) + '...');
    return this;
  }

  getImgKey() {
    const retptr = this.wasm.__wbindgen_add_to_stack_pointer(-16);
    try {
      this.wasm.get_img_key(retptr);
      const r0 = this.getDataViewMemory0().getInt32(retptr, true);
      const r1 = this.getDataViewMemory0().getInt32(retptr + 4, true);
      const r2 = this.getDataViewMemory0().getInt32(retptr + 8, true);
      const r3 = this.getDataViewMemory0().getInt32(retptr + 12, true);
      if (r3) { throw this.takeObject(r2); }
      const result = this.getStringFromWasm0(r0, r1);
      this.wasm.__wbindgen_export_4(r0, r1, 1);
      return result;
    } finally {
      this.wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }

  async processImgData(encryptedData, apiKey) {
    const ptr0 = this.passStringToWasm0(encryptedData, this.wasm.__wbindgen_export_1, this.wasm.__wbindgen_export_2);
    const len0 = this.WASM_VECTOR_LEN;
    const ptr1 = this.passStringToWasm0(apiKey, this.wasm.__wbindgen_export_1, this.wasm.__wbindgen_export_2);
    const len1 = this.WASM_VECTOR_LEN;
    const ret = this.wasm.process_img_data(ptr0, len0, ptr1, len1);
    return this.takeObject(ret);
  }
}

module.exports = { FlixerWasmLoader };

// Test when run directly
if (require.main === module) {
  (async () => {
    console.log('=== Testing Flixer Node.js WASM Loader ===');
    try {
      const loader = new FlixerWasmLoader();
      await loader.initialize();
      const key = loader.getImgKey();
      console.log('Generated Key:', key);
      console.log('Key Length:', key.length, 'chars');
    } catch (e) {
      console.error('Error:', e.message);
      console.error(e.stack);
    }
  })();
}
