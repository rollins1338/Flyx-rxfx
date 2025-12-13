/**
 * Analyze MegaUp encryption to build our own decryptor
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const TEST_EMBED_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function main() {
  console.log('Analyzing MegaUp encryption...\n');
  
  // Fetch the embed page
  const response = await fetch(TEST_EMBED_URL, {
    headers: {
      ...HEADERS,
      'Referer': 'https://animekai.to/',
    },
  });
  
  const html = await response.text();
  
  // Extract __PAGE_DATA
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  if (!pageDataMatch) {
    console.log('No __PAGE_DATA found!');
    return;
  }
  
  const encryptedData = pageDataMatch[1];
  console.log('Encrypted __PAGE_DATA:', encryptedData);
  console.log('Length:', encryptedData.length);
  
  // Fetch the app.js to understand the decryption
  const appJsMatch = html.match(/src="([^"]+app\.js[^"]*)"/);
  if (appJsMatch) {
    console.log('\nFetching app.js:', appJsMatch[1]);
    
    const jsResponse = await fetch(appJsMatch[1], { headers: HEADERS });
    const jsCode = await jsResponse.text();
    
    console.log('app.js length:', jsCode.length);
    
    // Look for decryption patterns
    console.log('\n--- Searching for decryption patterns ---');
    
    // Look for __PAGE_DATA usage
    const pageDataUsage = jsCode.match(/__PAGE_DATA[^;]{0,200}/g);
    if (pageDataUsage) {
      console.log('\n__PAGE_DATA usage:');
      pageDataUsage.forEach(m => console.log('  ', m.substring(0, 150)));
    }
    
    // Look for decrypt/decode functions
    const decryptPatterns = jsCode.match(/function\s+\w*[dD]ecrypt\w*\s*\([^)]*\)\s*\{[^}]{0,500}/g);
    if (decryptPatterns) {
      console.log('\nDecrypt functions:');
      decryptPatterns.forEach(m => console.log('  ', m.substring(0, 200)));
    }
    
    // Look for atob/btoa usage
    const atobUsage = jsCode.match(/atob\([^)]+\)/g);
    if (atobUsage) {
      console.log('\natob usage:', atobUsage.slice(0, 5));
    }
    
    // Look for CryptoJS or similar
    if (jsCode.includes('CryptoJS')) {
      console.log('\nCryptoJS detected!');
      const cryptoUsage = jsCode.match(/CryptoJS\.\w+\.\w+\([^)]+\)/g);
      if (cryptoUsage) {
        console.log('CryptoJS usage:', cryptoUsage.slice(0, 5));
      }
    }
    
    // Look for AES patterns
    if (jsCode.includes('AES')) {
      console.log('\nAES encryption detected!');
    }
    
    // Look for key patterns
    const keyPatterns = jsCode.match(/['"](key|secret|password|iv)['"]\s*[,:]\s*['"][^'"]+['"]/gi);
    if (keyPatterns) {
      console.log('\nPossible keys:', keyPatterns.slice(0, 10));
    }
    
    // Save the JS for manual analysis
    require('fs').writeFileSync('source-testing/results/megaup-app.js', jsCode);
    console.log('\nSaved app.js to source-testing/results/megaup-app.js');
  }
}

main().catch(console.error);
