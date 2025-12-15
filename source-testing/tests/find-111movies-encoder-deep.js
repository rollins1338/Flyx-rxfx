/**
 * Deep analysis of 111movies encoding
 * 
 * Key findings so far:
 * 1. Page data is URL-safe base64 encoded binary (encrypted?)
 * 2. API encoded has 'p' as frequent delimiter
 * 3. Variable length segments between 'p'
 * 4. ~4x expansion from page data to API encoded
 * 
 * Need to find the actual encoding function in the JS bundles
 */

async function fetchBundle(path) {
  const url = `https://111movies.com${path}`;
  const res = await fetch(url);
  return res.text();
}

async function findEncoderInBundle() {
  console.log('=== SEARCHING FOR ENCODER IN 860-58807119fccb267b.js ===\n');
  
  // This bundle contains the custom base64 decoder
  // The encoder should be nearby
  
  const bundle = await fetchBundle('/_next/static/chunks/860-58807119fccb267b.js');
  
  // Look for the encoding function
  // The decoder uses: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/="
  
  // Find all functions that use this alphabet
  const alphabetPattern = /["']abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\+\/=["']/g;
  const matches = bundle.match(alphabetPattern);
  console.log('Custom alphabet occurrences:', matches?.length || 0);
  
  // Find the context around the alphabet
  const idx = bundle.indexOf('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=');
  if (idx >= 0) {
    const context = bundle.substring(Math.max(0, idx - 500), idx + 600);
    console.log('\nContext around custom alphabet:');
    console.log(context);
  }
  
  // Look for functions that might be the encoder
  // The encoder would:
  // 1. Take a string
  // 2. Transform each character
  // 3. Add 'p' delimiters
  
  // Search for 'p' being added to output
  const pAddPatterns = [
    /\+\s*["']p["']/g,
    /["']p["']\s*\+/g,
    /\.push\s*\(\s*["']p["']\s*\)/g,
    /concat\s*\(\s*["']p["']\s*\)/g,
  ];
  
  console.log('\n--- Searching for "p" delimiter patterns ---');
  for (const pattern of pAddPatterns) {
    const matches = bundle.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`Pattern ${pattern}: ${matches.length} matches`);
      
      // Find context
      let searchIdx = 0;
      for (const match of matches.slice(0, 3)) {
        const matchIdx = bundle.indexOf(match, searchIdx);
        if (matchIdx >= 0) {
          const context = bundle.substring(Math.max(0, matchIdx - 100), matchIdx + 150);
          console.log(`  Context: ...${context}...`);
          searchIdx = matchIdx + 1;
        }
      }
    }
  }
  
  // Look for the specific encoding pattern
  // The output format suggests: [encoded_block]p[encoded_block]p...
  
  // Search for loops that build encoded strings
  const loopPatterns = [
    /for\s*\([^)]*\)\s*\{[^}]*\+\s*["']p["'][^}]*\}/g,
    /while\s*\([^)]*\)\s*\{[^}]*\+\s*["']p["'][^}]*\}/g,
    /\.map\s*\([^)]*\)[^;]*["']p["']/g,
  ];
  
  console.log('\n--- Searching for encoding loops ---');
  for (const pattern of loopPatterns) {
    const matches = bundle.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`Pattern ${pattern.toString().substring(0, 50)}: ${matches.length} matches`);
      matches.slice(0, 2).forEach(m => console.log(`  ${m.substring(0, 200)}`));
    }
  }
}

async function analyzeAllBundles() {
  console.log('\n=== ANALYZING ALL BUNDLES FOR ENCODER ===\n');
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  const scriptPaths = html.match(/\/_next\/static\/[^"'\s]+\.js/g) || [];
  
  for (const path of scriptPaths) {
    const bundle = await fetchBundle(path);
    const filename = path.split('/').pop();
    
    // Look for the encoding function
    // Key indicators:
    // 1. Uses 'p' as delimiter
    // 2. Has charCodeAt
    // 3. Produces ~4x expansion
    
    // Search for functions that add 'p' to output
    if (bundle.includes('"p"') || bundle.includes("'p'")) {
      // Count occurrences
      const pCount = (bundle.match(/["']p["']/g) || []).length;
      
      if (pCount > 5) {
        console.log(`\n${filename}: ${pCount} occurrences of "p" literal`);
        
        // Find functions that use 'p'
        // Look for: result += "p" or similar
        const addPPattern = /(\w+)\s*\+=\s*["']p["']/g;
        const addPMatches = bundle.match(addPPattern);
        if (addPMatches) {
          console.log(`  Found ${addPMatches.length} "+=p" patterns`);
          
          // Get context
          for (const match of addPMatches.slice(0, 3)) {
            const idx = bundle.indexOf(match);
            const context = bundle.substring(Math.max(0, idx - 200), idx + 100);
            console.log(`  Context: ...${context.substring(0, 300)}...`);
          }
        }
      }
    }
    
    // Look for the specific encoding algorithm
    // The 4x expansion suggests each input byte becomes 4 output chars
    // This could be: hex encoding (2x) + some transformation (2x more)
    
    // Search for hex encoding patterns
    if (bundle.includes('toString(16)') || bundle.includes('toString(36)')) {
      console.log(`\n${filename}: Contains toString(16) or toString(36)`);
      
      // Find context
      const hexIdx = bundle.indexOf('toString(16)');
      if (hexIdx >= 0) {
        const context = bundle.substring(Math.max(0, hexIdx - 200), hexIdx + 200);
        console.log(`  Context: ...${context}...`);
      }
    }
  }
}

async function searchForSpecificPatterns() {
  console.log('\n=== SEARCHING FOR SPECIFIC ENCODING PATTERNS ===\n');
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  const scriptPaths = html.match(/\/_next\/static\/[^"'\s]+\.js/g) || [];
  
  // The encoding might use:
  // 1. A lookup table
  // 2. Mathematical transformation
  // 3. XOR or other bitwise operations
  
  for (const path of scriptPaths) {
    const bundle = await fetchBundle(path);
    const filename = path.split('/').pop();
    
    // Look for lookup tables (arrays of strings or chars)
    const lookupPattern = /\[\s*["'][a-zA-Z0-9]+"?\s*,\s*["'][a-zA-Z0-9]+["']\s*(?:,\s*["'][a-zA-Z0-9]+["']\s*){10,}\]/g;
    const lookupMatches = bundle.match(lookupPattern);
    if (lookupMatches) {
      console.log(`\n${filename}: Found ${lookupMatches.length} potential lookup tables`);
      lookupMatches.slice(0, 2).forEach(m => console.log(`  ${m.substring(0, 200)}...`));
    }
    
    // Look for XOR operations with strings
    const xorPattern = /\^\s*\d+|charCodeAt[^;]*\^/g;
    const xorMatches = bundle.match(xorPattern);
    if (xorMatches && xorMatches.length > 5) {
      console.log(`\n${filename}: Found ${xorMatches.length} XOR operations`);
    }
    
    // Look for the fcd552c4 hash
    if (bundle.includes('fcd552c4')) {
      console.log(`\n${filename}: Contains API hash 'fcd552c4'`);
      
      const hashIdx = bundle.indexOf('fcd552c4');
      const context = bundle.substring(Math.max(0, hashIdx - 300), hashIdx + 300);
      console.log(`  Context: ...${context}...`);
    }
  }
}

async function extractEncoderFunction() {
  console.log('\n=== EXTRACTING ENCODER FUNCTION ===\n');
  
  // Based on analysis, the encoder is likely in the page-specific bundle
  // Let's fetch the _app bundle which often contains shared utilities
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  // Find the _app bundle
  const appBundleMatch = html.match(/\/_next\/static\/chunks\/pages\/_app[^"]+\.js/);
  if (appBundleMatch) {
    console.log('Found _app bundle:', appBundleMatch[0]);
    const bundle = await fetchBundle(appBundleMatch[0]);
    
    // Search for encoding-related code
    // The encoder likely:
    // 1. Takes the page data
    // 2. Transforms it
    // 3. Adds 'p' delimiters
    // 4. Returns the API-ready string
    
    // Look for functions that return strings with 'p'
    const funcPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*return[^}]*["']p["'][^}]*\}/g;
    const funcMatches = bundle.match(funcPattern);
    if (funcMatches) {
      console.log('Found functions returning strings with "p":');
      funcMatches.forEach(m => console.log(`  ${m.substring(0, 300)}...`));
    }
    
    // Look for the specific encoding pattern
    // The output has format: [chars]p[chars]p[chars]p...
    // This suggests a function that builds this pattern
    
    // Search for string concatenation with 'p'
    const concatPattern = /(\w+)\s*=\s*(\w+)\s*\+\s*["']p["']\s*\+/g;
    const concatMatches = bundle.match(concatPattern);
    if (concatMatches) {
      console.log('\nFound string concatenation with "p":');
      concatMatches.forEach(m => {
        const idx = bundle.indexOf(m);
        const context = bundle.substring(Math.max(0, idx - 100), idx + 200);
        console.log(`  ${context.substring(0, 300)}...`);
      });
    }
  }
  
  // Also check the main chunks
  const chunkPaths = html.match(/\/_next\/static\/chunks\/\d+[^"]+\.js/g) || [];
  for (const path of chunkPaths.slice(0, 5)) {
    const bundle = await fetchBundle(path);
    const filename = path.split('/').pop();
    
    // Look for the encoding function by searching for specific patterns
    // The function likely uses: split, map, join, charCodeAt
    
    if (bundle.includes('.split("")') && bundle.includes('.map(') && bundle.includes('charCodeAt')) {
      console.log(`\n${filename}: Contains split/map/charCodeAt pattern`);
      
      // Find the function
      const splitMapIdx = bundle.indexOf('.split("")');
      if (splitMapIdx >= 0) {
        // Go back to find the function start
        let funcStart = splitMapIdx;
        while (funcStart > 0 && bundle[funcStart] !== '{') {
          funcStart--;
        }
        // Go back more to find function keyword
        while (funcStart > 0 && !bundle.substring(funcStart - 20, funcStart).includes('function')) {
          funcStart--;
        }
        
        const context = bundle.substring(Math.max(0, funcStart - 50), splitMapIdx + 300);
        console.log(`  Context: ${context}`);
      }
    }
  }
}

async function main() {
  await findEncoderInBundle();
  await analyzeAllBundles();
  await searchForSpecificPatterns();
  await extractEncoderFunction();
}

main().catch(console.error);
