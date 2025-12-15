/**
 * Crack 111movies encoding
 * 
 * The encoding appears to be a custom base64-like encoding
 * Characters used: a-z, A-Z, 0-9, _, -
 * 
 * This is 64 characters = base64 with custom alphabet
 */

const puppeteer = require('puppeteer');

// Standard base64 alphabet
const STANDARD_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Possible custom alphabets (111movies might use one of these)
const CUSTOM_ALPHABETS = [
  // URL-safe base64
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  // Reversed
  'zyxwvutsrqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA9876543210-_',
  // Shuffled common patterns
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_',
];

function customBase64Decode(encoded, customAlphabet) {
  // Build translation table
  const table = {};
  for (let i = 0; i < customAlphabet.length; i++) {
    table[customAlphabet[i]] = i;
  }
  
  // Decode
  let result = '';
  let buffer = 0;
  let bits = 0;
  
  for (const char of encoded) {
    if (char === '=') continue;
    const value = table[char];
    if (value === undefined) continue;
    
    buffer = (buffer << 6) | value;
    bits += 6;
    
    while (bits >= 8) {
      bits -= 8;
      result += String.fromCharCode((buffer >> bits) & 0xFF);
    }
  }
  
  return result;
}

// Try to find the alphabet by analyzing the encoding
function findAlphabet(encoded) {
  const chars = [...new Set(encoded)].sort();
  console.log('Characters used:', chars.join(''));
  console.log('Character count:', chars.length);
  
  // Check if it's exactly 64 characters (base64)
  if (chars.length <= 64) {
    console.log('Could be base64 with custom alphabet');
  }
  
  return chars;
}

// Intercept the actual API calls to understand the encoding
async function interceptApiCalls() {
  console.log('=== INTERCEPTING 111MOVIES API CALLS ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Store all API data
    const apiData = {
      pageData: null,
      sourcesUrl: null,
      sourcesResponse: null,
      streamUrl: null,
      streamResponse: null
    };
    
    // Intercept requests
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4')) {
        console.log('\n[API REQUEST]');
        console.log('URL:', url);
        
        // Parse the URL structure
        const parts = url.split('/');
        const hashIndex = parts.findIndex(p => p === 'fcd552c4');
        if (hashIndex >= 0) {
          const encodedPart = parts[hashIndex + 1];
          console.log('Encoded part:', encodedPart);
          console.log('Encoded length:', encodedPart?.length);
          
          if (url.endsWith('/sr')) {
            apiData.sourcesUrl = url;
          } else {
            apiData.streamUrl = url;
          }
        }
      }
    });
    
    page.on('response', async res => {
      const url = res.url();
      if (url.includes('fcd552c4') && res.status() === 200) {
        try {
          const data = await res.json();
          console.log('\n[API RESPONSE]');
          console.log('URL:', url);
          console.log('Data:', JSON.stringify(data, null, 2).substring(0, 500));
          
          if (url.endsWith('/sr')) {
            apiData.sourcesResponse = data;
          } else if (data.url) {
            apiData.streamResponse = data;
          }
        } catch (e) {}
      }
    });
    
    // Load page
    console.log('Loading page...');
    await page.goto('https://111movies.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Get page data
    apiData.pageData = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      return script ? JSON.parse(script.textContent).props?.pageProps : null;
    });
    
    // Wait for API calls
    await new Promise(r => setTimeout(r, 5000));
    
    // Analyze the relationship between page data and API URLs
    console.log('\n=== ANALYSIS ===\n');
    
    if (apiData.pageData?.data && apiData.sourcesUrl) {
      console.log('Page data (encoded):', apiData.pageData.data.substring(0, 80));
      
      // Extract the encoded part from the API URL
      const urlParts = apiData.sourcesUrl.split('/');
      const hashIndex = urlParts.findIndex(p => p === 'fcd552c4');
      const apiEncoded = urlParts[hashIndex + 1];
      
      console.log('API URL encoded:', apiEncoded?.substring(0, 80));
      
      // Compare lengths
      console.log('\nPage data length:', apiData.pageData.data.length);
      console.log('API encoded length:', apiEncoded?.length);
      
      // Check if they're related
      if (apiData.pageData.data === apiEncoded) {
        console.log('\n✓ Page data IS the API encoded part!');
      } else {
        console.log('\n✗ Page data is DIFFERENT from API encoded part');
        console.log('The encoding transforms the page data before making API calls');
        
        // Try to find the transformation
        console.log('\nLooking for transformation pattern...');
        
        // Check character sets
        const pageChars = new Set(apiData.pageData.data);
        const apiChars = new Set(apiEncoded);
        
        console.log('Page data chars:', [...pageChars].sort().join(''));
        console.log('API URL chars:', [...apiChars].sort().join(''));
      }
    }
    
    // If we got stream data, show the m3u8 URL
    if (apiData.streamResponse?.url) {
      console.log('\n=== STREAM URL ===');
      console.log(apiData.streamResponse.url);
    }
    
    return apiData;
    
  } finally {
    await browser.close();
  }
}

// Try to extract the encoding function from the JS bundles
async function extractEncodingFunction() {
  console.log('\n=== EXTRACTING ENCODING FUNCTION ===\n');
  
  // Fetch the main page
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  // Find script URLs
  const scriptUrls = html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) || [];
  console.log('Found', scriptUrls.length, 'script chunks');
  
  // Fetch and search each script for encoding-related code
  for (const scriptPath of scriptUrls) {
    const scriptUrl = `https://111movies.com${scriptPath}`;
    try {
      const scriptRes = await fetch(scriptUrl);
      const scriptContent = await scriptRes.text();
      
      // Look for encoding patterns
      const patterns = [
        /function\s+\w+\s*\([^)]*\)\s*\{[^}]*charCodeAt[^}]*\}/g,
        /btoa|atob/g,
        /fcd552c4/g,
        /encode|decode/gi,
        /\.split\(['"]{2}\)\.map/g,
        /String\.fromCharCode/g
      ];
      
      for (const pattern of patterns) {
        const matches = scriptContent.match(pattern);
        if (matches && matches.length > 0) {
          console.log(`\nFound in ${scriptPath.split('/').pop()}:`);
          console.log(`  Pattern: ${pattern}`);
          console.log(`  Matches: ${matches.length}`);
          
          // Get context around the match
          const idx = scriptContent.indexOf(matches[0]);
          if (idx >= 0) {
            const context = scriptContent.substring(Math.max(0, idx - 50), idx + 200);
            console.log(`  Context: ...${context}...`);
          }
        }
      }
    } catch (e) {
      console.log(`Failed to fetch ${scriptPath}:`, e.message);
    }
  }
}

async function main() {
  // First, intercept actual API calls
  const apiData = await interceptApiCalls();
  
  // Then try to extract the encoding function
  await extractEncodingFunction();
}

main().catch(console.error);
