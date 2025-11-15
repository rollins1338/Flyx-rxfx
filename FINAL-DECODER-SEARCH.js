const fs = require('fs');

/**
 * FINAL COMPREHENSIVE SEARCH
 * The div ID "xTyBxQyGTA" is used as a variable name
 * There MUST be code that does: window["xTyBxQyGTA"] = decode(divContent)
 */

const html = fs.readFileSync('player-page.html', 'utf8');

console.log('🔍 FINAL COMPREHENSIVE DECODER SEARCH\n');

// Strategy: The variable must be defined BEFORE it's used in PlayerJS init
// Find where PlayerJS is initialized
const playerInitIndex = html.indexOf('var player = new Playerjs');
const htmlBeforeInit = html.substring(0, playerInitIndex);

console.log(`HTML before PlayerJS init: ${htmlBeforeInit.length} bytes\n`);

// Extract all inline scripts before init
const scriptsBefore = htmlBeforeInit.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];

console.log(`Scripts before init: ${scriptsBefore.length}\n`);

// Check each script
let found = false;

scriptsBefore.forEach((scriptTag, i) => {
  const content = scriptTag.replace(/<\/?script[^>]*>/gi, '').trim();
  
  // Skip external scripts
  if (!content || content.length < 10) return;
  
  // Look for any code that might decode the div
  const patterns = [
    /getElementById\(['"](pjsdiv[^'"]+)['"]\)/,
    /textContent/,
    /atob/,
    /window\[/,
    /eval/,
    /Function/
  ];
  
  const matches = patterns.map(p => p.test(content));
  const relevance = matches.filter(Boolean).length;
  
  if (relevance >= 2) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`RELEVANT SCRIPT ${i + 1} (relevance: ${relevance}/6):`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(content);
    console.log('\n');
    
    fs.writeFileSync(`relevant-script-${i + 1}.js`, content);
    found = true;
  }
});

if (!found) {
  console.log('❌ No obvious decoder found in inline scripts\n');
  console.log('The decoder might be:');
  console.log('1. In an external script that runs on DOMContentLoaded');
  console.log('2. Obfuscated/minified beyond recognition');
  console.log('3. Using a different pattern we haven\'t searched for\n');
  
  // Last resort: search for ANY code that mentions the div ID
  console.log('Searching for ANY mention of div IDs starting with "pjsdiv"...\n');
  
  const pjsdivPattern = /pjsdiv[a-zA-Z0-9]+/g;
  const allMatches = html.match(pjsdivPattern) || [];
  const uniqueMatches = [...new Set(allMatches)];
  
  console.log(`Found ${uniqueMatches.length} unique pjsdiv references:`);
  uniqueMatches.forEach(m => console.log(`  - ${m}`));
  
  // Check if the variable is defined globally somewhere
  console.log('\n\nSearching for global variable definitions...\n');
  
  const varPattern = new RegExp(`(var|let|const|window\\.)\\s*${uniqueMatches[0]}`, 'g');
  const varMatches = html.match(varPattern);
  
  if (varMatches) {
    console.log(`Found ${varMatches.length} variable definitions:`);
    varMatches.forEach(m => console.log(`  ${m}`));
  } else {
    console.log('❌ No explicit variable definition found');
    console.log('\nThis means the variable is likely created dynamically by:');
    console.log('1. eval() or Function() constructor');
    console.log('2. A script that iterates all divs and creates variables');
    console.log('3. PlayerJS itself reading the div internally\n');
  }
}

console.log('\n✅ Search complete\n');
