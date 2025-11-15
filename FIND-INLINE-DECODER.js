const fs = require('fs');

/**
 * Find the inline decoder in the player page
 * The div ID is used as a variable name, so there must be a script
 * that reads the div content and assigns it to window[divId]
 */

const html = fs.readFileSync('player-page.html', 'utf8');

console.log('🔍 Searching for inline decoder in player page...\n');

// Extract ALL scripts
const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);

console.log(`Found ${scriptMatches.length} scripts\n`);

// Look for scripts that mention the div ID or do decoding
scriptMatches.forEach((scriptTag, i) => {
  const content = scriptTag.replace(/<\/?script[^>]*>/gi, '').trim();
  
  // Check if this script does any decoding or variable assignment
  const hasWindowAssignment = /window\[/.test(content);
  const hasVarDeclaration = /var\s+xTyBxQyGTA/.test(content);
  const hasGetElementById = /getElementById/.test(content);
  const hasAtob = /atob/.test(content);
  const hasCharCodeAt = /charCodeAt/.test(content);
  const hasXor = /\^/.test(content) && hasCharCodeAt;
  
  if (hasWindowAssignment || hasVarDeclaration || (hasGetElementById && hasAtob) || hasXor) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Script ${i + 1} (RELEVANT):`);
    console.log(`  Has window assignment: ${hasWindowAssignment}`);
    console.log(`  Has var declaration: ${hasVarDeclaration}`);
    console.log(`  Has getElementById: ${hasGetElementById}`);
    console.log(`  Has atob: ${hasAtob}`);
    console.log(`  Has XOR: ${hasXor}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Show the full script
    console.log(content);
    console.log('\n');
    
    // Save it
    fs.writeFileSync(`inline-decoder-script-${i + 1}.js`, content);
    console.log(`💾 Saved to: inline-decoder-script-${i + 1}.js\n`);
  }
});

// Also search for any script that comes BEFORE the PlayerJS initialization
const playerInitIndex = html.indexOf('var player = new Playerjs');
if (playerInitIndex > 0) {
  const htmlBeforeInit = html.substring(0, playerInitIndex);
  const scriptsBeforeInit = htmlBeforeInit.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Found ${scriptsBeforeInit ? scriptsBeforeInit.length : 0} scripts BEFORE PlayerJS init`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (scriptsBeforeInit) {
    scriptsBeforeInit.forEach((scriptTag, i) => {
      const content = scriptTag.replace(/<\/?script[^>]*>/gi, '').trim();
      if (content.length > 50 && !content.startsWith('http')) {
        console.log(`\nScript ${i + 1} before init (${content.length} bytes):`);
        console.log(content.substring(0, 300));
        console.log('...\n');
      }
    });
  }
}

console.log('\n✅ Search complete!\n');
