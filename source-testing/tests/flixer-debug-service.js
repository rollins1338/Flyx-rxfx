/**
 * Debug Flixer Service - More verbose output
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugService() {
  console.log('=== Debug Flixer Service ===\n');
  
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
  
  console.log('WASM ready');
  
  // Test fetching servers
  const result = await page.evaluate(async () => {
    const apiKey = window.wasmImgData.get_img_key();
    console.log('API Key:', apiKey);
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    console.log('Timestamp:', timestamp);
    console.log('Nonce:', nonce);
    console.log('Signature:', signature);
    
    // Fetch server list
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'Accept': 'text/plain',
      },
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const body = await response.text();
      return { error: `HTTP ${response.status}`, body };
    }
    
    const encryptedData = await response.text();
    console.log('Encrypted data length:', encryptedData.length);
    console.log('Encrypted data preview:', encryptedData.slice(0, 100));
    
    try {
      const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
      console.log('Decrypted:', decrypted);
      
      const parsed = JSON.parse(decrypted);
      return { success: true, parsed };
    } catch (e) {
      return { error: e.message, encryptedPreview: encryptedData.slice(0, 200) };
    }
  });
  
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  if (result.success && result.parsed) {
    // Try to get a specific server
    const servers = result.parsed.servers ? Object.keys(result.parsed.servers) : 
                   result.parsed.sources ? result.parsed.sources.map(s => s.server) : [];
    
    console.log('\nServers:', servers);
    
    if (servers.length > 0) {
      const server = servers[0];
      console.log(`\nFetching from server: ${server}`);
      
      const sourceResult = await page.evaluate(async (server) => {
        const apiKey = window.wasmImgData.get_img_key();
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
          .replace(/[/+=]/g, '').substring(0, 22);
        
        const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
        const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
        
        const encoder = new TextEncoder();
        const keyData = encoder.encode(apiKey);
        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
        
        const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
          headers: {
            'X-Api-Key': apiKey,
            'X-Request-Timestamp': timestamp.toString(),
            'X-Request-Nonce': nonce,
            'X-Request-Signature': signature,
            'X-Client-Fingerprint': 'test',
            'bW90aGFmYWth': '1',
            'Accept': 'text/plain',
            'X-Only-Sources': '1',
            'X-Server': server,
          },
        });
        
        console.log('Source response status:', response.status);
        
        if (!response.ok) {
          return { error: `HTTP ${response.status}` };
        }
        
        const encryptedData = await response.text();
        console.log('Source encrypted length:', encryptedData.length);
        
        try {
          const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
          console.log('Source decrypted:', decrypted);
          return { success: true, decrypted };
        } catch (e) {
          return { error: e.message };
        }
      }, server);
      
      console.log('\nSource result:', JSON.stringify(sourceResult, null, 2));
    }
  }
  
  await browser.close();
}

debugService().catch(console.error);
