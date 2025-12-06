
// Node.js test to run parts of the obfuscated code
const vm = require('vm');
const fs = require('fs');

// Create a mock browser environment
const mockWindow = {
  __PAGE_DATA: "3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4",
  document: {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {} }),
    body: { appendChild: () => {} }
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
  },
  location: { href: 'https://rapidshare.cc/e/test' },
  setTimeout: setTimeout,
  setInterval: setInterval,
  console: console,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  Math: Math,
  JSON: JSON,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  btoa: (str) => Buffer.from(str, 'binary').toString('base64')
};

// Add self-references
mockWindow.window = mockWindow;
mockWindow.self = mockWindow;
mockWindow.top = mockWindow;
mockWindow.globalThis = mockWindow;

// Read the app code
const appCode = fs.readFileSync('rapidshare-app.js', 'utf8');

// Create a context
const context = vm.createContext(mockWindow);

// Try to run the code
try {
  console.log('Running obfuscated code...');
  vm.runInContext(appCode, context, { timeout: 5000 });
  console.log('Code executed successfully');
  
  // Check what was created
  console.log('\nGlobal objects created:');
  Object.keys(context).filter(k => !Object.keys(mockWindow).includes(k)).forEach(k => {
    console.log('  ' + k + ':', typeof context[k]);
  });
} catch (e) {
  console.log('Error:', e.message);
  console.log('Stack:', e.stack);
}
