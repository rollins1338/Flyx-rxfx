const fs = require('fs');

const html = fs.readFileSync('player-page.html', 'utf8');

console.log('🔍 Extracting ALL scripts from player page...\n');

// Extract all script tags
const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);

console.log(`Found ${scriptMatches.length} script tags\n`);

scriptMatches.forEach((scriptTag, i) => {
    const content = scriptTag.replace(/<\/?script[^>]*>/gi, '').trim();
    
    if (content.length > 50) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SCRIPT ${i + 1} (${content.length} bytes)`);
        console.log('='.repeat(80));
        
        // Check what it contains
        const checks = {
            'getElementById': content.includes('getElementById'),
            'textContent': content.includes('textContent'),
            'innerHTML': content.includes('innerHTML'),
            'window[': content.includes('window['),
            'atob': content.includes('atob'),
            'xTyBxQyGTA': content.includes('xTyBxQyGTA'),
            'pjsdiv': content.includes('pjsdiv')
        };
        
        console.log('Contains:');
        Object.entries(checks).forEach(([key, val]) => {
            if (val) console.log(`  ✓ ${key}`);
        });
        
        // Show first 500 chars
        console.log('\nContent preview:');
        console.log(content.substring(0, 500));
        
        // Save if it looks relevant
        if (checks.xTyBxQyGTA || (checks.getElementById && checks.window) || checks.pjsdiv) {
            const filename = `page-script-${i + 1}-RELEVANT.js`;
            fs.writeFileSync(filename, content);
            console.log(`\n💾 SAVED TO: ${filename}`);
        }
    }
});

console.log('\n\n✅ Extraction complete\n');
