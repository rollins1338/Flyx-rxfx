/**
 * Deobfuscate Vidora player script to find stream URLs
 */

const fs = require('fs');

// Read the HTML
const html = fs.readFileSync('source-testing/vidora-response.html', 'utf8');

// Extract the packed script
const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{[^}]+\}[^)]+\)/);

if (!packedMatch) {
  console.log('No packed script found');
  process.exit(1);
}

console.log('=== FOUND PACKED SCRIPT ===\n');
console.log(`Length: ${packedMatch[0].length} chars\n`);

// The packer function - we'll execute it to get the unpacked code
function unpack(p, a, c, k, e, d) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

// Extract the parameters from the packed script
const paramsMatch = packedMatch[0].match(/eval\(function\(p,a,c,k,e,d\)\{while\(c--\)if\(k\[c\]\)p=p\.replace\(new RegExp\('\\\\b'\+c\.toString\(a\)\+'\\\\b','g'\),k\[c\]\);return p\}\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);

if (!paramsMatch) {
  console.log('Could not extract parameters');
  
  // Try alternative extraction
  const altMatch = html.match(/<script type='text\/javascript'>eval\(function\(p,a,c,k,e,d\)\{[^}]+\}\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
  
  if (altMatch) {
    console.log('Found with alternative pattern');
    const [, p, a, c, words] = altMatch;
    const k = words.split('|');
    const unpacked = unpack(p, parseInt(a), parseInt(c), k);
    console.log('\n=== UNPACKED SCRIPT ===\n');
    console.log(unpacked);
  }
  
  process.exit(1);
}

const [, p, a, c, words] = paramsMatch;
const k = words.split('|');

console.log(`Parameters: a=${a}, c=${c}, words=${k.length}`);

// Unpack
const unpacked = unpack(p, parseInt(a), parseInt(c), k);

console.log('\n=== UNPACKED SCRIPT ===\n');
console.log(unpacked);

// Save unpacked script
fs.writeFileSync('source-testing/vidora-unpacked.js', unpacked);
console.log('\nSaved to: source-testing/vidora-unpacked.js');

// Look for stream URLs
console.log('\n=== STREAM URLS ===');
const streamPatterns = [
  /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi,
  /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/gi,
  /file\s*:\s*["']([^"']+)["']/gi,
  /sources\s*:\s*\[([^\]]+)\]/gi,
];

for (const pattern of streamPatterns) {
  let match;
  while ((match = pattern.exec(unpacked)) !== null) {
    console.log(`  ${match[0]}`);
  }
}

// Look for the actual video URL
console.log('\n=== VIDEO URL EXTRACTION ===');
const videoUrlMatch = unpacked.match(/["']([^"']*(?:master|index)\.m3u8[^"']*)["']/i);
if (videoUrlMatch) {
  console.log(`Found video URL: ${videoUrlMatch[1]}`);
}

// Look for CDN URLs
const cdnMatch = unpacked.match(/https?:\/\/[^"'\s]*(?:cdn|hls|stream)[^"'\s]*/gi);
if (cdnMatch) {
  console.log('\nCDN URLs:');
  for (const url of cdnMatch) {
    console.log(`  ${url}`);
  }
}
