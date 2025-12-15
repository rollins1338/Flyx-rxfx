/**
 * Find the constant suffix used in token generation
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== FINDING CONSTANT SUFFIX ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture the token input
    await page.evaluateOnNewDocument(() => {
      window.__tokenInput = null;
      
      const checkModule = setInterval(() => {
        if (typeof Module !== 'undefined' && Module.cwrap) {
          clearInterval(checkModule);
          
          const originalCwrap = Module.cwrap;
          Module.cwrap = function(name, returnType, argTypes) {
            const wrappedFunc = originalCwrap.call(this, name, returnType, argTypes);
            
            if (name === 'gewe_town') {
              return function(input) {
                window.__tokenInput = input;
                return wrappedFunc(input);
              };
            }
            return wrappedFunc;
          };
        }
      }, 50);
    });
    
    // Load page multiple times to see if suffix changes
    const suffixes = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`Loading page (attempt ${i + 1})...`);
      
      await page.goto('https://player.smashystream.com/movie/155', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      await new Promise(r => setTimeout(r, 2000));
      
      const input = await page.evaluate(() => window.__tokenInput);
      if (input) {
        const origin = 'https://player.smashystream.com';
        const suffix = input.substring(origin.length);
        suffixes.push(suffix);
        console.log(`  Input: ${input}`);
        console.log(`  Suffix: ${suffix}`);
      }
      
      // Clear for next iteration
      await page.evaluate(() => { window.__tokenInput = null; });
    }
    
    console.log('\n=== SUFFIX ANALYSIS ===\n');
    console.log('Suffixes collected:', suffixes);
    
    const uniqueSuffixes = [...new Set(suffixes)];
    console.log('Unique suffixes:', uniqueSuffixes.length);
    
    if (uniqueSuffixes.length === 1) {
      console.log('\n*** SUFFIX IS CONSTANT! ***');
      console.log('Suffix:', uniqueSuffixes[0]);
    } else {
      console.log('\n*** SUFFIX VARIES ***');
    }
    
    // Now let's find where this suffix comes from
    console.log('\n=== SEARCHING FOR SUFFIX SOURCE ===\n');
    
    // Check if it's in any script
    const scriptContents = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      const contents = [];
      for (const script of scripts) {
        if (script.src) {
          contents.push({ type: 'external', src: script.src });
        } else if (script.textContent) {
          contents.push({ type: 'inline', content: script.textContent.substring(0, 500) });
        }
      }
      return contents;
    });
    
    console.log('Scripts on page:', scriptContents.length);
    
    // Check if suffix is in localStorage
    const storage = await page.evaluate((suffix) => {
      const result = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (value && value.includes(suffix)) {
          result[key] = value;
        }
      }
      return result;
    }, suffixes[0] || '');
    
    console.log('Storage containing suffix:', JSON.stringify(storage, null, 2));
    
    // The suffix might be generated from a hash or constant
    // Let's check if it's related to the user_id
    const userIdData = await page.evaluate(() => {
      const data = localStorage.getItem('userIdData');
      return data ? JSON.parse(data) : null;
    });
    
    console.log('\nUser ID data:', JSON.stringify(userIdData, null, 2));
    
    if (userIdData && suffixes[0]) {
      // Check if suffix is derived from user_id
      const userId = userIdData.userId;
      console.log('\nChecking if suffix is related to user_id...');
      console.log('User ID:', userId);
      console.log('Suffix:', suffixes[0]);
      
      // Check if any part of user_id appears in suffix
      const userIdParts = userId.split('_');
      for (const part of userIdParts) {
        if (suffixes[0].includes(part)) {
          console.log(`  Found "${part}" in suffix!`);
        }
      }
    }
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
