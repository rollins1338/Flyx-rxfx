/**
 * Analyze XPrime.tv response in detail
 * Looking for backend API endpoints and encrypted data patterns
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TMDB_ID = '550'; // Fight Club

async function analyzeXPrime() {
  console.log('=== ANALYZING XPRIME.TV ===\n');
  
  const embedUrl = `https://xprime.tv/embed/movie/${TMDB_ID}`;
  console.log(`Embed URL: ${embedUrl}\n`);
  
  try {
    const response = await fetch(embedUrl, {
      headers: { ...HEADERS, 'Referer': 'https://xprime.tv/' }
    });
    
    console.log(`Status: ${response.status}`);
    const html = await response.text();
    console.log(`Length: ${html.length} chars\n`);
    
    // 1. Look for backend.xprime.tv (mentioned in enc-dec.app hint)
    console.log('=== BACKEND REFERENCES ===');
    const backendPatterns = [
      /backend\.xprime\.tv[^"'\s]*/gi,
      /api\.xprime\.tv[^"'\s]*/gi,
      /xprime\.tv\/api[^"'\s]*/gi,
    ];
    
    for (const pattern of backendPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        console.log(`  Found: ${match[0]}`);
      }
    }
    
    // 2. Look for all URLs in the page
    console.log('\n=== ALL URLS ===');
    const urlPattern = /["'](https?:\/\/[^"'\s]+)["']/gi;
    const urls = new Set();
    let match;
    while ((match = urlPattern.exec(html)) !== null) {
      const url = match[1];
      if (!url.includes('google') && !url.includes('gstatic') && !url.includes('fonts')) {
        urls.add(url);
      }
    }
    for (const url of urls) {
      console.log(`  ${url}`);
    }
    
    // 3. Look for script sources
    console.log('\n=== SCRIPT SOURCES ===');
    const scriptPattern = /<script[^>]*src=["']([^"']+)["']/gi;
    while ((match = scriptPattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // 4. Look for inline scripts with interesting patterns
    console.log('\n=== INLINE SCRIPT ANALYSIS ===');
    const inlineScriptPattern = /<script[^>]*>([^<]+)<\/script>/gi;
    let scriptCount = 0;
    while ((match = inlineScriptPattern.exec(html)) !== null) {
      const script = match[1];
      if (script.length > 100) {
        scriptCount++;
        console.log(`\nScript ${scriptCount} (${script.length} chars):`);
        
        // Look for API calls
        if (script.includes('fetch') || script.includes('axios') || script.includes('XMLHttpRequest')) {
          console.log('  Contains fetch/API calls');
          
          // Extract fetch URLs
          const fetchPattern = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi;
          let fetchMatch;
          while ((fetchMatch = fetchPattern.exec(script)) !== null) {
            console.log(`    fetch URL: ${fetchMatch[1]}`);
          }
        }
        
        // Look for encrypted data patterns
        if (script.includes('decrypt') || script.includes('atob') || script.includes('btoa')) {
          console.log('  Contains encryption/decryption');
        }
        
        // Look for source/stream patterns
        if (script.includes('source') || script.includes('stream') || script.includes('m3u8')) {
          console.log('  Contains source/stream references');
        }
      }
    }
    
    // 5. Look for data attributes
    console.log('\n=== DATA ATTRIBUTES ===');
    const dataAttrPattern = /data-([a-z-]+)=["']([^"']+)["']/gi;
    while ((match = dataAttrPattern.exec(html)) !== null) {
      if (match[2].length > 20) {
        console.log(`  data-${match[1]}: ${match[2].substring(0, 100)}...`);
      }
    }
    
    // 6. Look for JSON data in the page
    console.log('\n=== JSON DATA ===');
    const jsonPatterns = [
      /window\.__[A-Z_]+__\s*=\s*(\{[^;]+\})/gi,
      /window\.[a-zA-Z_]+\s*=\s*(\{[^;]+\})/gi,
      /"sources"\s*:\s*(\[[^\]]+\])/gi,
      /"file"\s*:\s*"([^"]+)"/gi,
    ];
    
    for (const pattern of jsonPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        console.log(`  Found: ${match[0].substring(0, 200)}...`);
      }
    }
    
    // 7. Look for long base64-like strings (potential encrypted data)
    console.log('\n=== POTENTIAL ENCRYPTED DATA ===');
    const base64Pattern = /["']([A-Za-z0-9+/=_-]{100,})["']/g;
    let encCount = 0;
    while ((match = base64Pattern.exec(html)) !== null) {
      if (!match[1].includes('http') && !match[1].includes('function')) {
        encCount++;
        console.log(`  ${encCount}. (${match[1].length} chars): ${match[1].substring(0, 80)}...`);
        
        // Try to decode as base64
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf8');
          if (decoded.includes('http') || decoded.includes('{')) {
            console.log(`     Decoded: ${decoded.substring(0, 100)}...`);
          }
        } catch {}
        
        if (encCount >= 5) {
          console.log('  ... (more found, stopping at 5)');
          break;
        }
      }
    }
    
    // 8. Check if it's a React/Vue SPA
    console.log('\n=== FRAMEWORK DETECTION ===');
    if (html.includes('__NEXT_DATA__')) console.log('  Next.js detected');
    if (html.includes('__NUXT__')) console.log('  Nuxt.js detected');
    if (html.includes('react')) console.log('  React detected');
    if (html.includes('vue')) console.log('  Vue detected');
    if (html.includes('angular')) console.log('  Angular detected');
    if (html.includes('svelte')) console.log('  Svelte detected');
    
    // 9. Save the HTML for manual inspection
    const fs = require('fs');
    fs.writeFileSync('source-testing/xprime-response.html', html);
    console.log('\n=== SAVED ===');
    console.log('  Full HTML saved to source-testing/xprime-response.html');
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

analyzeXPrime().catch(console.error);
