/**
 * Find how PAGE_DATA is used in the obfuscated code
 * by looking at the code structure around window.__PAGE_DATA
 */

const fs = require('fs');

function findPageDataUsage(): void {
  const code = fs.readFileSync('rapidshare-app.js', 'utf8');
  
  console.log('=== Finding PAGE_DATA Usage ===\n');
  
  // The PAGE_DATA is set in HTML, so the JS must read window.__PAGE_DATA
  // Look for window access patterns
  
  // Find all window property accesses
  const windowAccess = code.match(/window\[['"][^'"]+['"]\]/g);
  if (windowAccess) {
    const unique = Array.from(new Set(windowAccess));
    console.log('Window property accesses:');
    unique.forEach(w => console.log('  ', w));
  }
  
  // Look for __PAGE_DATA or similar patterns
  const pageDataPatterns = [
    /__PAGE_DATA/g,
    /PAGE_DATA/g,
    /_PAGE/g,
    /pageData/gi,
  ];
  
  for (const pattern of pageDataPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      console.log(`\n${pattern}: ${matches.length} matches`);
    }
  }
  
  // The obfuscated code uses W3.N4F and W3.N0M to decode strings
  // Let's find what strings are being decoded
  
  // Look for the string lookup table
  const lookupMatch = code.match(/W3\.N4F\((\d+)\)/g);
  if (lookupMatch) {
    const indices = lookupMatch.map(m => parseInt(m.match(/\d+/)![0]));
    const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
    console.log('\n\nW3.N4F indices used:', uniqueIndices.length);
    console.log('Range:', Math.min(...uniqueIndices), '-', Math.max(...uniqueIndices));
  }
  
  // Look for the actual string array initialization
  const stringArrayInit = code.match(/\["[^"]{1,20}"(?:,"[^"]{1,20}")+\]/);
  if (stringArrayInit) {
    console.log('\n\nString array found:');
    console.log(stringArrayInit[0].substring(0, 500));
  }
}

function analyzeW3Object(): void {
  const code = fs.readFileSync('rapidshare-app.js', 'utf8');
  
  console.log('\n\n=== Analyzing W3 Object ===\n');
  
  // Find W3 definition
  const w3Def = code.match(/W3\s*=\s*\{[^}]+\}/);
  if (w3Def) {
    console.log('W3 definition:');
    console.log(w3Def[0].substring(0, 500));
  }
  
  // Find the functions that W3 uses
  const w3Functions = code.match(/W3\.(\w+)\s*=\s*function/g);
  if (w3Functions) {
    console.log('\n\nW3 function definitions:');
    w3Functions.forEach(f => console.log('  ', f));
  }
}

function findSetupCall(): void {
  const code = fs.readFileSync('rapidshare-app.js', 'utf8');
  
  console.log('\n\n=== Finding Setup/Player Initialization ===\n');
  
  // Look for jwplayer setup pattern
  const setupPatterns = [
    /\.setup\s*\(/g,
    /jwplayer\s*\(/g,
    /player\s*\(/g,
    /sources\s*:/g,
    /file\s*:/g,
  ];
  
  for (const pattern of setupPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      console.log(`${pattern}: ${matches.length} matches`);
      
      // Find context around first match
      const idx = code.search(pattern);
      if (idx !== -1) {
        console.log('  Context:', code.substring(Math.max(0, idx - 50), idx + 100));
      }
    }
  }
}

function extractDecodedStrings(): void {
  console.log('\n\n=== Extracting Decoded Strings ===\n');
  
  // The V2AsvL function returns URL-encoded strings
  // Let's decode them and look for patterns
  
  const decoded = fs.readFileSync('rapidshare-decoded-strings.txt', 'utf8');
  
  // Split by common delimiters and look for meaningful strings
  const parts = decoded.split(/[^a-zA-Z0-9_]+/).filter(p => p.length > 3);
  const uniqueParts = Array.from(new Set(parts));
  
  console.log('Unique string parts (length > 3):');
  uniqueParts.slice(0, 50).forEach(p => console.log('  ', p));
  
  // Look for URL-like patterns
  const urlParts = decoded.match(/https?|www|\.com|\.cc|\.to|m3u8|mp4|stream|video|source|file|player|setup/gi);
  if (urlParts) {
    console.log('\n\nURL-related strings found:');
    Array.from(new Set(urlParts)).forEach(u => console.log('  ', u));
  }
}

findPageDataUsage();
analyzeW3Object();
findSetupCall();
extractDecodedStrings();
