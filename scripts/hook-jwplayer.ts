/**
 * Hook JWPlayer setup to capture the decrypted video source
 * This injects a script before the page loads to intercept the setup call
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function hookJwplayer(embedUrl: string): Promise<any> {
  console.log('=== Hooking JWPlayer Setup ===\n');
  console.log('Embed URL:', embedUrl);
  
  const browser = await puppeteer.launch({
    headless: false, // Need visible browser to pass Cloudflare
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  let capturedConfig: any = null;
  
  try {
    const page = await browser.newPage();
    
    // Inject hook before any scripts run
    await page.evaluateOnNewDocument(() => {
      // Store the original jwplayer function
      const originalJwplayer = (window as any).jwplayer;
      
      // Create a proxy to intercept setup calls
      (window as any).__capturedConfig = null;
      
      // Override jwplayer when it's defined
      Object.defineProperty(window, 'jwplayer', {
        get: function() {
          return function(this: any, ...args: any[]) {
            const player = originalJwplayer ? originalJwplayer.apply(this, args) : null;
            
            if (player && player.setup) {
              const originalSetup = player.setup;
              player.setup = function(config: any) {
                console.log('JWPlayer setup intercepted!', config);
                (window as any).__capturedConfig = config;
                
                // Also log to a global variable we can read
                (window as any).__jwplayerConfig = JSON.stringify(config);
                
                return originalSetup.call(this, config);
              };
            }
            
            return player;
          };
        },
        set: function(val) {
          // When jwplayer is set, wrap it
          const wrapped = function(this: any, ...args: any[]) {
            const player = val.apply(this, args);
            
            if (player && player.setup) {
              const originalSetup = player.setup;
              player.setup = function(config: any) {
                console.log('JWPlayer setup intercepted!', config);
                (window as any).__capturedConfig = config;
                (window as any).__jwplayerConfig = JSON.stringify(config);
                return originalSetup.call(this, config);
              };
            }
            
            return player;
          };
          
          // Copy properties
          Object.keys(val).forEach(key => {
            (wrapped as any)[key] = val[key];
          });
          
          Object.defineProperty(window, 'jwplayer', {
            value: wrapped,
            writable: true,
            configurable: true
          });
        },
        configurable: true
      });
    });
    
    // Listen for console messages
    page.on('console', (msg: any) => {
      const text = msg.text();
      if (text.includes('JWPlayer') || text.includes('setup') || text.includes('file')) {
        console.log('Console:', text);
      }
    });
    
    // Navigate to the embed page
    console.log('\nNavigating to embed page...');
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for Cloudflare challenge
    console.log('Waiting for Cloudflare challenge...');
    await new Promise(r => setTimeout(r, 15000));
    
    // Try to get the captured config
    capturedConfig = await page.evaluate(() => {
      return (window as any).__jwplayerConfig || (window as any).__capturedConfig;
    });
    
    if (capturedConfig) {
      console.log('\n✓ Captured JWPlayer config!');
      if (typeof capturedConfig === 'string') {
        capturedConfig = JSON.parse(capturedConfig);
      }
      console.log(JSON.stringify(capturedConfig, null, 2));
    } else {
      console.log('\n❌ Could not capture config');
      
      // Try to get it from the player directly
      const playerConfig = await page.evaluate(() => {
        try {
          const player = (window as any).jwplayer();
          if (player) {
            return {
              playlist: player.getPlaylist(),
              config: player.getConfig()
            };
          }
        } catch (e) {
          return null;
        }
      });
      
      if (playerConfig) {
        console.log('\nGot config from player:');
        console.log(JSON.stringify(playerConfig, null, 2));
        capturedConfig = playerConfig;
      }
    }
    
    // Keep browser open for manual inspection
    console.log('\nKeeping browser open for 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));
    
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
  
  return capturedConfig;
}

// Test with Cyberpunk embed
const EMBED_URL = 'https://rapidshare.cc/e/kJCuIjiwWSyJcOLzFLpK6xfpCQ';

hookJwplayer(EMBED_URL).then(config => {
  if (config) {
    console.log('\n\n=== FINAL RESULT ===');
    console.log(JSON.stringify(config, null, 2));
  }
}).catch(console.error);
