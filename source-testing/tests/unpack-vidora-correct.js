/**
 * Correctly unpack Vidora script
 */

const fs = require('fs');

// Read the HTML
const html = fs.readFileSync('source-testing/vidora-response.html', 'utf8');

// Find the eval script - need to handle the escaped quotes
const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
const evalEnd = html.indexOf("</script>", evalStart);

if (evalStart === -1) {
  console.log('Could not find eval');
  process.exit(1);
}

const evalScript = html.substring(evalStart, evalEnd);
console.log(`Found eval script: ${evalScript.length} chars`);

// Extract using a more flexible regex
const match = evalScript.match(/\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);

if (!match) {
  console.log('Could not match pattern');
  console.log('Script preview:', evalScript.substring(0, 500));
  process.exit(1);
}

const [, packed, base, count, wordStr] = match;
const words = wordStr.split('|');

console.log(`Base: ${base}, Count: ${count}, Words: ${words.length}`);
console.log(`Packed length: ${packed.length}`);

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
fs.writeFileSync('source-testing/vidora-unpacked-correct.js', unpacked);
console.log('\nSaved to: source-testing/vidora-unpacked-correct.js');

// Extract the stream URL
const urlMatch = unpacked.match(/file:"([^"]+)"/);
if (urlMatch) {
  console.log('\n=== STREAM URL ===');
  console.log(urlMatch[1]);
}

// Look for sources array
const sourcesMatch = unpacked.match(/sources:\[([^\]]+)\]/);
if (sourcesMatch) {
  console.log('\n=== SOURCES ===');
  console.log(sourcesMatch[0]);
}
