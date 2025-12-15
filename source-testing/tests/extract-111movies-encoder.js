/**
 * Extract and analyze the 111movies encoding function from their JS bundles
 * 
 * We need to find the function that transforms:
 * - Page data (172 chars) -> API encoded (688+ chars)
 * 
 * The ~4x expansion suggests each input char becomes ~4 output chars
 */

async function fetchAllScripts() {
  console.log('=== FETCHING 111MOVIES JS BUNDLES ===\n');
  
  // Get the main page to find script URLs
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await pageRes.text();
  
  // Find all script URLs
  const scriptUrls = [];
  
  // Next.js chunks
  const chunkMatches = html.match(/\/_next\/static\/chunks\/[^"'\s]+\.js/g) || [];
  scriptUrls.push(...chunkMatches);
  
  // Page-specific bundles
  const pageMatches = html.match(/\/_next\/static\/[^"'\s]+\/pages\/[^"'\s]+\.js/g) || [];
  scriptUrls.push(...pageMatches);
  
  console.log(`Found ${scriptUrls.length} scripts`);
  
  // Fetch each script and search for encoding patterns
  const scripts = {};
  
  for (const path of scriptUrls) {
    const url = `https://111movies.com${path}`;
    try {
      const res = await fetch(url);
      const content = await res.text();
      scripts[path] = content;
      
      // Check for encoding-related patterns
      if (content.includes('fcd552c4') || 
          content.includes('charCodeAt') && content.includes('fromCharCode') ||
          content.includes('encode') && content.includes('split("")')) {
        console.log(`\n*** POTENTIAL ENCODER IN: ${path.split('/').pop()} ***`);
        console.log(`Size: ${content.length} bytes`);
      }
    } catch (e) {
      console.log(`Failed to fetch ${path}`);
    }
  }
  
  return scripts;
}

function findEncodingFunction(scripts) {
  console.log('\n=== SEARCHING FOR ENCODING FUNCTION ===\n');
  
  for (const [path, content] of Object.entries(scripts)) {
    const filename = path.split('/').pop();
    
    // Look for the specific pattern that does 4x expansion
    // This is likely a function that:
    // 1. Takes a string
    // 2. Iterates over each character
    // 3. Produces multiple output characters per input
    
    // Pattern 1: Look for charCodeAt with multiplication/shifting
    const charCodePatterns = content.match(/\.charCodeAt\([^)]*\)[^;]{0,100}/g) || [];
    
    // Pattern 2: Look for split("").map or similar
    const splitMapPatterns = content.match(/\.split\s*\(\s*["']{2}\s*\)\s*\.map/g) || [];
    
    // Pattern 3: Look for base64-like alphabet definitions
    const alphabetPatterns = content.match(/["'][a-zA-Z0-9+/=_-]{60,66}["']/g) || [];
    
    // Pattern 4: Look for the API hash
    const hashPatterns = content.match(/fcd552c4[a-f0-9]*/g) || [];
    
    if (charCodePatterns.length > 5 || splitMapPatterns.length > 0 || 
        alphabetPatterns.length > 0 || hashPatterns.length > 0) {
      console.log(`\n--- ${filename} ---`);
      
      if (hashPatterns.length > 0) {
        console.log('API Hash found:', hashPatterns[0]);
      }
      
      if (alphabetPatterns.length > 0) {
        console.log('Alphabets found:');
        alphabetPatterns.forEach(a => console.log('  ', a));
      }
      
      if (splitMapPatterns.length > 0) {
        console.log('Split-map patterns:', splitMapPatterns.length);
      }
      
      // Try to extract the actual encoding function
      // Look for function definitions near these patterns
      const funcPatterns = [
        /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*charCodeAt[^}]*\}/g,
        /(\w+)\s*=\s*function\s*\([^)]*\)\s*\{[^}]*charCodeAt[^}]*\}/g,
        /(\w+)\s*:\s*function\s*\([^)]*\)\s*\{[^}]*charCodeAt[^}]*\}/g,
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*charCodeAt[^}]*\}/g,
      ];
      
      for (const pattern of funcPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          console.log('Encoding functions found:');
          matches.slice(0, 3).forEach(m => {
            console.log('  ', m.substring(0, 150) + '...');
          });
        }
      }
    }
  }
}

// Look specifically for the page-specific encoding logic
async function findPageEncoder() {
  console.log('\n=== LOOKING FOR PAGE-SPECIFIC ENCODER ===\n');
  
  // The encoding likely happens in the movie/[id] page component
  // Let's fetch the page-specific bundle
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  // Extract __NEXT_DATA__ to get build info
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    const nextData = JSON.parse(nextDataMatch[1]);
    console.log('Build ID:', nextData.buildId);
    console.log('Page:', nextData.page);
    
    // The page bundle should be at /_next/static/{buildId}/pages/movie/[id].js
    const pageBundleUrl = `https://111movies.com/_next/static/${nextData.buildId}/pages/movie/[id].js`;
    console.log('\nFetching page bundle:', pageBundleUrl);
    
    try {
      const bundleRes = await fetch(pageBundleUrl);
      if (bundleRes.ok) {
        const bundleContent = await bundleRes.text();
        console.log('Page bundle size:', bundleContent.length);
        
        // Search for encoding logic
        analyzeBundle(bundleContent, 'page-bundle');
      } else {
        console.log('Page bundle not found at expected location');
        
        // Try to find it in the HTML
        const pageBundleMatch = html.match(/\/_next\/static\/[^"]+pages\/movie\/\[id\][^"]+\.js/);
        if (pageBundleMatch) {
          console.log('Found page bundle:', pageBundleMatch[0]);
          const res = await fetch(`https://111movies.com${pageBundleMatch[0]}`);
          const content = await res.text();
          analyzeBundle(content, 'page-bundle');
        }
      }
    } catch (e) {
      console.log('Error fetching page bundle:', e.message);
    }
  }
}

function analyzeBundle(content, name) {
  console.log(`\n--- Analyzing ${name} (${content.length} bytes) ---`);
  
  // Look for the encoding function
  // Based on the 4x expansion, it's likely doing something like:
  // - For each char, get charCode
  // - Convert to some representation (maybe 4 chars each)
  
  // Search for specific patterns
  const patterns = {
    'charCodeAt usage': /\.charCodeAt\(/g,
    'fromCharCode usage': /String\.fromCharCode/g,
    'split empty': /\.split\s*\(\s*["']{2}\s*\)/g,
    'join empty': /\.join\s*\(\s*["']{2}\s*\)/g,
    'map function': /\.map\s*\(/g,
    'reduce function': /\.reduce\s*\(/g,
    'base64 chars': /[a-zA-Z0-9+/=]{64}/g,
    'fcd hash': /fcd552c4/g,
    'encode word': /\bencode\b/gi,
    'decode word': /\bdecode\b/gi,
  };
  
  for (const [name, pattern] of Object.entries(patterns)) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`${name}: ${matches.length} occurrences`);
    }
  }
  
  // Try to find the actual encoding function by looking for specific structures
  // The function likely takes the page data and transforms it
  
  // Look for functions that reference 'data' property
  const dataFuncMatch = content.match(/function[^{]*\{[^}]*\.data[^}]*charCodeAt[^}]*\}/g);
  if (dataFuncMatch) {
    console.log('\nFunctions using .data with charCodeAt:');
    dataFuncMatch.forEach(m => console.log(m.substring(0, 200)));
  }
  
  // Look for the specific encoding pattern
  // The output has 'p' characters frequently - might be a delimiter
  const pDelimiterMatch = content.match(/["']p["']/g);
  if (pDelimiterMatch && pDelimiterMatch.length > 5) {
    console.log(`\n'p' as string literal: ${pDelimiterMatch.length} times`);
  }
}

// Extract and beautify potential encoding functions
async function extractEncoderCode() {
  console.log('\n=== EXTRACTING ENCODER CODE ===\n');
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  // Get all script URLs
  const scriptUrls = html.match(/\/_next\/static\/[^"'\s]+\.js/g) || [];
  
  for (const path of scriptUrls) {
    const url = `https://111movies.com${path}`;
    const res = await fetch(url);
    const content = await res.text();
    
    // Look for the encoding function
    // It should have:
    // 1. A loop over characters
    // 2. charCodeAt calls
    // 3. Some transformation
    // 4. Output building
    
    // Try to find functions that do character-by-character transformation
    const funcRegex = /(\w+)\s*[=:]\s*(?:function\s*)?\([^)]*\)\s*(?:=>)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const funcBody = match[2];
      
      // Check if this function does character transformation
      if (funcBody.includes('charCodeAt') && 
          (funcBody.includes('split') || funcBody.includes('for') || funcBody.includes('while')) &&
          funcBody.length > 100 && funcBody.length < 2000) {
        
        console.log(`\n=== Potential encoder: ${match[1]} ===`);
        console.log('Location:', path.split('/').pop());
        console.log('Body length:', funcBody.length);
        console.log('\nCode:');
        console.log(funcBody.substring(0, 500));
        console.log('...');
      }
    }
  }
}

async function main() {
  const scripts = await fetchAllScripts();
  findEncodingFunction(scripts);
  await findPageEncoder();
  await extractEncoderCode();
}

main().catch(console.error);
