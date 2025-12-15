/**
 * Extract and analyze XPrime inline scripts
 */

const fs = require('fs');

const html = fs.readFileSync('source-testing/xprime-response.html', 'utf8');

console.log('=== EXTRACTING XPRIME SCRIPTS ===\n');

// Extract all inline scripts
const scriptPattern = /<script[^>]*>([^<]{50,})<\/script>/gi;
let match;
let scriptNum = 0;

while ((match = scriptPattern.exec(html)) !== null) {
  scriptNum++;
  const script = match[1];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCRIPT ${scriptNum} (${script.length} chars)`);
  console.log('='.repeat(60));
  
  // Show first 2000 chars
  console.log(script.substring(0, 2000));
  
  if (script.length > 2000) {
    console.log(`\n... (${script.length - 2000} more chars)`);
  }
  
  // Save each script to a file
  fs.writeFileSync(`source-testing/xprime-script-${scriptNum}.js`, script);
  console.log(`\nSaved to: source-testing/xprime-script-${scriptNum}.js`);
}

// Also look for the main bundle
console.log('\n\n=== LOOKING FOR MAIN BUNDLE ===');
const bundlePattern = /src=["']([^"']*(?:bundle|app|main|index)[^"']*)["']/gi;
while ((match = bundlePattern.exec(html)) !== null) {
  console.log(`Bundle: ${match[1]}`);
}

// Look for API endpoints in the HTML
console.log('\n=== API ENDPOINTS IN HTML ===');
const apiPatterns = [
  /["']\/api\/[^"']+["']/gi,
  /["'][^"']*backend[^"']*["']/gi,
  /["'][^"']*source[^"']*["']/gi,
  /fetch\s*\([^)]+\)/gi,
];

for (const pattern of apiPatterns) {
  let m;
  while ((m = pattern.exec(html)) !== null) {
    console.log(`  ${m[0].substring(0, 100)}`);
  }
}
