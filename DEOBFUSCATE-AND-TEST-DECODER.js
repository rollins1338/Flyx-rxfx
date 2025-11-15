/**
 * DEOBFUSCATE AND TEST THE DECODER
 * Run the decoder with our sample data and trace the execution
 */

const fs = require('fs');
const vm = require('vm');
const zlib = require('zlib');

console.log('🔥 DECODER DEOBFUSCATION AND TESTING\n');

// Load the decoder script
const decoderScript = fs.readFileSync('decoder-script-1.js', 'utf8');
const divContent = fs.readFileSync('hidden-div-content.txt', 'utf8');
const divId = fs.readFileSync('hidden-div-id.txt', 'utf8').trim();

console.log('📦 Loaded:');
console.log('  Decoder script:', decoderScript.length, 'bytes');
console.log('  Div content:', divContent.length, 'chars');
console.log('  Div ID:', divId);

// Create a sandbox with hooks
const operations = [];
const sandbox = {
  window: {},
  document: {
    getElementById: (id) => {
      operations.push({ op: 'getElementById', id });
      if (id === divId) {
        return {
          innerHTML: divContent,
          textContent: divContent,
          id: divId
        };
      }
      return null;
    },
    createElement: (tag) => {
      return {
        tagName: tag,
        setAttribute: () => {},
        getAttribute: () => null
      };
    },
    querySelectorAll: () => [],
    querySelector: () => null
  },
  atob: (str) => {
    operations.push({ 
      op: 'atob', 
      inputLength: str.length,
      inputPreview: str.substring(0, 50)
    });
    return Buffer.from(str, 'base64').toString('binary');
  },
  btoa: (str) => {
    operations.push({ op: 'btoa', inputLength: str.length });
    return Buffer.from(str, 'binary').toString('base64');
  },
  String: {
    fromCharCode: (...args) => {
      if (operations.length < 100 || operations.length % 100 === 0) {
        operations.push({ 
          op: 'fromCharCode', 
          count: args.length,
          firstFew: args.slice(0, 5)
        });
      }
      return String.fromCharCode(...args);
    }
  },
  Array: Array,
  Object: Object,
  Math: Math,
  Date: Date,
  RegExp: RegExp,
  Error: Error,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  decodeURI: decodeURI,
  decodeURIComponent: decodeURIComponent,
  encodeURI: encodeURI,
  encodeURIComponent: encodeURIComponent,
  escape: escape,
  unescape: unescape,
  eval: eval,
  Function: Function,
  console: {
    log: (...args) => {
      // Capture console.log calls
      const msg = args.map(a => String(a).substring(0, 100)).join(' ');
      operations.push({ op: 'console.log', message: msg });
    },
    error: () => {},
    warn: () => {}
  },
  setTimeout: (fn, delay) => {
    // Execute immediately
    if (typeof fn === 'function') fn();
  },
  setInterval: () => {},
  clearTimeout: () => {},
  clearInterval: () => {},
  location: {
    href: 'https://cloudnestra.com/prorcp/test',
    hostname: 'cloudnestra.com',
    protocol: 'https:',
    pathname: '/prorcp/test'
  },
  navigator: {
    userAgent: 'Mozilla/5.0'
  }
};

// Make window properties accessible
const windowHandler = {
  get: (target, prop) => {
    if (prop === 'String') return sandbox.String;
    if (prop === 'document') return sandbox.document;
    if (prop === 'atob') return sandbox.atob;
    if (prop === 'btoa') return sandbox.btoa;
    if (prop === 'console') return sandbox.console;
    return target[prop];
  },
  set: (target, prop, value) => {
    operations.push({ 
      op: 'window.set', 
      prop, 
      valueType: typeof value,
      valuePreview: String(value).substring(0, 100),
      isM3U8: typeof value === 'string' && (value.includes('http') || value.includes('.m3u8'))
    });
    
    if (typeof value === 'string' && (value.includes('http') || value.includes('.m3u8'))) {
      console.log('\n🎯 FOUND M3U8 URL!');
      console.log('Property:', prop);
      console.log('Value:', value);
    }
    
    target[prop] = value;
    return true;
  }
};

sandbox.window = new Proxy(sandbox, windowHandler);

try {
  console.log('\n⚙️  Executing decoder...\n');
  
  const context = vm.createContext(sandbox);
  vm.runInContext(decoderScript, context, { 
    timeout: 10000,
    filename: 'decoder-script-1.js'
  });
  
  console.log('\n✅ Decoder executed successfully!');
  console.log(`📊 Total operations: ${operations.length}`);
  
  // Check if variable was created
  const result = sandbox[divId] || sandbox.window[divId];
  if (result) {
    console.log('\n✅ ✅ ✅ SUCCESS! Variable created!');
    console.log('M3U8 URL:', result);
    
    // Save the result
    fs.writeFileSync('decoded-m3u8-url.txt', result);
    console.log('\n💾 Saved to decoded-m3u8-url.txt');
  } else {
    console.log('\n❌ Variable not created');
    console.log('Available properties:', Object.keys(sandbox).filter(k => 
      !['window', 'document', 'atob', 'btoa', 'String', 'console'].includes(k)
    ));
  }
  
  // Analyze operations
  console.log('\n📈 Operation breakdown:');
  const opCounts = {};
  operations.forEach(op => {
    opCounts[op.op] = (opCounts[op.op] || 0) + 1;
  });
  Object.entries(opCounts).forEach(([op, count]) => {
    console.log(`  ${op}: ${count}`);
  });
  
  // Show key operations
  console.log('\n🔑 Key operations (first 20):');
  operations.slice(0, 20).forEach((op, i) => {
    console.log(`  [${i + 1}]`, JSON.stringify(op).substring(0, 150));
  });
  
  // Show window.set operations
  const windowSets = operations.filter(op => op.op === 'window.set');
  if (windowSets.length > 0) {
    console.log('\n🪟 Window property assignments:');
    windowSets.forEach((op, i) => {
      console.log(`  [${i + 1}] ${op.prop} = ${op.valuePreview}${op.isM3U8 ? ' ⭐ M3U8!' : ''}`);
    });
  }
  
  // Save operations log
  fs.writeFileSync('decoder-operations.json', JSON.stringify(operations, null, 2));
  console.log('\n💾 Operations log saved to decoder-operations.json');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.log('\n📊 Operations before error:', operations.length);
  console.log('Last 10 operations:');
  operations.slice(-10).forEach((op, i) => {
    console.log(`  [${i + 1}]`, JSON.stringify(op).substring(0, 150));
  });
}
