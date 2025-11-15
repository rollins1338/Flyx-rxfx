const https = require('https');
const fs = require('fs');

/**
 * Extract PRO.RCP hash and test all decoding methods
 * Using the TV show URL you provided
 */

async function fetchPage(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function extractAndTest() {
  console.log('🎯 Extracting PRO.RCP hash from TV show...\n');

  // Step 1: Fetch embed page
  const embedUrl = 'https://vidsrc-embed.ru/embed/tv/259909/1/1/';
  console.log('[1] Fetching embed page...');
  console.log(`    ${embedUrl}\n`);
  
  const embedPage = await fetchPage(embedUrl);
  console.log(`[1] ✅ Got embed page (${embedPage.length} bytes)\n`);

  // Step 2: Extract RCP hash
  const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
  if (!hashMatch) {
    console.log('[2] ❌ No hash found in embed page');
    console.log('    Searching for alternative patterns...\n');
    
    // Try alternative patterns
    const altMatch = embedPage.match(/\/rcp\/([a-zA-Z0-9]+)/);
    if (altMatch) {
      console.log('[2] ✅ Found RCP hash in URL:', altMatch[1]);
    } else {
      console.log('    Saving embed page for manual inspection...');
      fs.writeFileSync('embed-page.html', embedPage);
      console.log('    Saved to: embed-page.html');
      return;
    }
  }
  
  const hash = hashMatch ? hashMatch[1] : null;
  if (!hash) return;
  
  console.log(`[2] ✅ RCP Hash: ${hash}\n`);

  // Step 3: Fetch RCP page
  const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
  console.log('[3] Fetching RCP page...');
  console.log(`    ${rcpUrl}\n`);
  
  const rcpPage = await fetchPage(rcpUrl, embedUrl);
  console.log(`[3] ✅ Got RCP page (${rcpPage.length} bytes)\n`);

  // Step 4: Extract PRO.RCP hash
  const prorcpMatch = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
  if (!prorcpMatch) {
    console.log('[4] ❌ No PRO.RCP hash found');
    fs.writeFileSync('rcp-page.html', rcpPage);
    console.log('    Saved to: rcp-page.html');
    return;
  }
  
  const prorcpHash = prorcpMatch[1];
  console.log(`[4] ✅ PRO.RCP Hash: ${prorcpHash}\n`);

  // Step 5: Fetch PRO.RCP player page
  const playerUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
  console.log('[5] Fetching PRO.RCP player page...');
  console.log(`    ${playerUrl}\n`);
  
  const playerPage = await fetchPage(playerUrl, rcpUrl);
  console.log(`[5] ✅ Got player page (${playerPage.length} bytes)\n`);

  // Step 6: Extract hidden div with encoded hash
  const divMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i);
  if (!divMatch) {
    console.log('[6] ❌ No hidden div found');
    console.log('    Trying alternative pattern...\n');
    
    // Try to find any pjsdiv
    const altDivMatch = playerPage.match(/<div[^>]+id="(pjsdiv[^"]*)"[^>]*>([^<]+)<\/div>/i);
    if (altDivMatch) {
      console.log('[6] ✅ Found pjsdiv with alternative pattern');
    } else {
      fs.writeFileSync('player-page.html', playerPage);
      console.log('    Saved to: player-page.html');
      return;
    }
  }
  
  const divId = divMatch[1];
  const encodedHash = divMatch[2];
  
  console.log('[6] ✅ Found encoded hash!');
  console.log(`    Div ID: ${divId}`);
  console.log(`    Length: ${encodedHash.length}`);
  console.log(`    First 100: ${encodedHash.substring(0, 100)}\n`);

  // Save for analysis
  fs.writeFileSync('encoded-hash.txt', encodedHash);
  fs.writeFileSync('div-id.txt', divId);
  console.log('    💾 Saved to: encoded-hash.txt, div-id.txt\n');

  // Step 7: Test ALL decoding methods
  console.log('='.repeat(80));
  console.log('🔬 TESTING ALL DECODING METHODS');
  console.log('='.repeat(80) + '\n');

  const results = {};

  // Method 1: URL-safe base64 decode
  try {
    const urlSafe = encodedHash.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    results.urlSafeBase64 = {
      success: true,
      output: decoded.substring(0, 150),
      length: decoded.length,
      hasHttp: decoded.includes('http'),
      hasM3u8: decoded.includes('.m3u8')
    };
    console.log('Method 1: URL-safe Base64 Decode');
    console.log(`  Output: ${decoded.substring(0, 100)}`);
    console.log(`  Has http: ${decoded.includes('http')}`);
    console.log(`  Has .m3u8: ${decoded.includes('.m3u8')}\n`);
  } catch (e) {
    results.urlSafeBase64 = { error: e.message };
    console.log('Method 1: URL-safe Base64 Decode - FAILED\n');
  }

  // Method 2: Standard base64 decode
  try {
    const decoded = Buffer.from(encodedHash, 'base64').toString('utf8');
    results.standardBase64 = {
      success: true,
      output: decoded.substring(0, 150),
      hasHttp: decoded.includes('http'),
      hasM3u8: decoded.includes('.m3u8')
    };
    console.log('Method 2: Standard Base64 Decode');
    console.log(`  Output: ${decoded.substring(0, 100)}`);
    console.log(`  Has http: ${decoded.includes('http')}\n`);
  } catch (e) {
    results.standardBase64 = { error: e.message };
    console.log('Method 2: Standard Base64 Decode - FAILED\n');
  }

  // Method 3: URL-safe base64 + reverse
  try {
    const urlSafe = encodedHash.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    const reversed = decoded.split('').reverse().join('');
    results.urlSafeReversed = {
      success: true,
      output: reversed.substring(0, 150),
      hasHttp: reversed.includes('http'),
      hasM3u8: reversed.includes('.m3u8')
    };
    console.log('Method 3: URL-safe Base64 + Reverse');
    console.log(`  Output: ${reversed.substring(0, 100)}`);
    console.log(`  Has http: ${reversed.includes('http')}\n`);
  } catch (e) {
    results.urlSafeReversed = { error: e.message };
    console.log('Method 3: URL-safe Base64 + Reverse - FAILED\n');
  }

  // Method 4: URL-safe base64 + XOR with divId
  try {
    const urlSafe = encodedHash.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    const xorKey = divId.replace('pjsdiv', '');
    let xorResult = '';
    for (let i = 0; i < decoded.length; i++) {
      xorResult += String.fromCharCode(decoded.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
    }
    results.urlSafeXor = {
      success: true,
      output: xorResult.substring(0, 150),
      hasHttp: xorResult.includes('http'),
      hasM3u8: xorResult.includes('.m3u8')
    };
    console.log('Method 4: URL-safe Base64 + XOR with divId');
    console.log(`  XOR Key: ${xorKey}`);
    console.log(`  Output: ${xorResult.substring(0, 100)}`);
    console.log(`  Has http: ${xorResult.includes('http')}\n`);
  } catch (e) {
    results.urlSafeXor = { error: e.message };
    console.log('Method 4: URL-safe Base64 + XOR - FAILED\n');
  }

  // Method 5: Double base64 decode
  try {
    const urlSafe = encodedHash.replace(/-/g, '+').replace(/_/g, '/');
    const decoded1 = Buffer.from(urlSafe, 'base64').toString('utf8');
    const decoded2 = Buffer.from(decoded1, 'base64').toString('utf8');
    results.doubleBase64 = {
      success: true,
      output: decoded2.substring(0, 150),
      hasHttp: decoded2.includes('http'),
      hasM3u8: decoded2.includes('.m3u8')
    };
    console.log('Method 5: Double Base64 Decode');
    console.log(`  Output: ${decoded2.substring(0, 100)}`);
    console.log(`  Has http: ${decoded2.includes('http')}\n`);
  } catch (e) {
    results.doubleBase64 = { error: e.message };
    console.log('Method 5: Double Base64 Decode - FAILED\n');
  }

  // Method 6: Caesar cipher (from your test-fight-club.js)
  function caesarShift(text, shift) {
    return text.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
      return c;
    }).join('');
  }

  const caesarDecoded = caesarShift(encodedHash, 3);
  results.caesar3 = {
    success: true,
    output: caesarDecoded.substring(0, 150),
    hasHttp: caesarDecoded.includes('http'),
    hasM3u8: caesarDecoded.includes('.m3u8')
  };
  console.log('Method 6: Caesar Cipher +3');
  console.log(`  Output: ${caesarDecoded.substring(0, 100)}`);
  console.log(`  Has http: ${caesarDecoded.includes('http')}\n`);

  // Summary
  console.log('='.repeat(80));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const successfulMethods = Object.entries(results).filter(([_, result]) => 
    result.success && (result.hasHttp || result.hasM3u8)
  );

  if (successfulMethods.length > 0) {
    console.log('🎯 SUCCESSFUL METHODS:\n');
    successfulMethods.forEach(([method, result]) => {
      console.log(`✅ ${method}:`);
      console.log(`   ${result.output}`);
      console.log('');
    });
  } else {
    console.log('❌ No method successfully decoded to a URL\n');
    console.log('The encoding might be more complex. Possible next steps:');
    console.log('1. Check player-page.html for inline JavaScript decoder');
    console.log('2. The hash might need a specific key from the page');
    console.log('3. Try analyzing the PlayerJS file for custom decoder\n');
  }

  // Save all results
  fs.writeFileSync('decoding-results.json', JSON.stringify(results, null, 2));
  console.log('💾 All results saved to: decoding-results.json\n');
}

extractAndTest().catch(console.error);
