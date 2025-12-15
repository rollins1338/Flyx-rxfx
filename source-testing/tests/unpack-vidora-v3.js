/**
 * Unpack Vidora script v3
 */

const fs = require('fs');

const html = fs.readFileSync('source-testing/vidora-response.html', 'utf8');

// Find the eval script
const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
const evalEnd = html.indexOf("</script>", evalStart);
const evalScript = html.substring(evalStart, evalEnd);

console.log('Eval script length:', evalScript.length);

// Find the word list - it's the last part before .split('|')
const splitIdx = evalScript.lastIndexOf(".split('|')");
const wordListStart = evalScript.lastIndexOf(",'", splitIdx) + 2;
const wordListEnd = splitIdx;
const wordStr = evalScript.substring(wordListStart, wordListEnd);
const words = wordStr.split('|');

console.log('Words:', words.length);

// Find base and count - they're before the word list
const beforeWords = evalScript.substring(0, wordListStart - 2);
const numbersMatch = beforeWords.match(/,(\d+),(\d+)$/);

if (!numbersMatch) {
  console.log('Could not find base and count');
  console.log('Before words ends with:', beforeWords.slice(-50));
  process.exit(1);
}

const base = parseInt(numbersMatch[1]);
const count = parseInt(numbersMatch[2]);

console.log('Base:', base);
console.log('Count:', count);

// Find packed code - it's between }(' and ',base,count
const packedStart = evalScript.indexOf("('") + 2;
const packedEnd = evalScript.indexOf("'," + base + "," + count);
const packed = evalScript.substring(packedStart, packedEnd);

console.log('Packed length:', packed.length);
console.log('Packed preview:', packed.substring(0, 200));

// Unpack
let unpacked = packed;
let c = count;

while (c--) {
  if (words[c]) {
    unpacked = unpacked.replace(new RegExp('\\b' + c.toString(base) + '\\b', 'g'), words[c]);
  }
}

console.log('\n=== UNPACKED ===\n');
console.log(unpacked);

// Save
fs.writeFileSync('source-testing/vidora-unpacked-final.js', unpacked);
console.log('\nSaved to: source-testing/vidora-unpacked-final.js');

// Extract stream URL
const fileMatch = unpacked.match(/file:"([^"]+)"/);
if (fileMatch) {
  console.log('\n=== STREAM URL ===');
  console.log(fileMatch[1]);
}
