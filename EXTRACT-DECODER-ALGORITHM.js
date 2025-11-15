/**
 * EXTRACT THE ACTUAL DECODER ALGORITHM
 * Run the decoder in a controlled environment and log all operations
 */

const fs = require('fs');
const vm = require('vm');

console.log('🔍 Analyzing decoder algorithm...\n');

// Load the decoder script
const decoderScript = fs.readFileSync('decoder-script.js', 'utf8');

// Load a sample div content
const divContent = fs.readFileSync('div-content-raw.txt', 'utf8');
const divId = 'KJHidj7det';

console.log('📦 Div ID:', divId);
console.log('📦 Content length:', divContent.length);

// Create a sandbox that logs all operations
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
    }
  },
  atob: (str) => {
    operations.push({ op: 'atob', inputLength: str.length });
    return Buffer.from(str, 'base64').toString('binary');
  },
  btoa: (str) => {
    operations.push({ op: 'btoa', inputLength: str.length });
    return Buffer.from(str, 'binary').toString('base64');
  },
  String: {
    fromCharCode: (...args) => {
      if (operations.length < 100 || operations.length % 100 === 0) {
        operations.push({ op: 'fromCharCode', count: args.length });
      }
      return String.fromCharCode(...args);
    }
  },
  console: {
    log: (...args) => {
      operations.push({ op: 'console.log', args: args.map(a => String(a).substring(0, 100)) });
    }
  }
};

// Make window properties accessible
sandbox.window = new Proxy(sandbox, {
  get: (target, prop) => {
    if (prop === 'String') return sandbox.String;
    return target[prop];
  },
  set: (target, prop, value) => {
    operations.push({ op: 'window.set', prop, valueType: typeof value, valuePreview: String(value).substring(0, 100) });
    target[prop] = value;
    return true;
  }
});

try {
  console.log('⚙️  Executing decoder...\n');
  
  vm.createContext(sandbox);
  vm.runInContext(decoderScript, sandbox, { timeout: 10000 });
  
  console.log('✅ Decoder executed successfully!');
  console.log(`📊 Total operations: ${operations.length}`);
  
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
  console.log('\n🔑 Key operations:');
  operations.slice(0, 20).forEach((op, i) => {
    console.log(`  [${i}]`, JSON.stringify(op));
  });
  
  // Check if variable was created
  const result = sandbox[divId] || sandbox.window[divId];
  if (result) {
    console.log('\n✅ ✅ ✅ SUCCESS! Variable created!');
    console.log('M3U8 URL:', result);
  } else {
    console.log('\n❌ Variable not created');
    console.log('Available properties:', Object.keys(sandbox).filter(k => !['window', 'document', 'atob', 'btoa', 'String', 'console'].includes(k)));
  }
  
  // Save operations log
  fs.writeFileSync('decoder-operations.json', JSON.stringify(operations, null, 2));
  console.log('\n💾 Operations log saved to decoder-operations.json');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.log('\n📊 Operations before error:', operations.length);
  console.log('Last 10 operations:');
  operations.slice(-10).forEach((op, i) => {
    console.log(`  [${i}]`, JSON.stringify(op));
  });
}
