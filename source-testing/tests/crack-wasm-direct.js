/**
 * Crack WASM - Direct Node.js Analysis
 * 
 * Load the WASM directly in Node.js and trace its execution.
 * This will help us understand exactly how the decryption works.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function analyzeWasm() {
  console.log('=== Direct WASM Analysis ===\n');
  
  // Read the WASM file
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('WASM file not found. Please download it first.');
    console.log('You can get it from: https://flixer.sh/wasm/img_data_bg.wasm');
    return;
  }
  
  const wasmBuffer = fs.readFileSync(wasmPath);
  console.log(`WASM file size: ${wasmBuffer.length} bytes`);
  
  // Create mock browser environment
  const mockWindow = {
    document: {
      createElement: () => ({
        getContext: () => ({
          font: '',
          textBaseline: '',
          fillText: () => {},
        }),
        toDataURL: () => 'data:image/png;base64,mock',
        width: 0,
        height: 0,
      }),
      getElementsByTagName: () => ({ length: 0 }),
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      platform: 'Win32',
      language: 'en-US',
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
    performance: {
      now: () => Date.now(),
    },
    Date: {
      now: () => Date.now(),
    },
  };
  
  // Track memory operations
  const memoryOps = [];
  let memory = null;
  
  // Create imports
  const imports = {
    wbg: {
      __wbg_now_807e54c39636c349: () => Date.now(),
      __wbindgen_string_new: (ptr, len) => {
        const bytes = new Uint8Array(memory.buffer, ptr, len);
        return new TextDecoder().decode(bytes);
      },
      __wbg_now_d18023d54d4e5500: () => Date.now(),
      __wbg_navigator_1577371c070c8947: () => 1,
      __wbg_getElementsByTagName_f03d41ce466561e8: () => ({ length: 0 }),
      __wbg_length_347907d14a9ed873: () => 0,
      __wbg_colorDepth_59677c81c61d599a: () => 24,
      __wbg_platform_faf02c487289f206: () => {},
      __wbg_language_d871ec78ee8eec62: () => {},
      __wbg_new0_f788a2397c7ca929: () => new Date(),
      __wbg_getTimezoneOffset_6b5752021c499c47: () => new Date().getTimezoneOffset(),
      __wbg_localStorage_1406c99c39728187: () => 1,
      __wbg_getItem_17f98dee3b43fa7e: () => {},
      __wbg_random_3ad904d98382defe: () => Math.random(),
      __wbg_setItem_212ecc915942ab0a: () => {},
      __wbg_createElement_8c9931a732ee2fea: () => 1,
      __wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5: () => 1,
      __wbg_setwidth_c5fed9f5e7f0b406: () => {},
      __wbg_setheight_da683a33fa99843c: () => {},
      __wbg_getContext_e9cf379449413580: () => 1,
      __wbg_instanceof_CanvasRenderingContext2d_df82a4d3437bf1cc: () => 1,
      __wbg_settextBaseline_c28d2a6aa4ff9d9d: () => {},
      __wbg_toDataURL_eaec332e848fe935: () => {},
      __wbg_reject_b3fcf99063186ff7: () => 1,
      __wbg_new_23a2665fac83c611: () => 1,
      __wbindgen_object_clone_ref: () => 1,
      __wbindgen_is_undefined: () => 0,
      __wbg_newnoargs_105ed471475aaf50: () => 1,
      __wbg_call_672a4d21634d4a24: () => 1,
      __wbg_static_accessor_GLOBAL_88a902d13a557d07: () => 0,
      __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: () => 0,
      __wbg_static_accessor_WINDOW_5de37043a91a9c40: () => 1,
      __wbg_static_accessor_SELF_37c5d418e4bf5819: () => 0,
      __wbg_call_7cccdd69e0791ae2: () => 1,
      __wbindgen_throw: (ptr, len) => {
        const bytes = new Uint8Array(memory.buffer, ptr, len);
        throw new Error(new TextDecoder().decode(bytes));
      },
      __wbindgen_object_drop_ref: () => {},
      __wbindgen_cb_drop: () => 0,
      __wbg_then_44b73946d2fb3e7d: () => 1,
      __wbg_queueMicrotask_97d92b4fcc8a61c5: () => {},
      __wbg_queueMicrotask_d3219def82552485: () => 1,
      __wbindgen_is_function: () => 1,
      __wbg_resolve_4851785c9c5f573d: () => 1,
      __wbg_instanceof_Window_def73ea0955fc569: () => 1,
      __wbg_setfont_42a163ef83420b93: () => {},
      __wbg_fillText_2a0055d8531355d1: () => {},
      __wbg_userAgent_12e9d8e62297563f: () => {},
      __wbg_width_679079836447b4b7: () => 1920,
      __wbg_height_614ba187d8cae9ca: () => 1080,
      __wbg_document_d249400bd7bd996d: () => 1,
      __wbg_screen_8edf8699f70d98bc: () => 1,
      __wbg_performance_c185c0cdc2766575: () => 1,
      __wbindgen_closure_wrapper982: () => 1,
    },
  };
  
  try {
    // Compile and instantiate the WASM
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    const wasmInstance = await WebAssembly.instantiate(wasmModule, imports);
    
    memory = wasmInstance.exports.memory;
    
    console.log('WASM loaded successfully!');
    console.log('Exports:', Object.keys(wasmInstance.exports));
    
    // The WASM exports:
    // - get_img_key: generates an API key
    // - process_img_data: decrypts data
    // - memory: the linear memory
    // - __wbindgen_add_to_stack_pointer: stack management
    // - __wbindgen_export_1, 2, 3, 4, 5, 6: various exports
    
    // Try to call get_img_key
    console.log('\n=== Testing get_img_key ===');
    
    // This function returns a string, but we need to handle the wasm-bindgen protocol
    // The function signature is: () -> string
    // But internally it uses the stack pointer and returns (ptr, len)
    
    // For now, let's just analyze the memory layout
    console.log('Memory size:', memory.buffer.byteLength, 'bytes');
    
    // Look for interesting patterns in memory
    const memView = new Uint8Array(memory.buffer);
    
    // Search for AES S-box or other crypto constants
    // AES S-box starts with: 0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5
    const sboxStart = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5];
    
    for (let i = 0; i < memView.length - 8; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (memView[i + j] !== sboxStart[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`Found AES S-box at offset ${i}`);
      }
    }
    
    // Search for SHA256 initial values
    // H0 = 0x6a09e667 (little-endian: 67 e6 09 6a)
    const sha256H0 = [0x67, 0xe6, 0x09, 0x6a];
    
    for (let i = 0; i < memView.length - 4; i++) {
      let match = true;
      for (let j = 0; j < 4; j++) {
        if (memView[i + j] !== sha256H0[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`Found SHA256 H0 at offset ${i}`);
        // Print surrounding bytes
        console.log(`  Context: ${Buffer.from(memView.slice(i, i + 32)).toString('hex')}`);
      }
    }
    
  } catch (e) {
    console.error('Error loading WASM:', e.message);
    
    // The WASM requires browser APIs that we can't easily mock
    // Let's try a different approach - analyze the binary directly
    console.log('\n=== Analyzing WASM Binary Directly ===');
    
    // Look for interesting byte patterns in the WASM binary
    const wasmBytes = new Uint8Array(wasmBuffer);
    
    // Search for SHA256 constants in the binary
    // K[0] = 0x428a2f98 (big-endian)
    const sha256K0 = [0x42, 0x8a, 0x2f, 0x98];
    
    for (let i = 0; i < wasmBytes.length - 4; i++) {
      let match = true;
      for (let j = 0; j < 4; j++) {
        if (wasmBytes[i + j] !== sha256K0[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`Found SHA256 K[0] at binary offset ${i}`);
      }
    }
    
    // Search for base64 alphabet
    const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const base64Bytes = Buffer.from(base64Alphabet);
    
    for (let i = 0; i < wasmBytes.length - 64; i++) {
      let match = true;
      for (let j = 0; j < 64; j++) {
        if (wasmBytes[i + j] !== base64Bytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`Found base64 alphabet at binary offset ${i}`);
      }
    }
  }
}

analyzeWasm().catch(console.error);
