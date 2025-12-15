/**
 * Deobfuscate Vidora player script - v2
 */

const fs = require('fs');

// Read the HTML
const html = fs.readFileSync('source-testing/vidora-response.html', 'utf8');

console.log('=== SEARCHING FOR PACKED SCRIPTS ===\n');

// Find all script tags
const scriptPattern = /<script[^>]*>([^<]+eval\(function\(p,a,c,k,e,d\)[^<]+)<\/script>/gi;
let match;
let scriptNum = 0;

while ((match = scriptPattern.exec(html)) !== null) {
  scriptNum++;
  const script = match[1];
  console.log(`\nScript ${scriptNum} (${script.length} chars):`);
  console.log(script.substring(0, 200) + '...');
  
  // Try to extract and unpack
  try {
    // The script is: eval(function(p,a,c,k,e,d){...}('packed',base,count,'words'.split('|')))
    // We need to capture the inner function call
    
    const innerMatch = script.match(/eval\(function\(p,a,c,k,e,d\)\{while\(c--\)if\(k\[c\]\)p=p\.replace\(new RegExp\('\\\\b'\+c\.toString\(a\)\+'\\\\b','g'\),k\[c\]\);return p\}\('(.+)',(\d+),(\d+),'(.+)'\.split\('\|'\)/s);
    
    if (innerMatch) {
      const [, packed, base, count, words] = innerMatch;
      const wordList = words.split('|');
      
      console.log(`\n  Base: ${base}, Count: ${count}, Words: ${wordList.length}`);
      
      // Unpack
      let unpacked = packed;
      let c = parseInt(count);
      const a = parseInt(base);
      
      while (c--) {
        if (wordList[c]) {
          unpacked = unpacked.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), wordList[c]);
        }
      }
      
      console.log('\n=== UNPACKED ===');
      console.log(unpacked.substring(0, 2000));
      
      // Save
      fs.writeFileSync(`source-testing/vidora-unpacked-${scriptNum}.js`, unpacked);
      console.log(`\nSaved to: source-testing/vidora-unpacked-${scriptNum}.js`);
      
      // Look for stream URLs
      console.log('\n=== STREAM URLS ===');
      const m3u8Match = unpacked.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
      if (m3u8Match) {
        for (const url of m3u8Match) {
          console.log(`  ${url}`);
        }
      }
      
      // Look for sources array
      const sourcesMatch = unpacked.match(/sources:\s*\[([^\]]+)\]/);
      if (sourcesMatch) {
        console.log(`\nSources: ${sourcesMatch[0]}`);
      }
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

// Also look for jwplayer setup directly
console.log('\n\n=== JWPLAYER SETUP ===');
const jwMatch = html.match(/jwplayer\([^)]+\)\.setup\(\{([^}]+)\}/);
if (jwMatch) {
  console.log(jwMatch[0]);
}

// Look for any m3u8 URLs in the entire HTML
console.log('\n=== ALL M3U8 URLS IN HTML ===');
const allM3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
if (allM3u8) {
  for (const url of allM3u8) {
    console.log(`  ${url}`);
  }
} else {
  console.log('  None found directly');
}

// Look for hdflix or similar CDN
console.log('\n=== CDN REFERENCES ===');
const cdnPatterns = [
  /hdflix[^"'\s]*/gi,
  /streamsb[^"'\s]*/gi,
  /hls[^"'\s]*\.biz[^"'\s]*/gi,
];

for (const pattern of cdnPatterns) {
  const matches = html.match(pattern);
  if (matches) {
    for (const m of matches) {
      console.log(`  ${m}`);
    }
  }
}
