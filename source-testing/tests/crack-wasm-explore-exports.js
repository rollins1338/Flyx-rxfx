/**
 * Explore WASM module exports to find memory access
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function exploreExports() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  await page.evaluateOnNewDocument((ts) => {
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    // Intercept WASM instantiation to capture the instance
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      window.__wasmResult = result;
      return result;
    };
    
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    if (originalInstantiateStreaming) {
      WebAssembly.instantiateStreaming = async function(source, importObject) {
        const result = await originalInstantiateStreaming.call(this, source, importObject);
        window.__wasmResult = result;
        return result;
      };
    }
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    // Explore the wasm object
    const wasmKeys = Object.keys(wasm);
    const wasmProps = {};
    for (const k of wasmKeys) {
      const v = wasm[k];
      wasmProps[k] = typeof v === 'function' ? 'function' : typeof v;
    }
    
    // Check for memory in various places
    let memoryInfo = null;
    
    // Try wasm.memory
    if (wasm.memory) {
      memoryInfo = { source: 'wasm.memory', type: typeof wasm.memory };
      if (wasm.memory.buffer) {
        memoryInfo.bufferSize = wasm.memory.buffer.byteLength;
      }
    }
    
    // Try __wasmResult
    if (window.__wasmResult) {
      const instance = window.__wasmResult.instance || window.__wasmResult;
      if (instance.exports) {
        const exportKeys = Object.keys(instance.exports);
        memoryInfo = memoryInfo || {};
        memoryInfo.exports = exportKeys;
        
        if (instance.exports.memory) {
          memoryInfo.memoryFromExports = true;
          memoryInfo.memoryBufferSize = instance.exports.memory.buffer.byteLength;
          
          // Dump memory around key
          const buffer = new Uint8Array(instance.exports.memory.buffer);
          
          // Convert key to bytes
          const keyBytes = [];
          for (let i = 0; i < key.length; i += 2) {
            keyBytes.push(parseInt(key.slice(i, i + 2), 16));
          }
          
          // Find key in memory
          const keyLocations = [];
          for (let i = 0; i < buffer.length - 32; i++) {
            let found = true;
            for (let j = 0; j < 32; j++) {
              if (buffer[i + j] !== keyBytes[j]) {
                found = false;
                break;
              }
            }
            if (found) {
              keyLocations.push(i);
            }
          }
          
          memoryInfo.keyLocations = keyLocations;
          
          // Dump memory around first key location
          if (keyLocations.length > 0) {
            const loc = keyLocations[0];
            const start = Math.max(0, loc - 512);
            const end = Math.min(buffer.length, loc + 544);
            memoryInfo.memoryDump = {
              location: loc,
              offset: loc - start,
              data: Array.from(buffer.slice(start, end)).map(b => b.toString(16).padStart(2, '0')).join(''),
            };
          }
          
          // Search for fpHash
          const fpHashHex = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
          const fpHashBytes = [];
          for (let i = 0; i < fpHashHex.length; i += 2) {
            fpHashBytes.push(parseInt(fpHashHex.slice(i, i + 2), 16));
          }
          
          const fpHashLocations = [];
          for (let i = 0; i < buffer.length - 32; i++) {
            let found = true;
            for (let j = 0; j < 32; j++) {
              if (buffer[i + j] !== fpHashBytes[j]) {
                found = false;
                break;
              }
            }
            if (found) {
              fpHashLocations.push(i);
            }
          }
          memoryInfo.fpHashLocations = fpHashLocations;
          
          // Search for XOR constant
          const xorHex = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
          const xorBytes = [];
          for (let i = 0; i < xorHex.length; i += 2) {
            xorBytes.push(parseInt(xorHex.slice(i, i + 2), 16));
          }
          
          const xorLocations = [];
          for (let i = 0; i < buffer.length - 32; i++) {
            let found = true;
            for (let j = 0; j < 32; j++) {
              if (buffer[i + j] !== xorBytes[j]) {
                found = false;
                break;
              }
            }
            if (found) {
              xorLocations.push(i);
            }
          }
          memoryInfo.xorLocations = xorLocations;
        }
      }
    }
    
    return {
      key,
      sessionId,
      wasmProps,
      memoryInfo,
    };
  });
  
  await browser.close();
  
  console.log('=== WASM Export Exploration ===\n');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  
  console.log('\n--- WASM Object Properties ---');
  console.log(JSON.stringify(result.wasmProps, null, 2));
  
  console.log('\n--- Memory Info ---');
  if (result.memoryInfo) {
    console.log('Memory buffer size:', result.memoryInfo.memoryBufferSize);
    console.log('Key locations:', result.memoryInfo.keyLocations);
    console.log('fpHash locations:', result.memoryInfo.fpHashLocations);
    console.log('XOR constant locations:', result.memoryInfo.xorLocations);
    
    if (result.memoryInfo.memoryDump) {
      console.log('\n--- Memory Dump Around Key ---');
      const dump = result.memoryInfo.memoryDump;
      console.log('Key at offset:', dump.location);
      
      const data = Buffer.from(dump.data, 'hex');
      const keyStart = dump.offset;
      const keyBytes = Buffer.from(result.key, 'hex');
      const fpHashBytes = Buffer.from('54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e', 'hex');
      const xorBytes = Buffer.from('1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc', 'hex');
      
      // Search for XOR constant in the dump
      console.log('\nSearching for XOR relationship in memory dump...');
      
      for (let i = 0; i <= data.length - 32; i++) {
        const candidate = data.slice(i, i + 32);
        
        // Check if candidate XOR key = fpHash
        const xored = Buffer.alloc(32);
        for (let j = 0; j < 32; j++) {
          xored[j] = candidate[j] ^ keyBytes[j];
        }
        
        if (xored.equals(fpHashBytes)) {
          console.log(`FOUND! XOR constant at dump offset ${i} (absolute: ${dump.location - dump.offset + i})`);
          console.log('XOR constant:', candidate.toString('hex'));
        }
        
        // Check if candidate = fpHash
        if (candidate.equals(fpHashBytes)) {
          console.log(`FOUND fpHash at dump offset ${i}`);
        }
        
        // Check if candidate = known xorConst
        if (candidate.equals(xorBytes)) {
          console.log(`FOUND known XOR constant at dump offset ${i}`);
        }
      }
      
      // Print the 64 bytes before and after the key
      console.log('\n64 bytes before key:');
      const before = data.slice(Math.max(0, keyStart - 64), keyStart);
      console.log(before.toString('hex'));
      
      console.log('\nKey (32 bytes):');
      console.log(data.slice(keyStart, keyStart + 32).toString('hex'));
      
      console.log('\n64 bytes after key:');
      const after = data.slice(keyStart + 32, keyStart + 96);
      console.log(after.toString('hex'));
    }
  } else {
    console.log('Could not access memory');
  }
  
  return result;
}

exploreExports().catch(console.error);
