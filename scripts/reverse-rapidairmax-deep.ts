/**
 * Deep analysis of rapidairmax app.js
 * Focus on finding the decryption and video source setup
 */

const fs = require('fs');

function analyzeObfuscation(code: string): void {
  console.log('=== Obfuscation Analysis ===\n');
  
  // Find the main obfuscation array/object
  const w3Match = code.match(/W3\s*=\s*\{[^}]+\}/);
  if (w3Match) {
    console.log('W3 object definition found');
  }
  
  // Look for the string array that holds obfuscated strings
  const stringArrayMatch = code.match(/\[['"][^'"]{1,50}['"](?:,['"][^'"]{1,50}['"]\s*){10,}\]/);
  if (stringArrayMatch) {
    console.log('String array found, length:', stringArrayMatch[0].length);
    console.log('First 500 chars:', stringArrayMatch[0].substring(0, 500));
  }
  
  // Find u6JBF which seems to be the main obfuscation namespace
  const u6JBFMatch = code.match(/u6JBF\s*=\s*[^;]+/);
  if (u6JBFMatch) {
    console.log('\nu6JBF definition:', u6JBFMatch[0].substring(0, 200));
  }
  
  // Look for the decoder function
  const decoderMatch = code.match(/function\s+\w+\s*\(\s*\w+\s*\)\s*\{[^}]*return[^}]*String\.fromCharCode[^}]+\}/);
  if (decoderMatch) {
    console.log('\nDecoder function found:', decoderMatch[0].substring(0, 300));
  }
}

function findVideoSetup(code: string): void {
  console.log('\n\n=== Video Setup Analysis ===\n');
  
  // Look for jwplayer or video player setup
  const playerSetup = code.match(/setup\s*\(\s*\{[^}]{100,500}\}/g);
  if (playerSetup) {
    console.log('Player setup calls found:', playerSetup.length);
    playerSetup.slice(0, 3).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.substring(0, 200)}...`);
    });
  }
  
  // Look for sources array
  const sourcesMatch = code.match(/sources\s*:\s*\[[^\]]{50,500}\]/g);
  if (sourcesMatch) {
    console.log('\nSources arrays found:', sourcesMatch.length);
    sourcesMatch.slice(0, 3).forEach((s, i) => {
      console.log(`\n${i + 1}. ${s.substring(0, 200)}...`);
    });
  }
  
  // Look for file property assignment
  const fileMatch = code.match(/file\s*:\s*[^,}\]]{10,100}/g);
  if (fileMatch) {
    console.log('\nFile property assignments:', fileMatch.length);
    fileMatch.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
}

function findDecryptFunction(code: string): void {
  console.log('\n\n=== Decrypt Function Search ===\n');
  
  // Look for functions that take a single string parameter and return a string
  // These are likely decryption functions
  
  // Find all function definitions
  const funcRegex = /(\w+)\s*=\s*function\s*\((\w+)\)\s*\{([^}]{50,500})\}/g;
  let match;
  const candidates: string[] = [];
  
  while ((match = funcRegex.exec(code)) !== null) {
    const [, name, param, body] = match;
    // Check if body contains string manipulation
    if (body.includes('charCodeAt') || body.includes('fromCharCode') || 
        body.includes('split') || body.includes('^') || body.includes('substring')) {
      candidates.push(`${name}(${param}): ${body.substring(0, 100)}...`);
    }
  }
  
  console.log('Candidate decryption functions:', candidates.length);
  candidates.slice(0, 10).forEach((c, i) => console.log(`\n${i + 1}. ${c}`));
  
  // Look for XOR-based decryption (common pattern)
  const xorDecrypt = code.match(/\w+\.charCodeAt\([^)]+\)\s*\^\s*\w+\.charCodeAt\([^)]+\)/g);
  if (xorDecrypt) {
    console.log('\n\nXOR decryption patterns:', xorDecrypt.length);
    xorDecrypt.slice(0, 5).forEach((x, i) => console.log(`  ${i + 1}. ${x}`));
  }
}

function extractKeyLogic(code: string): void {
  console.log('\n\n=== Key/Secret Extraction ===\n');
  
  // Look for hardcoded strings that could be keys
  const longStrings = code.match(/['"][A-Za-z0-9+/=]{20,100}['"]/g);
  if (longStrings) {
    console.log('Long strings (potential keys):');
    const unique = Array.from(new Set(longStrings));
    unique.slice(0, 20).forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }
  
  // Look for the window.__$ token usage (from the HTML)
  const windowTokenMatch = code.match(/window\.__\$[^;]{0,100}/g);
  if (windowTokenMatch) {
    console.log('\n\nwindow.__$ usage:');
    windowTokenMatch.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  }
}

function findAjaxCalls(code: string): void {
  console.log('\n\n=== AJAX/Fetch Calls ===\n');
  
  // Look for fetch or XMLHttpRequest
  const fetchMatch = code.match(/fetch\s*\([^)]{10,200}\)/g);
  if (fetchMatch) {
    console.log('Fetch calls:', fetchMatch.length);
    fetchMatch.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f.substring(0, 100)}`));
  }
  
  const xhrMatch = code.match(/XMLHttpRequest|\.open\s*\([^)]+\)|\.send\s*\([^)]*\)/g);
  if (xhrMatch) {
    console.log('\nXHR patterns:', xhrMatch.length);
  }
  
  // Look for API endpoints
  const apiMatch = code.match(/['"]\/api\/[^'"]+['"]/g);
  if (apiMatch) {
    console.log('\nAPI endpoints:');
    apiMatch.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
  }
}

function searchForSpecificPatterns(code: string): void {
  console.log('\n\n=== Specific Pattern Search ===\n');
  
  // Search for rrr.rapid pattern (the m3u8 domain)
  const rrrMatch = code.match(/rrr[^;]{0,50}/gi);
  if (rrrMatch) {
    console.log('rrr patterns:', rrrMatch);
  }
  
  // Search for pmjz (path in m3u8 URL)
  const pmjzMatch = code.match(/pmjz[^;]{0,50}/gi);
  if (pmjzMatch) {
    console.log('pmjz patterns:', pmjzMatch);
  }
  
  // Search for list.m3u8
  const listMatch = code.match(/list\.m3u8[^;]{0,50}/gi);
  if (listMatch) {
    console.log('list.m3u8 patterns:', listMatch);
  }
  
  // Look for domain construction
  const domainMatch = code.match(/['"]https?:\/\/['"]?\s*\+/g);
  if (domainMatch) {
    console.log('\nDomain concatenation patterns:', domainMatch.length);
  }
}

async function main() {
  const code = fs.readFileSync('rapidairmax-app.js', 'utf8');
  
  analyzeObfuscation(code);
  findVideoSetup(code);
  findDecryptFunction(code);
  extractKeyLogic(code);
  findAjaxCalls(code);
  searchForSpecificPatterns(code);
  
  // Also search in the beautified version for better context
  console.log('\n\n=== Searching beautified version ===');
  const beautified = fs.readFileSync('rapidairmax-app-beautified.js', 'utf8');
  
  // Find lines containing interesting keywords
  const lines = beautified.split('\n');
  const interestingLines = lines.filter((l: string) => 
    l.includes('PAGE_DATA') || l.includes('decrypt') || l.includes('source') ||
    l.includes('file') || l.includes('m3u8') || l.includes('setup')
  );
  
  console.log('\nInteresting lines:', interestingLines.length);
  interestingLines.slice(0, 20).forEach((l: string, i: number) => {
    console.log(`${i + 1}. ${l.trim().substring(0, 100)}`);
  });
}

main().catch(console.error);
