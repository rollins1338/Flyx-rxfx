/**
 * Find where the input string "TAxcjBGffNfvY" comes from
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== FINDING INPUT SOURCE ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Track all random string generation
    await page.evaluateOnNewDocument(() => {
      window.__randomCalls = [];
      window.__tokenInputs = [];
      
      // Hook Math.random
      const originalRandom = Math.random;
      Math.random = function() {
        const result = originalRandom.call(this);
        window.__randomCalls.push({
          result,
          stack: new Error().stack.split('\n').slice(1, 4).join('\n')
        });
        return result;
      };
      
      // Hook crypto.getRandomValues
      const originalGetRandomValues = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = function(array) {
        const result = originalGetRandomValues(array);
        window.__randomCalls.push({
          type: 'crypto',
          length: array.length,
          stack: new Error().stack.split('\n').slice(1, 4).join('\n')
        });
        return result;
      };
      
      // Hook Module.cwrap when available
      const checkModule = setInterval(() => {
        if (typeof Module !== 'undefined' && Module.cwrap) {
          clearInterval(checkModule);
          
          const originalCwrap = Module.cwrap;
          Module.cwrap = function(name, returnType, argTypes) {
            const wrappedFunc = originalCwrap.call(this, name, returnType, argTypes);
            
            if (name === 'gewe_town') {
              return function(input) {
                window.__tokenInputs.push({
                  input,
                  stack: new Error().stack
                });
                return wrappedFunc(input);
              };
            }
            return wrappedFunc;
          };
        }
      }, 50);
    });
    
    console.log('Loading player...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Get token inputs
    const tokenInputs = await page.evaluate(() => window.__tokenInputs || []);
    
    console.log('\n=== TOKEN INPUTS ===\n');
    for (const input of tokenInputs) {
      console.log('Input:', input.input);
      console.log('Stack:');
      console.log(input.stack);
      console.log('---');
    }
    
    // The input is: https://player.smashystream.com + TAxcjBGffNfvY
    // Let's see if TAxcjBGffNfvY is consistent or random
    
    console.log('\n=== ANALYZING INPUT SUFFIX ===\n');
    
    if (tokenInputs.length > 0) {
      const input = tokenInputs[0].input;
      const origin = 'https://player.smashystream.com';
      const suffix = input.substring(origin.length);
      
      console.log('Full input:', input);
      console.log('Origin:', origin);
      console.log('Suffix:', suffix);
      console.log('Suffix length:', suffix.length);
      
      // Check if suffix is base64-like
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(suffix);
      console.log('Is base64-like:', isBase64);
      
      // Check if suffix is alphanumeric
      const isAlphanumeric = /^[A-Za-z0-9]+$/.test(suffix);
      console.log('Is alphanumeric:', isAlphanumeric);
    }
    
    // Now let's trace where the suffix comes from
    console.log('\n=== TRACING SUFFIX ORIGIN ===\n');
    
    // Reload and trace more carefully
    const page2 = await browser.newPage();
    
    await page2.evaluateOnNewDocument(() => {
      window.__stringConcats = [];
      
      // We need to find where origin + suffix is created
      // This is tricky because string concatenation is hard to hook
      
      // Hook Module.cwrap
      const checkModule = setInterval(() => {
        if (typeof Module !== 'undefined' && Module.cwrap) {
          clearInterval(checkModule);
          
          const originalCwrap = Module.cwrap;
          Module.cwrap = function(name, returnType, argTypes) {
            const wrappedFunc = originalCwrap.call(this, name, returnType, argTypes);
            
            if (name === 'gewe_town') {
              return function(input) {
                // Log the full stack trace
                console.log('[TOKEN INPUT]', input);
                console.log('[STACK]', new Error().stack);
                return wrappedFunc(input);
              };
            }
            return wrappedFunc;
          };
        }
      }, 50);
    });
    
    // Enable console logging
    page2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[TOKEN') || text.includes('[STACK]')) {
        console.log(text);
      }
    });
    
    await page2.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if the suffix is stored somewhere
    console.log('\n=== CHECKING STORAGE FOR SUFFIX ===\n');
    
    const storageCheck = await page2.evaluate(() => {
      const result = {
        localStorage: {},
        sessionStorage: {}
      };
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (value && value.length < 100) {
          result.localStorage[key] = value;
        }
      }
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        if (value && value.length < 100) {
          result.sessionStorage[key] = value;
        }
      }
      
      return result;
    });
    
    console.log('Storage:', JSON.stringify(storageCheck, null, 2));
    
    await page2.close();
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
