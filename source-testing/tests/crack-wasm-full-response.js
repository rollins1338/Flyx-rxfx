/**
 * Crack WASM - Get Full Response with URLs
 * 
 * Let's try to get the full response with actual stream URLs.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function getFullResponse() {
  console.log('=== Get Full Flixer Response ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  
  // Try different server options
  const servers = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
  
  for (const server of servers) {
    console.log(`\n=== Testing server: ${server} ===\n`);
    
    const result = await page.evaluate(async (key, serverName) => {
      const crypto = window.crypto;
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
        .replace(/[/+=]/g, '').substring(0, 22);
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      
      const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
      const message = `${key}:${timestamp}:${nonce}:${path}`;
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      
      const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
        headers: {
          'X-Api-Key': key,
          'X-Request-Timestamp': timestamp.toString(),
          'X-Request-Nonce': nonce,
          'X-Request-Signature': signature,
          'X-Client-Fingerprint': 'test',
          'bW90aGFmYWth': '1',
          'X-Server': serverName,
          // Don't include X-Only-Sources to get full response
        },
      });
      
      const encryptedData = await response.text();
      
      try {
        const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
        return {
          success: true,
          encrypted: encryptedData,
          decrypted: decrypted,
        };
      } catch (e) {
        return {
          success: false,
          error: e.message,
          encrypted: encryptedData,
        };
      }
    }, testKey, server);
    
    if (result.success) {
      console.log(`Decrypted (${result.decrypted.length} chars):`);
      
      // Try to parse and pretty print
      try {
        const data = JSON.parse(result.decrypted);
        console.log(JSON.stringify(data, null, 2));
        
        // Check if we have actual URLs
        if (data.sources) {
          for (const source of data.sources) {
            if (source.url && source.url.length > 0) {
              console.log(`\n*** Found URL for ${source.server}: ${source.url.substring(0, 100)}...`);
            }
          }
        }
      } catch (e) {
        console.log(result.decrypted);
      }
    } else {
      console.log(`Error: ${result.error}`);
      console.log(`Encrypted length: ${result.encrypted.length}`);
    }
  }
  
  // Also try a movie
  console.log('\n\n=== Testing Movie (Inception - 27205) ===\n');
  
  const movieResult = await page.evaluate(async (key) => {
    const crypto = window.crypto;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const path = '/api/tmdb/movie/27205/images';
    const message = `${key}:${timestamp}:${nonce}:${path}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': key,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'X-Server': 'alpha',
      },
    });
    
    const encryptedData = await response.text();
    
    try {
      const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
      return {
        success: true,
        decrypted: decrypted,
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
      };
    }
  }, testKey);
  
  if (movieResult.success) {
    try {
      const data = JSON.parse(movieResult.decrypted);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(movieResult.decrypted);
    }
  } else {
    console.log(`Error: ${movieResult.error}`);
  }
  
  await browser.close();
}

getFullResponse().catch(console.error);
