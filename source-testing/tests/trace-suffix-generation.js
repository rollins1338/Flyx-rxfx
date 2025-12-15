/**
 * Trace where the suffix "TAxcjBGffNfvY" is generated
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== TRACING SUFFIX GENERATION ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Hook string concatenation and search for the suffix
    await page.evaluateOnNewDocument(() => {
      window.__stringOps = [];
      const suffix = 'TAxcjBGffNfvY';
      
      // Hook String.prototype.concat
      const originalConcat = String.prototype.concat;
      String.prototype.concat = function(...args) {
        const result = originalConcat.apply(this, args);
        if (result.includes(suffix)) {
          window.__stringOps.push({
            type: 'concat',
            this: this.substring(0, 50),
            args: args.map(a => String(a).substring(0, 50)),
            result: result.substring(0, 100),
            stack: new Error().stack.split('\n').slice(1, 5).join('\n')
          });
        }
        return result;
      };
      
      // We can't easily hook + operator, but we can hook the token function
      const checkModule = setInterval(() => {
        if (typeof Module !== 'undefined' && Module.cwrap) {
          clearInterval(checkModule);
          
          const originalCwrap = Module.cwrap;
          Module.cwrap = function(name, returnType, argTypes) {
            const wrappedFunc = originalCwrap.call(this, name, returnType, argTypes);
            
            if (name === 'gewe_town') {
              return function(input) {
                window.__stringOps.push({
                  type: 'gewe_town_input',
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
    
    // Get string operations
    const ops = await page.evaluate(() => window.__stringOps || []);
    
    console.log('\n=== STRING OPERATIONS ===\n');
    for (const op of ops) {
      console.log(`Type: ${op.type}`);
      if (op.input) console.log(`  Input: ${op.input}`);
      if (op.this) console.log(`  This: ${op.this}`);
      if (op.args) console.log(`  Args: ${JSON.stringify(op.args)}`);
      if (op.result) console.log(`  Result: ${op.result}`);
      console.log(`  Stack:\n${op.stack}`);
      console.log('---');
    }
    
    // Now let's look at the actual code that generates the input
    // The stack trace shows it comes from PlayerContainer
    console.log('\n=== ANALYZING PLAYERCONTAINER CODE ===\n');
    
    // Get the code around position 5581 in PlayerContainer
    const codeAnalysis = await page.evaluate(async () => {
      // Fetch the PlayerContainer script
      const response = await fetch('/assets/PlayerContainer-DVI6QGKy.js');
      const code = await response.text();
      
      // Search for patterns that might generate the suffix
      const patterns = [
        /origin[^;]{0,100}/gi,
        /location\.origin/gi,
        /window\.location/gi,
        /TAxcjBGffNfvY/gi,
        /tokenFunc\([^)]+\)/gi
      ];
      
      const matches = {};
      for (const pattern of patterns) {
        const found = code.match(pattern);
        if (found) {
          matches[pattern.source] = found.slice(0, 3);
        }
      }
      
      // Look for the specific code around position 5581
      const context5581 = code.substring(5500, 5700);
      
      return {
        codeLength: code.length,
        matches,
        context5581
      };
    });
    
    console.log('Code analysis:', JSON.stringify(codeAnalysis, null, 2));
    
    // The suffix might be decoded from an obfuscated string
    // Let's check if it's in the l array (the obfuscated strings)
    console.log('\n=== CHECKING OBFUSCATED STRINGS ===\n');
    
    const obfuscatedCheck = await page.evaluate(() => {
      // The suffix might be decoded from the l array
      // Let's search for it in all strings on the page
      const suffix = 'TAxcjBGffNfvY';
      const found = [];
      
      // Check all string properties in window
      function searchObject(obj, path, depth = 0) {
        if (depth > 3) return;
        if (!obj || typeof obj !== 'object') return;
        
        try {
          for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (typeof value === 'string' && value.includes(suffix)) {
              found.push({ path: path + '.' + key, value: value.substring(0, 100) });
            } else if (typeof value === 'object' && value !== null) {
              searchObject(value, path + '.' + key, depth + 1);
            }
          }
        } catch (e) {}
      }
      
      // Search in common places
      searchObject(window, 'window');
      
      return found;
    });
    
    console.log('Found suffix in:', JSON.stringify(obfuscatedCheck, null, 2));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
