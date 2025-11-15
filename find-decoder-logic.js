const fs = require('fs');

const playerPage = fs.readFileSync('player-page-full.html', 'utf8');

console.log('Searching for decoder logic...\n');

// The encoded data has 'g' and ':' characters
// Let's find any script that might decode this format

// Search for scripts that manipulate strings with these characters
const patterns = [
  /replace\(['"\/]g['"\/]/gi,  // .replace(/g/...)
  /replace\(['"]:/gi,           // .replace(':')
  /\.replace\([^)]*g[^)]*\)/gi, // any replace with 'g'
  /\.replace\([^)]*:[^)]*\)/gi, // any replace with ':'
  /fromCharCode/gi,
  /charCodeAt/gi,
  /parseInt.*16/gi,             // hex parsing
  /toString\(16\)/gi,           // to hex
];

for (const pattern of patterns) {
  const matches = [...playerPage.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`\nFound ${matches.length} matches for pattern: ${pattern}`);
    matches.slice(0, 5).forEach((m, i) => {
      // Get context around the match
      const start = Math.max(0, m.index - 100);
      const end = Math.min(playerPage.length, m.index + m[0].length + 100);
      const context = playerPage.substring(start, end);
      console.log(`\n  Match ${i + 1}:`);
      console.log(`  ${context.replace(/\n/g, ' ').substring(0, 200)}`);
    });
  }
}

// Also search for any inline scripts (not in <script> tags)
console.log('\n\n=== Searching for inline event handlers ===');
const inlineHandlers = [
  ...playerPage.matchAll(/on\w+="([^"]+)"/gi),
  ...playerPage.matchAll(/on\w+='([^']+)'/gi),
];

if (inlineHandlers.length > 0) {
  console.log(`Found ${inlineHandlers.length} inline handlers`);
  inlineHandlers.slice(0, 10).forEach((m, i) => {
    console.log(`\n  ${i + 1}. ${m[0].substring(0, 150)}`);
  });
}

// Search for any script src attributes
console.log('\n\n=== External Scripts ===');
const externalScripts = [...playerPage.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
console.log(`Found ${externalScripts.length} external scripts:`);
externalScripts.forEach((m, i) => {
  console.log(`  ${i + 1}. ${m[1]}`);
});
