/**
 * Analyze enc-dec.app to find decryption algorithm
 */

const crypto = require('crypto');

async function analyzeEncDecApp() {
  console.log('=== Analyzing enc-dec.app ===\n');
  
  // Fetch the main page
  const response = await fetch('https://enc-dec.app/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  console.log('Page length:', html.length);
  
  // Look for Next.js build manifest or chunk URLs
  const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
  if (buildIdMatch) {
    console.log('Build ID:', buildIdMatch[1]);
  }
  
  // Look for script chunks
  const chunkMatches = html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) || [];
  console.log('\nChunk URLs found:', chunkMatches.length);
  
  // Look for page chunks
  const pageMatches = html.match(/\/_next\/static\/[^"]+\/pages\/[^"]+\.js/g) || [];
  console.log('Page URLs found:', pageMatches.length);
  
  // Combine all JS URLs
  const allJsUrls = [...new Set([...chunkMatches, ...pageMatches])];
  console.log('\nTotal unique JS URLs:', allJsUrls.length);
  
  // Fetch and analyze each JS file
  for (const jsPath of allJsUrls.slice(0, 10)) { // Limit to first 10
    const jsUrl = 'https://enc-dec.app' + jsPath;
    console.log(`\n--- Fetching ${jsPath} ---`);
    
    try {
      const jsResponse = await fetch(jsUrl);
      const js = await jsResponse.text();
      console.log('Length:', js.length);
      
      // Look for crypto-related keywords
      const keywords = [
        'decrypt', 'encrypt', 'chacha', 'aes', 'secretbox', 
        'sodium', 'nacl', 'crypto', 'hexa', 'nonce', 'cipher',
        'xor', 'keystream', 'poly1305', 'salsa'
      ];
      
      for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        const matches = js.match(regex);
        if (matches && matches.length > 0) {
          console.log(`  Found "${kw}": ${matches.length} times`);
          
          // Find context around the keyword
          const idx = js.toLowerCase().indexOf(kw.toLowerCase());
          if (idx !== -1) {
            const start = Math.max(0, idx - 30);
            const end = Math.min(js.length, idx + kw.length + 50);
            const context = js.substring(start, end).replace(/\n/g, ' ');
            console.log(`    Context: ...${context}...`);
          }
        }
      }
      
      // Look for function definitions related to decryption
      const funcMatches = js.match(/function\s+\w*[dD]ecrypt\w*\s*\(/g) || [];
      if (funcMatches.length > 0) {
        console.log('  Decrypt functions:', funcMatches);
      }
      
      // Look for API route handlers
      if (js.includes('dec-hexa') || js.includes('decHexa')) {
        console.log('  *** Contains dec-hexa reference! ***');
        
        // Try to find the handler
        const handlerMatch = js.match(/.{100}dec.?hexa.{200}/gi);
        if (handlerMatch) {
          console.log('  Handler context:', handlerMatch[0].slice(0, 200));
        }
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  
  // Also check the API endpoint directly
  console.log('\n=== Checking API endpoint ===\n');
  
  // Try to get API info
  const apiResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'OPTIONS',
  });
  console.log('OPTIONS response:', apiResponse.status);
  console.log('Headers:', Object.fromEntries(apiResponse.headers.entries()));
}

analyzeEncDecApp().catch(console.error);
