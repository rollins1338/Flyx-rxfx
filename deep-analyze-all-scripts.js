const fs = require('fs');

console.log('Deep analyzing all scripts from player page...\n');

const playerPage = fs.readFileSync('player-page-full.html', 'utf8');

// Extract the hidden div info
const hiddenDivMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i);
if (hiddenDivMatch) {
  const divId = hiddenDivMatch[1];
  const encoded = hiddenDivMatch[2];
  console.log('=== HIDDEN DIV INFO ===');
  console.log('Div ID:', divId);
  console.log('Encoded length:', encoded.length);
  console.log('Encoded preview:', encoded.substring(0, 100));
  console.log('Contains g:', encoded.includes('g'));
  console.log('Contains ::', encoded.includes(':'));
  console.log('');
}

// Extract all script tags
const scriptMatches = [...playerPage.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log(`Found ${scriptMatches.length} script tags\n`);

let scriptIndex = 0;
for (const match of scriptMatches) {
  const scriptContent = match[1].trim();
  
  if (scriptContent.length < 50) {
    scriptIndex++;
    continue;
  }
  
  console.log(`\n=== SCRIPT ${scriptIndex} (${scriptContent.length} bytes) ===`);
  
  // Check for decoder-related keywords
  const keywords = [
    'decode', 'decrypt', 'atob', 'btoa', 'fromCharCode', 'charCodeAt',
    'getElementById', 'replace', 'split', 'join', 'substring',
    'parseInt', 'toString', 'String.fromCharCode', 'Buffer',
    hiddenDivMatch ? hiddenDivMatch[1] : 'DIVID' // The actual div ID
  ];
  
  const foundKeywords = keywords.filter(kw => scriptContent.includes(kw));
  
  if (foundKeywords.length > 0) {
    console.log('Found keywords:', foundKeywords.join(', '));
    
    // Save this script for detailed analysis
    fs.writeFileSync(`decoder-script-${scriptIndex}.js`, scriptContent);
    console.log(`Saved to decoder-script-${scriptIndex}.js`);
    
    // Look for the div ID being used
    if (hiddenDivMatch && scriptContent.includes(hiddenDivMatch[1])) {
      console.log('\n!!! THIS SCRIPT USES THE HIDDEN DIV ID !!!');
      
      // Extract the relevant lines
      const lines = scriptContent.split('\n');
      const relevantLines = lines.filter(line => 
        line.includes(hiddenDivMatch[1]) || 
        line.includes('decode') || 
        line.includes('replace') ||
        line.includes('split')
      );
      
      console.log('\nRelevant lines:');
      relevantLines.slice(0, 20).forEach(line => {
        console.log('  ', line.trim().substring(0, 120));
      });
    }
    
    // Look for character replacement patterns
    const replaceMatches = [...scriptContent.matchAll(/\.replace\([^)]+\)/g)];
    if (replaceMatches.length > 0) {
      console.log('\nFound replace operations:');
      replaceMatches.slice(0, 10).forEach(m => {
        console.log('  ', m[0]);
      });
    }
    
    // Look for split/join patterns
    const splitJoinMatches = [...scriptContent.matchAll(/\.split\([^)]+\)\.join\([^)]+\)/g)];
    if (splitJoinMatches.length > 0) {
      console.log('\nFound split/join operations:');
      splitJoinMatches.slice(0, 5).forEach(m => {
        console.log('  ', m[0]);
      });
    }
    
    // Look for function definitions that might be decoders
    const functionMatches = [...scriptContent.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*{/g)];
    if (functionMatches.length > 0) {
      console.log('\nFunction definitions:');
      functionMatches.slice(0, 10).forEach(m => {
        console.log('  ', m[0]);
      });
    }
  }
  
  scriptIndex++;
}

console.log('\n\n=== ANALYSIS COMPLETE ===');
console.log('Check the decoder-script-*.js files for detailed analysis');
