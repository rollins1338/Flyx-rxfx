const fs = require('fs');

/**
 * Analyze the player page HTML to find the decoder function
 */

const html = fs.readFileSync('player-page.html', 'utf8');

console.log('🔍 Analyzing player page for decoder...\n');
console.log(`Page size: ${html.length} bytes\n`);

// Extract all script tags
const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
console.log(`Found ${scriptMatches ? scriptMatches.length : 0} script tags\n`);

if (!scriptMatches) {
  console.log('No scripts found!');
  process.exit(1);
}

// Analyze each script
const relevantScripts = [];

scriptMatches.forEach((scriptTag, i) => {
  const content = scriptTag.replace(/<\/?script[^>]*>/gi, '').trim();
  
  // Check if this script is relevant to decoding
  const hasAtob = content.includes('atob');
  const hasDecode = content.includes('decode') || content.includes('Decode');
  const hasPjsdiv = content.includes('pjsdiv') || content.includes('getElementById');
  const hasXor = content.includes('^') && content.includes('charCodeAt');
  const hasReverse = content.includes('reverse');
  const hasReplace = content.includes('replace');
  
  if (hasAtob || hasDecode || hasPjsdiv || hasXor) {
    relevantScripts.push({
      index: i + 1,
      length: content.length,
      hasAtob,
      hasDecode,
      hasPjsdiv,
      hasXor,
      hasReverse,
      hasReplace,
      content
    });
  }
});

console.log(`Found ${relevantScripts.length} relevant scripts\n`);
console.log('='.repeat(80));

relevantScripts.forEach((script, i) => {
  console.log(`\nScript ${script.index}:`);
  console.log(`  Length: ${script.length}`);
  console.log(`  Has atob: ${script.hasAtob}`);
  console.log(`  Has decode: ${script.hasDecode}`);
  console.log(`  Has pjsdiv: ${script.hasPjsdiv}`);
  console.log(`  Has XOR: ${script.hasXor}`);
  console.log(`  Has reverse: ${script.hasReverse}`);
  console.log(`  Has replace: ${script.hasReplace}`);
  console.log('\n  Content preview:');
  console.log('  ' + '-'.repeat(76));
  console.log('  ' + script.content.substring(0, 1000).replace(/\n/g, '\n  '));
  console.log('  ' + '-'.repeat(76));
  
  // Save full script
  fs.writeFileSync(`script-${script.index}.js`, script.content);
  console.log(`  💾 Saved to: script-${script.index}.js`);
});

// Look for the specific decoder pattern
console.log('\n' + '='.repeat(80));
console.log('🔍 SEARCHING FOR DECODER PATTERNS');
console.log('='.repeat(80) + '\n');

relevantScripts.forEach((script) => {
  // Look for function that processes pjsdiv
  const pjsdivPattern = /getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)[^;]*textContent/g;
  let match;
  
  while ((match = pjsdivPattern.exec(script.content)) !== null) {
    console.log(`Found pjsdiv access in Script ${script.index}:`);
    const start = Math.max(0, match.index - 200);
    const end = Math.min(script.content.length, match.index + 300);
    console.log(script.content.substring(start, end));
    console.log('\n');
  }
  
  // Look for atob calls
  const atobPattern = /atob\s*\([^)]+\)/g;
  const atobMatches = script.content.match(atobPattern);
  if (atobMatches) {
    console.log(`Found ${atobMatches.length} atob calls in Script ${script.index}`);
    atobMatches.slice(0, 3).forEach(m => console.log(`  ${m}`));
    console.log('');
  }
});

console.log('\n✅ Analysis complete. Check the saved script files for full content.\n');
