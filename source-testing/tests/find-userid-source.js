/**
 * Find where user_id comes from in SmashyStream
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== FINDING USER_ID SOURCE ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Intercept all storage operations
    await page.evaluateOnNewDocument(() => {
      window.__storageOps = [];
      
      // Hook localStorage
      const originalSetItem = localStorage.setItem.bind(localStorage);
      const originalGetItem = localStorage.getItem.bind(localStorage);
      
      localStorage.setItem = function(key, value) {
        window.__storageOps.push({ type: 'localStorage.setItem', key, value, stack: new Error().stack });
        return originalSetItem(key, value);
      };
      
      localStorage.getItem = function(key) {
        const value = originalGetItem(key);
        window.__storageOps.push({ type: 'localStorage.getItem', key, value });
        return value;
      };
      
      // Hook sessionStorage
      const originalSessionSetItem = sessionStorage.setItem.bind(sessionStorage);
      const originalSessionGetItem = sessionStorage.getItem.bind(sessionStorage);
      
      sessionStorage.setItem = function(key, value) {
        window.__storageOps.push({ type: 'sessionStorage.setItem', key, value });
        return originalSessionSetItem(key, value);
      };
      
      sessionStorage.getItem = function(key) {
        const value = originalSessionGetItem(key);
        window.__storageOps.push({ type: 'sessionStorage.getItem', key, value });
        return value;
      };
      
      // Hook document.cookie
      const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      Object.defineProperty(document, 'cookie', {
        get: function() {
          const value = originalCookieDescriptor.get.call(this);
          window.__storageOps.push({ type: 'cookie.get', value: value.substring(0, 200) });
          return value;
        },
        set: function(value) {
          window.__storageOps.push({ type: 'cookie.set', value });
          return originalCookieDescriptor.set.call(this, value);
        }
      });
    });
    
    // Capture all requests
    const requests = [];
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('user_id') || url.includes('smashystream')) {
        requests.push({
          url,
          headers: request.headers()
        });
      }
      request.continue();
    });
    
    console.log('Loading player...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Get storage operations
    const storageOps = await page.evaluate(() => window.__storageOps || []);
    
    console.log('\n=== STORAGE OPERATIONS ===\n');
    const userIdOps = storageOps.filter(op => 
      op.key?.includes('user') || 
      op.value?.includes('user') ||
      op.key?.includes('id') ||
      op.value?.includes('_')
    );
    
    for (const op of userIdOps.slice(0, 20)) {
      console.log(`${op.type}: ${op.key} = ${op.value?.substring(0, 100)}`);
    }
    
    // Check all storage
    const allStorage = await page.evaluate(() => {
      const result = {
        localStorage: {},
        sessionStorage: {},
        cookies: document.cookie
      };
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        result.localStorage[key] = localStorage.getItem(key);
      }
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        result.sessionStorage[key] = sessionStorage.getItem(key);
      }
      
      return result;
    });
    
    console.log('\n=== ALL STORAGE ===\n');
    console.log('localStorage:', JSON.stringify(allStorage.localStorage, null, 2));
    console.log('sessionStorage:', JSON.stringify(allStorage.sessionStorage, null, 2));
    console.log('cookies:', allStorage.cookies);
    
    // Look for user_id in window object
    const windowVars = await page.evaluate(() => {
      const result = {};
      const interesting = ['user_id', 'userId', 'USER_ID', 'token', 'Token'];
      
      for (const key of Object.keys(window)) {
        try {
          const val = window[key];
          if (typeof val === 'string' && val.includes('_') && val.length > 30) {
            result[key] = val;
          }
          if (typeof val === 'object' && val !== null) {
            const str = JSON.stringify(val);
            if (str && str.length < 10000) {
              for (const term of interesting) {
                if (str.includes(term)) {
                  result[key] = str.substring(0, 500);
                  break;
                }
              }
            }
          }
        } catch (e) {}
      }
      
      return result;
    });
    
    console.log('\n=== INTERESTING WINDOW VARS ===\n');
    for (const [key, value] of Object.entries(windowVars)) {
      console.log(`${key}: ${value}`);
    }
    
    // Check React state
    const reactState = await page.evaluate(() => {
      // Try to find React root
      const root = document.getElementById('root');
      if (!root) return null;
      
      // React 18 uses __reactContainer
      const reactKey = Object.keys(root).find(k => k.startsWith('__react'));
      if (!reactKey) return null;
      
      try {
        const fiber = root[reactKey];
        // Walk the fiber tree to find state
        const states = [];
        
        function walkFiber(node, depth = 0) {
          if (!node || depth > 10) return;
          
          if (node.memoizedState) {
            const stateStr = JSON.stringify(node.memoizedState);
            if (stateStr && stateStr.includes('user_id')) {
              states.push(stateStr.substring(0, 500));
            }
          }
          
          if (node.child) walkFiber(node.child, depth + 1);
          if (node.sibling) walkFiber(node.sibling, depth + 1);
        }
        
        walkFiber(fiber);
        return states;
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('\n=== REACT STATE ===\n');
    console.log(JSON.stringify(reactState, null, 2));
    
    // Look at the actual API request that was made
    console.log('\n=== API REQUESTS ===\n');
    for (const req of requests.filter(r => r.url.includes('api.smashystream'))) {
      console.log(`URL: ${req.url}`);
      
      // Parse the URL to get user_id
      try {
        const urlObj = new URL(req.url);
        const userId = urlObj.searchParams.get('user_id');
        const token = urlObj.searchParams.get('token');
        
        if (userId) {
          console.log(`  user_id: ${userId}`);
          const parts = userId.split('_');
          console.log(`    prefix: ${parts[0]}`);
          console.log(`    hash: ${parts[1]}`);
        }
        if (token) {
          console.log(`  token: ${token}`);
          const parts = token.split('.');
          console.log(`    part1: ${parts[0]} (${parts[0].length} chars)`);
          console.log(`    part2: ${parts[1]} (${parts[1].length} chars)`);
          console.log(`    timestamp: ${parts[2]}`);
          
          // Check if token part1 contains user_id prefix
          if (userId) {
            const userPrefix = userId.split('_')[0];
            if (parts[0].includes(userPrefix)) {
              console.log(`    *** TOKEN CONTAINS USER_ID PREFIX! ***`);
            }
          }
        }
      } catch (e) {}
      console.log('---');
    }
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
