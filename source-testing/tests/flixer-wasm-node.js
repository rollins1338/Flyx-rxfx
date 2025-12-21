/**
 * Flixer Node.js WASM Loader - Pure Node.js implementation
 * 
 * This module loads and runs the Flixer WASM module without requiring a browser
 * by mocking all necessary browser APIs (window, document, navigator, screen, etc.)
 * 
 * Key discovery: The WASM validates that performance.now() returns a reasonable value
 * (not too small), so we default the timestamp to 5 seconds ago.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WASM_PATH = path.join(__dirname, 'wasm-analysis/client-assets/img_data_bg.wasm');

class FlixerWasmLoader {
  constructor(opts = {}) {
    this.wasm = null;
    this.heap = new Array(128).fill(undefined);
    this.heap.push(undefined, null, true, false);
    this.heap_next = this.heap.length;
    this.WASM_VECTOR_LEN = 0;
    this.cachedUint8ArrayMemory0 = null;
    this.cachedDataViewMemory0 = null;
    this.cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    this.cachedTextEncoder = new TextEncoder();
    
    // Configurable browser fingerprint values
    this.sessionId = opts.sessionId || crypto.randomBytes(16).toString('hex');
    this.timestamp = opts.timestamp || (Date.now() - 5000); // 5 seconds ago for realistic performance.now()
    this.randomSeed = opts.randomSeed || Math.random();
    this.screenWidth = opts.screenWidth || 1920;
    this.screenHeight = opts.screenHeight || 1080;
    this.colorDepth = opts.colorDepth || 24;
    this.platform = opts.platform || 'Win32';
    this.language = opts.language || 'en-US';
    this.userAgent = opts.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.timezoneOffset = opts.timezoneOffset || new Date().getTimezoneOffset();
    this.debug = opts.debug || false;
  }

  log(...args) {
    if (this.debug) console.log(...args);
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
    if (!this.cachedUint8ArrayMemory0 || this.cachedUint8ArrayMemory0.byteLength === 0) {
      this.cachedUint8ArrayMemory0 = new Uint8Array(this.wasm.memory.buffer);
    }
    return this.cachedUint8ArrayMemory0;
  }

  getDataViewMemory0() {
    if (!this.cachedDataViewMemory0 || this.cachedDataViewMemory0.buffer !== this.wasm.memory.buffer) {
      this.cachedDataViewMemory0 = new DataView(this.wasm.memory.buffer);
    }
    return this.cachedDataViewMemory0;
  }

  getStringFromWasm0(ptr, len) {
    return this.cachedTextDecoder.decode(this.getUint8ArrayMemory0().subarray(ptr >>> 0, (ptr >>> 0) + len));
  }

  passStringToWasm0(arg, malloc) {
    const buf = this.cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    this.getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
    this.WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  isLikeNone(x) { return x === undefined || x === null; }

  handleError(f, args) {
    try { return f.apply(this, args); }
    catch (e) { 
      this.log('[handleError] caught:', e);
      this.wasm.__wbindgen_export_0(this.addHeapObject(e)); 
    }
  }

  createMockCanvas() {
    const self = this;
    const canvasData = `canvas-fp-${this.screenWidth}x${this.screenHeight}-${this.colorDepth}-${this.platform}-${this.language}`;
    const dataUrl = 'data:image/png;base64,' + Buffer.from(canvasData).toString('base64');
    
    const ctx = {
      _font: '14px Arial',
      _textBaseline: 'alphabetic',
      fillText: function() {},
      get font() { return this._font; },
      set font(v) { this._font = v; },
      get textBaseline() { return this._textBaseline; },
      set textBaseline(v) { this._textBaseline = v; },
    };
    
    return {
      _width: 200,
      _height: 50,
      get width() { return this._width; },
      set width(v) { this._width = v; },
      get height() { return this._height; },
      set height(v) { this._height = v; },
      getContext: (type) => type === '2d' ? ctx : null,
      toDataURL: () => dataUrl,
    };
  }

  buildImports() {
    const self = this;
    
    // Mock DOM elements
    const mockBody = { 
      appendChild: () => {},
      tagName: 'BODY',
      nodeName: 'BODY',
      nodeType: 1,
      innerHTML: '',
      outerHTML: '<body></body>',
      parentNode: null,
      parentElement: null,
      children: [],
      childNodes: [],
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      ownerDocument: null,
      style: {},
      className: '',
      classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
      getAttribute: () => null,
      setAttribute: () => {},
      removeAttribute: () => {},
      hasAttribute: () => false,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
      scrollTop: 0,
      scrollLeft: 0,
      scrollWidth: 0,
      scrollHeight: 0,
      clientWidth: this.screenWidth,
      clientHeight: this.screenHeight,
      offsetWidth: this.screenWidth,
      offsetHeight: this.screenHeight,
      offsetTop: 0,
      offsetLeft: 0,
    };
    
    const createCollection = (elements) => {
      const collection = {
        length: elements.length,
        item: (i) => elements[i] || null,
        namedItem: () => null,
        [Symbol.iterator]: function* () { for (const e of elements) yield e; }
      };
      elements.forEach((el, i) => { collection[i] = el; });
      return new Proxy(collection, {
        get(target, prop) {
          if (typeof prop === 'string' && !isNaN(parseInt(prop))) {
            return target[parseInt(prop)];
          }
          return target[prop];
        }
      });
    };
    
    // Wrap mockBody in a Proxy
    const trackedBody = new Proxy(mockBody, {
      get(target, prop) { return target[prop]; },
      set(target, prop, value) { target[prop] = value; return true; }
    });
    
    const doc = { 
      createElement: (t) => t === 'canvas' ? self.createMockCanvas() : {},
      getElementsByTagName: (t) => t === 'body' ? createCollection([trackedBody]) : createCollection([]),
      body: trackedBody,
    };
    
    const ls = { 
      getItem: (k) => k === 'tmdb_session_id' ? self.sessionId : null,
      setItem: () => {},
    };
    
    const nav = { platform: this.platform, language: this.language, userAgent: this.userAgent };
    const scr = { width: this.screenWidth, height: this.screenHeight, colorDepth: this.colorDepth };
    const perf = { now: () => Date.now() - this.timestamp };
    const win = { document: doc, localStorage: ls, navigator: nav, screen: scr, performance: perf };
    
    const i = { wbg: {} };

    // Function calls
    i.wbg.__wbg_call_672a4d21634d4a24 = function() { 
      return self.handleError((a, b) => self.addHeapObject(self.getObject(a).call(self.getObject(b))), arguments); 
    };
    i.wbg.__wbg_call_7cccdd69e0791ae2 = function() { 
      return self.handleError((a, b, c) => self.addHeapObject(self.getObject(a).call(self.getObject(b), self.getObject(c))), arguments); 
    };
    
    // Screen
    i.wbg.__wbg_colorDepth_59677c81c61d599a = function() { 
      return self.handleError((a) => self.getObject(a).colorDepth, arguments);
    };
    i.wbg.__wbg_height_614ba187d8cae9ca = function() {
      return self.handleError((a) => self.getObject(a).height, arguments);
    };
    i.wbg.__wbg_width_679079836447b4b7 = function() {
      return self.handleError((a) => self.getObject(a).width, arguments);
    };
    i.wbg.__wbg_screen_8edf8699f70d98bc = function() {
      return self.handleError((a) => {
        const w = self.getObject(a);
        return self.addHeapObject(w ? w.screen : scr);
      }, arguments);
    };
    
    // Document
    i.wbg.__wbg_document_d249400bd7bd996d = (a) => { 
      const w = self.getObject(a);
      const d = w ? w.document : null;
      if (d) {
        const trackedDoc = new Proxy(d, { get(target, prop) { return target[prop]; } });
        return self.addHeapObject(trackedDoc);
      }
      return 0;
    };
    i.wbg.__wbg_createElement_8c9931a732ee2fea = function() { 
      return self.handleError((a, b, c) => self.addHeapObject(doc.createElement(self.getStringFromWasm0(b, c))), arguments);
    };
    i.wbg.__wbg_getElementsByTagName_f03d41ce466561e8 = (a, b, c) => self.addHeapObject(doc.getElementsByTagName(self.getStringFromWasm0(b, c)));
    
    // Canvas
    i.wbg.__wbg_getContext_e9cf379449413580 = function() { 
      return self.handleError((a, b, c) => { 
        const r = self.getObject(a).getContext(self.getStringFromWasm0(b, c)); 
        return self.isLikeNone(r) ? 0 : self.addHeapObject(r); 
      }, arguments);
    };
    i.wbg.__wbg_fillText_2a0055d8531355d1 = function() { 
      return self.handleError((a, b, c, d, e) => self.getObject(a).fillText(self.getStringFromWasm0(b, c), d, e), arguments);
    };
    i.wbg.__wbg_setfont_42a163ef83420b93 = (a, b, c) => { self.getObject(a).font = self.getStringFromWasm0(b, c); };
    i.wbg.__wbg_settextBaseline_c28d2a6aa4ff9d9d = (a, b, c) => { self.getObject(a).textBaseline = self.getStringFromWasm0(b, c); };
    i.wbg.__wbg_setheight_da683a33fa99843c = (a, b) => { self.getObject(a).height = b >>> 0; };
    i.wbg.__wbg_setwidth_c5fed9f5e7f0b406 = (a, b) => { self.getObject(a).width = b >>> 0; };
    i.wbg.__wbg_toDataURL_eaec332e848fe935 = function() { 
      return self.handleError((a, b) => { 
        const r = self.getObject(b).toDataURL(); 
        const p = self.passStringToWasm0(r, self.wasm.__wbindgen_export_1); 
        self.getDataViewMemory0().setInt32(a + 4, self.WASM_VECTOR_LEN, true); 
        self.getDataViewMemory0().setInt32(a, p, true); 
      }, arguments);
    };
    i.wbg.__wbg_instanceof_CanvasRenderingContext2d_df82a4d3437bf1cc = () => 1;
    i.wbg.__wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5 = () => 1;
    i.wbg.__wbg_instanceof_Window_def73ea0955fc569 = () => 1;
    
    // LocalStorage
    i.wbg.__wbg_localStorage_1406c99c39728187 = function() { 
      return self.handleError((a) => {
        const w = self.getObject(a);
        const storage = w ? w.localStorage : ls;
        return self.isLikeNone(storage) ? 0 : self.addHeapObject(storage);
      }, arguments); 
    };
    i.wbg.__wbg_getItem_17f98dee3b43fa7e = function() { 
      return self.handleError((a, b, c, d) => { 
        const r = self.getObject(b).getItem(self.getStringFromWasm0(c, d)); 
        const p = self.isLikeNone(r) ? 0 : self.passStringToWasm0(r, self.wasm.__wbindgen_export_1); 
        self.getDataViewMemory0().setInt32(a + 4, self.WASM_VECTOR_LEN, true); 
        self.getDataViewMemory0().setInt32(a, p, true); 
      }, arguments); 
    };
    i.wbg.__wbg_setItem_212ecc915942ab0a = function() { 
      return self.handleError((a, b, c, d, e) => {
        self.getObject(a).setItem(self.getStringFromWasm0(b, c), self.getStringFromWasm0(d, e));
      }, arguments); 
    };
    
    // Navigator
    i.wbg.__wbg_navigator_1577371c070c8947 = (a) => { 
      const w = self.getObject(a);
      return self.addHeapObject(w ? w.navigator : nav); 
    };
    i.wbg.__wbg_language_d871ec78ee8eec62 = (a, b) => { 
      const r = self.getObject(b).language; 
      const p = self.isLikeNone(r) ? 0 : self.passStringToWasm0(r, self.wasm.__wbindgen_export_1); 
      self.getDataViewMemory0().setInt32(a + 4, self.WASM_VECTOR_LEN, true); 
      self.getDataViewMemory0().setInt32(a, p, true); 
    };
    i.wbg.__wbg_platform_faf02c487289f206 = function() { 
      return self.handleError((a, b) => { 
        const r = self.getObject(b).platform; 
        const p = self.passStringToWasm0(r, self.wasm.__wbindgen_export_1); 
        self.getDataViewMemory0().setInt32(a + 4, self.WASM_VECTOR_LEN, true); 
        self.getDataViewMemory0().setInt32(a, p, true); 
      }, arguments); 
    };
    i.wbg.__wbg_userAgent_12e9d8e62297563f = function() { 
      return self.handleError((a, b) => { 
        const r = self.getObject(b).userAgent; 
        const p = self.passStringToWasm0(r, self.wasm.__wbindgen_export_1); 
        self.getDataViewMemory0().setInt32(a + 4, self.WASM_VECTOR_LEN, true); 
        self.getDataViewMemory0().setInt32(a, p, true); 
      }, arguments); 
    };
    
    // Date/Time
    i.wbg.__wbg_new0_f788a2397c7ca929 = () => self.addHeapObject(new Date(self.timestamp));
    i.wbg.__wbg_now_807e54c39636c349 = () => self.timestamp;
    i.wbg.__wbg_getTimezoneOffset_6b5752021c499c47 = () => self.timezoneOffset;
    i.wbg.__wbg_performance_c185c0cdc2766575 = (a) => {
      const w = self.getObject(a);
      const p = w ? w.performance : perf;
      return self.isLikeNone(p) ? 0 : self.addHeapObject(p);
    };
    i.wbg.__wbg_now_d18023d54d4e5500 = (a) => self.getObject(a).now();
    i.wbg.__wbg_random_3ad904d98382defe = () => self.randomSeed;
    
    // Utility
    i.wbg.__wbg_length_347907d14a9ed873 = (a) => self.getObject(a).length;
    i.wbg.__wbg_new_23a2665fac83c611 = (a, b) => { 
      try { 
        var s = { a, b }; 
        var cb = (x, y) => { 
          const t = s.a; s.a = 0; 
          try { return self.wasm.__wbindgen_export_6(t, s.b, self.addHeapObject(x), self.addHeapObject(y)); } 
          finally { s.a = t; } 
        }; 
        return self.addHeapObject(new Promise(cb)); 
      } finally { s.a = s.b = 0; } 
    };
    i.wbg.__wbg_resolve_4851785c9c5f573d = (a) => self.addHeapObject(Promise.resolve(self.getObject(a)));
    i.wbg.__wbg_reject_b3fcf99063186ff7 = (a) => self.addHeapObject(Promise.reject(self.getObject(a)));
    i.wbg.__wbg_then_44b73946d2fb3e7d = (a, b) => self.addHeapObject(self.getObject(a).then(self.getObject(b)));
    i.wbg.__wbg_newnoargs_105ed471475aaf50 = (a, b) => self.addHeapObject(new Function(self.getStringFromWasm0(a, b)));
    
    // Global accessors
    i.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = () => typeof global === 'undefined' ? 0 : self.addHeapObject(global);
    i.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = () => typeof globalThis === 'undefined' ? 0 : self.addHeapObject(globalThis);
    i.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = () => self.addHeapObject(win);
    i.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = () => self.addHeapObject(win);
    
    // Microtask
    i.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = (a) => queueMicrotask(self.getObject(a));
    i.wbg.__wbg_queueMicrotask_d3219def82552485 = (a) => self.addHeapObject(self.getObject(a).queueMicrotask);
    
    // Wbindgen internals
    i.wbg.__wbindgen_cb_drop = (a) => { const o = self.takeObject(a).original; if (o.cnt-- == 1) { o.a = 0; return true; } return false; };
    i.wbg.__wbindgen_closure_wrapper982 = (a, b) => { 
      const s = { a, b, cnt: 1, dtor: 36 }; 
      const r = (...args) => { 
        s.cnt++; const t = s.a; s.a = 0; 
        try { return self.wasm.__wbindgen_export_5(t, s.b, self.addHeapObject(args[0])); } 
        finally { if (--s.cnt === 0) self.wasm.__wbindgen_export_3.get(s.dtor)(t, s.b); else s.a = t; } 
      }; 
      r.original = s; 
      return self.addHeapObject(r); 
    };
    i.wbg.__wbindgen_is_function = (a) => typeof self.getObject(a) === 'function';
    i.wbg.__wbindgen_is_undefined = (a) => self.getObject(a) === undefined;
    i.wbg.__wbindgen_object_clone_ref = (a) => self.addHeapObject(self.getObject(a));
    i.wbg.__wbindgen_object_drop_ref = (a) => self.takeObject(a);
    i.wbg.__wbindgen_string_new = (a, b) => self.addHeapObject(self.getStringFromWasm0(a, b));
    i.wbg.__wbindgen_throw = (a, b) => { throw new Error(self.getStringFromWasm0(a, b)); };
    
    return i;
  }

  async initialize() {
    const wasmBuffer = fs.readFileSync(WASM_PATH);
    const imports = this.buildImports();
    const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
    this.wasm = instance.exports;
    this.log('[FlixerWasm] Initialized, session:', this.sessionId.slice(0, 8) + '...');
    return this;
  }

  /**
   * Generate the decryption key based on browser fingerprint
   * @returns {string} 64-character hex key
   */
  getImgKey() {
    const retptr = this.wasm.__wbindgen_add_to_stack_pointer(-16);
    try {
      this.wasm.get_img_key(retptr);
      const dv = this.getDataViewMemory0();
      const r0 = dv.getInt32(retptr, true);
      const r1 = dv.getInt32(retptr + 4, true);
      const r2 = dv.getInt32(retptr + 8, true);
      const r3 = dv.getInt32(retptr + 12, true);
      if (r3) {
        throw this.takeObject(r2);
      }
      const result = this.getStringFromWasm0(r0, r1);
      this.wasm.__wbindgen_export_4(r0, r1, 1);
      return result;
    } finally {
      this.wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }

  /**
   * Process (decrypt) image data using the provided key
   * @param {string} data - Encrypted data
   * @param {string} key - Decryption key from getImgKey()
   * @returns {Promise<any>} Decrypted data
   */
  async processImgData(data, key) {
    const p0 = this.passStringToWasm0(data, this.wasm.__wbindgen_export_1);
    const l0 = this.WASM_VECTOR_LEN;
    const p1 = this.passStringToWasm0(key, this.wasm.__wbindgen_export_1);
    const l1 = this.WASM_VECTOR_LEN;
    return this.takeObject(this.wasm.process_img_data(p0, l0, p1, l1));
  }
}

module.exports = { FlixerWasmLoader };

// Test when run directly
if (require.main === module) {
  (async () => {
    console.log('=== Flixer Node.js WASM Loader Test ===\n');
    try {
      const loader = new FlixerWasmLoader({ debug: false });
      await loader.initialize();
      
      const key = loader.getImgKey();
      console.log('Generated Key:', key);
      console.log('Key Length:', key.length, 'chars');
      console.log('\n✅ Success! Pure Node.js WASM loader is working.');
    } catch (e) {
      console.error('❌ Error:', e.message || e);
      if (e.stack) console.error(e.stack);
    }
  })();
}
