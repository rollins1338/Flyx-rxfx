/**
 * Properly unpack Vidora script
 */

const fs = require('fs');

// Read the HTML
const html = fs.readFileSync('source-testing/vidora-response.html', 'utf8');

// Find the eval script - it's in a specific format
const evalMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{while\(c--\)if\(k\[c\]\)p=p\.replace\(new RegExp\('\\\\b'\+c\.toString\(a\)\+'\\\\b','g'\),k\[c\]\);return p\}\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);

if (!evalMatch) {
  console.log('Could not find eval pattern, trying alternative...');
  
  // The HTML might have the script in a different format
  // Let's look for the jwplayer setup directly
  const jwSetupMatch = html.match(/jwplayer\(['"]vplayer['"]\)\.setup\(\{/);
  if (jwSetupMatch) {
    console.log('Found jwplayer setup');
    const startIdx = html.indexOf(jwSetupMatch[0]);
    const endIdx = html.indexOf('});', startIdx) + 3;
    console.log(html.substring(startIdx, endIdx));
  }
  
  // Look for the packed data in the word list
  const wordListMatch = html.match(/'([^']+)'\.split\('\|'\)/);
  if (wordListMatch) {
    const words = wordListMatch[1].split('|');
    console.log(`\nFound ${words.length} words in packed script`);
    
    // Look for interesting words
    const interesting = words.filter(w => 
      w.includes('http') || 
      w.includes('m3u8') || 
      w.includes('hls') ||
      w.includes('hdflix') ||
      w.includes('master') ||
      w.length > 30
    );
    
    console.log('\nInteresting words:');
    for (const w of interesting) {
      console.log(`  ${w}`);
    }
    
    // Try to reconstruct the URL
    // Based on the words: hdflix, hls2, biz, m3u8, master, e5ccbb10n1xp_o, qic5T5iBi6J3t0L6BzKJi5paYylUvpfYH62KZPgT2p4
    const videoId = 'e5ccbb10n1xp';
    const token = 'qic5T5iBi6J3t0L6BzKJi5paYylUvpfYH62KZPgT2p4';
    
    // Common patterns for these streaming sites
    const possibleUrls = [
      `https://hls2.hdflix.biz/hls/${videoId}_o/master.m3u8?t=${token}`,
      `https://hls.hdflix.biz/${videoId}/master.m3u8?t=${token}`,
      `https://hls2.hdflix.biz/${videoId}/master.m3u8?t=${token}`,
      `https://ab.hdflix.biz/hls/${videoId}_o/master.m3u8?t=${token}`,
    ];
    
    console.log('\nPossible reconstructed URLs:');
    for (const url of possibleUrls) {
      console.log(`  ${url}`);
    }
  }
  
  process.exit(0);
}

const [, packed, base, count, wordStr] = evalMatch;
const words = wordStr.split('|');

console.log(`Found packed script: base=${base}, count=${count}, words=${words.length}`);

// Unpack
let unpacked = packed;
let c = parseInt(count);
const a = parseInt(base);

while (c--) {
  if (words[c]) {
    unpacked = unpacked.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), words[c]);
  }
}

console.log('\n=== UNPACKED SCRIPT ===\n');
console.log(unpacked);

// Save
fs.writeFileSync('source-testing/vidora-unpacked.js', unpacked);
console.log('\nSaved to: source-testing/vidora-unpacked.js');

// Extract stream URL
const streamMatch = unpacked.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
if (streamMatch) {
  console.log('\n=== STREAM URLS ===');
  for (const url of streamMatch) {
    console.log(`  ${url}`);
  }
}
