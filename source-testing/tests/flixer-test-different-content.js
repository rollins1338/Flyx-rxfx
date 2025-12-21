/**
 * Test Different Content - Try various TMDB IDs
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testDifferentContent() {
  console.log('=== Test Different Content ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Navigate to a popular show
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', { // Breaking Bad
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  console.log('WASM ready');
  
  // Test different content
  const testCases = [
    { type: 'tv', id: 1396, season: 1, episode: 1, name: 'Breaking Bad S01E01' },
    { type: 'tv', id: 1399, season: 1, episode: 1, name: 'Game of Thrones S01E01' },
    { type: 'movie', id: 550, name: 'Fight Club' },
    { type: 'movie', id: 157336, name: 'Interstellar' },
  ];
  
  for (const test of testCases) {
    console.log(`\n--- Testing: ${test.name} ---`);
    
    const path = test.type === 'movie'
      ? `/api/tmdb/movie/${test.id}/images`
      : `/api/tmdb/tv/${test.id}/season/${test.season}/episode/${test.episode}/images`;
    
    const result = await page.evaluate(async (path) => {
      const apiKey = window.wasmImgData.get_img_key();
      
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
        .replace(/[/+=]/g, '').substring(0, 22);
      
      const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      
      // First get server list
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
      
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      
      const encryptedData = await response.text();
      
      try {
        const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
        const parsed = JSON.parse(decrypted);
        
        // Get servers
        const servers = parsed.sources?.map(s => s.server) || Object.keys(parsed.servers || {});
        
        // Try to get actual source from first server
        if (servers.length > 0) {
          const server = servers[0];
          
          const timestamp2 = Math.floor(Date.now() / 1000);
          const nonce2 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
            .replace(/[/+=]/g, '').substring(0, 22);
          
          const message2 = `${apiKey}:${timestamp2}:${nonce2}:${path}`;
          const cryptoKey2 = await crypto.subtle.importKey(
            'raw', encoder.encode(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
          );
          const signatureBuffer2 = await crypto.subtle.sign('HMAC', cryptoKey2, encoder.encode(message2));
          const signature2 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer2)));
          
          const sourceResponse = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
            headers: {
              'X-Api-Key': apiKey,
              'X-Request-Timestamp': timestamp2.toString(),
              'X-Request-Nonce': nonce2,
              'X-Request-Signature': signature2,
              'X-Client-Fingerprint': 'test',
              'bW90aGFmYWth': '1',
              'Accept': 'text/plain',
              'X-Only-Sources': '1',
              'X-Server': server,
            },
          });
          
          if (sourceResponse.ok) {
            const sourceEncrypted = await sourceResponse.text();
            const sourceDecrypted = await window.wasmImgData.process_img_data(sourceEncrypted, apiKey);
            const sourceParsed = JSON.parse(sourceDecrypted);
            
            // Find URL
            let url = null;
            if (Array.isArray(sourceParsed.sources)) {
              const source = sourceParsed.sources.find(s => s.url && s.url.length > 0);
              url = source?.url;
            }
            
            return { success: true, servers, url, server };
          }
        }
        
        return { success: true, servers, url: null };
      } catch (e) {
        return { error: e.message };
      }
    }, path);
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    } else {
      console.log(`Servers: ${result.servers?.join(', ')}`);
      console.log(`URL: ${result.url || '(empty)'}`);
    }
  }
  
  await browser.close();
}

testDifferentContent().catch(console.error);
