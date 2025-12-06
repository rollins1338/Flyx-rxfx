/**
 * Reverse engineer rapidairmax.site app.js to extract PAGE_DATA decryption
 */

const fs = require('fs');

async function fetchAppJs(): Promise<string> {
  const url = 'https://rapidshare.cc/assets/b/2457433dff948487f3bb6d58f9db2a11/min/app.js?v=19a76d77646';
  console.log('Fetching app.js from:', url);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://rapidshare.cc/'
    }
  });
  
  return res.text();
}

function deobfuscate(code: string): void {
  console.log('\n=== Analyzing app.js ===');
  console.log('Total length:', code.length);
  
  // Look for PAGE_DATA usage
  const pageDataMatches = code.match(/__PAGE_DATA[^;]{0,200}/g);
  console.log('\n__PAGE_DATA references:', pageDataMatches?.length || 0);
  pageDataMatches?.slice(0, 5).forEach((m, i) => console.log(`  ${i + 1}. ${m.substring(0, 100)}`));
  
  // Look for decryption-related patterns
  const cryptoPatterns = [
    /CryptoJS[^;]{0,100}/g,
    /AES[^;]{0,100}/g,
    /decrypt[^;]{0,100}/gi,
    /atob[^;]{0,100}/g,
    /btoa[^;]{0,100}/g,
    /fromCharCode[^;]{0,100}/g,
    /charCodeAt[^;]{0,100}/g,
  ];
  
  console.log('\n=== Crypto patterns ===');
  for (const pattern of cryptoPatterns) {
    const matches = code.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`\n${pattern.source}:`);
      matches.slice(0, 3).forEach(m => console.log(`  - ${m.substring(0, 80)}`));
    }
  }
  
  // Look for jwplayer setup
  const jwMatches = code.match(/jwplayer[^;]{0,200}/gi);
  console.log('\n=== JWPlayer references ===');
  jwMatches?.slice(0, 5).forEach((m, i) => console.log(`  ${i + 1}. ${m.substring(0, 100)}`));
  
  // Look for file/source patterns
  const sourcePatterns = code.match(/["']file["']\s*:/gi);
  console.log('\n=== File/source patterns ===');
  console.log('  "file": occurrences:', sourcePatterns?.length || 0);
  
  // Look for m3u8 references
  const m3u8Matches = code.match(/m3u8[^;]{0,100}/gi);
  console.log('\n=== M3U8 references ===');
  m3u8Matches?.slice(0, 5).forEach((m, i) => console.log(`  ${i + 1}. ${m.substring(0, 80)}`));
  
  // Look for URL construction patterns
  const urlPatterns = code.match(/https?:\/\/[^"'\s]{10,100}/g);
  console.log('\n=== URL patterns ===');
  const uniqueUrls = Array.from(new Set(urlPatterns || []));
  uniqueUrls.slice(0, 10).forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  
  // Look for base64 alphabet or custom encoding
  const base64Alphabet = code.match(/[A-Za-z0-9+\/=]{64,}/g);
  console.log('\n=== Potential base64 alphabets ===');
  base64Alphabet?.slice(0, 3).forEach((a, i) => console.log(`  ${i + 1}. ${a.substring(0, 70)}...`));
  
  // Find function definitions that might be decryption
  const funcMatches = code.match(/function\s*\w*\s*\([^)]*\)\s*\{[^}]{50,300}\}/g);
  console.log('\n=== Interesting functions (with crypto-like operations) ===');
  funcMatches?.filter(f => 
    f.includes('charCodeAt') || f.includes('fromCharCode') || 
    f.includes('atob') || f.includes('btoa') || f.includes('^')
  ).slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. ${f.substring(0, 150)}...`));
}

function extractDecryptionLogic(code: string): void {
  console.log('\n\n=== Extracting Decryption Logic ===');
  
  // The code is heavily obfuscated with u6JBF array
  // Look for the main decryption function
  
  // Find where __PAGE_DATA is used
  const pageDataIndex = code.indexOf('__PAGE_DATA');
  if (pageDataIndex > -1) {
    const context = code.substring(Math.max(0, pageDataIndex - 500), pageDataIndex + 500);
    console.log('\n__PAGE_DATA context:');
    console.log(context.substring(0, 500));
  }
  
  // Look for the setup function that processes PAGE_DATA
  const setupMatch = code.match(/setup\s*\([^)]*__PAGE_DATA[^)]*\)/);
  if (setupMatch) {
    console.log('\nSetup with PAGE_DATA:', setupMatch[0]);
  }
  
  // Find XOR operations (common in obfuscation)
  const xorMatches = code.match(/\^\s*\d+|\d+\s*\^/g);
  console.log('\nXOR operations found:', xorMatches?.length || 0);
  
  // Look for string manipulation that could be decryption
  const stringOps = code.match(/\.split\([^)]+\)\.map\([^)]+\)/g);
  console.log('\nString split+map operations:', stringOps?.length || 0);
  stringOps?.slice(0, 3).forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}

function findKeyPatterns(code: string): void {
  console.log('\n\n=== Looking for Key/IV Patterns ===');
  
  // Look for hex strings that could be keys
  const hexStrings = code.match(/['"][0-9a-fA-F]{16,64}['"]/g);
  console.log('\nPotential hex keys:');
  hexStrings?.slice(0, 10).forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
  
  // Look for repeated character patterns (could be padding)
  const paddingPatterns = code.match(/['"](.)\1{7,}['"]/g);
  console.log('\nPotential padding patterns:');
  paddingPatterns?.slice(0, 5).forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
}

async function main() {
  // First check if we have the file cached
  let code: string;
  
  if (fs.existsSync('rapidairmax-app.js')) {
    console.log('Using cached app.js');
    code = fs.readFileSync('rapidairmax-app.js', 'utf8');
  } else {
    code = await fetchAppJs();
    fs.writeFileSync('rapidairmax-app.js', code);
    console.log('Saved to rapidairmax-app.js');
  }
  
  deobfuscate(code);
  extractDecryptionLogic(code);
  findKeyPatterns(code);
  
  // Save a beautified version for manual analysis
  const beautified = code
    .replace(/;/g, ';\n')
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}\n');
  
  fs.writeFileSync('rapidairmax-app-beautified.js', beautified);
  console.log('\n\nSaved beautified version to rapidairmax-app-beautified.js');
}

main().catch(console.error);
