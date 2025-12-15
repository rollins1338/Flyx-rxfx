/**
 * Extract exact URL from Vidora packed script
 */

const fs = require('fs');

// Read the HTML
const html = fs.readFileSync('source-testing/vidora-response.html', 'utf8');

// Find the packed script content
const packedMatch = html.match(/'([^']{1000,})'\.split\('\|'\)/);

if (!packedMatch) {
  console.log('Could not find packed content');
  process.exit(1);
}

// Get the packed code (before the word list)
const fullMatch = html.match(/\}\('([^']+)',(\d+),(\d+),'([^']+)'\.split/);

if (!fullMatch) {
  console.log('Could not find full packed pattern');
  
  // Try to find the script tag content
  const scriptMatch = html.match(/<script type='text\/javascript'>(eval\(function[^<]+)<\/script>/);
  if (scriptMatch) {
    console.log('Found script tag');
    console.log(scriptMatch[1].substring(0, 500));
  }
  
  process.exit(1);
}

const [, packed, base, count, wordStr] = fullMatch;
const words = wordStr.split('|');

console.log(`Packed code length: ${packed.length}`);
console.log(`Base: ${base}, Count: ${count}, Words: ${words.length}`);

// Show the packed code
console.log('\n=== PACKED CODE (first 500 chars) ===');
console.log(packed.substring(0, 500));

// Unpack
let unpacked = packed;
let c = parseInt(count);
const a = parseInt(base);

while (c--) {
  if (words[c]) {
    unpacked = unpacked.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), words[c]);
  }
}

console.log('\n=== UNPACKED CODE ===');
console.log(unpacked);

// Save
fs.writeFileSync('source-testing/vidora-unpacked-full.js', unpacked);
console.log('\nSaved to: source-testing/vidora-unpacked-full.js');

// Look for the sources array
const sourcesMatch = unpacked.match(/sources:\s*\[([^\]]+)\]/);
if (sourcesMatch) {
  console.log('\n=== SOURCES ===');
  console.log(sourcesMatch[0]);
}

// Look for file property
const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/);
if (fileMatch) {
  console.log('\n=== FILE URL ===');
  console.log(fileMatch[1]);
}
