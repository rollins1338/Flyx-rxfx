const fs = require('fs');

const html = fs.readFileSync('player-page.html', 'utf8');

console.log('📜 Listing all external scripts...\n');

const scriptSrcPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
let match;
const scripts = [];

while ((match = scriptSrcPattern.exec(html)) !== null) {
    scripts.push(match[1]);
}

console.log(`Found ${scripts.length} external scripts:\n`);

scripts.forEach((src, i) => {
    console.log(`${i + 1}. ${src}`);
});

// Find which one comes BEFORE the PlayerJS initialization
const playerInitIndex = html.indexOf('var player = new Playerjs');
const htmlBeforeInit = html.substring(0, playerInitIndex);

console.log('\n\nScripts loaded BEFORE PlayerJS init:\n');

scripts.forEach((src, i) => {
    if (htmlBeforeInit.includes(src)) {
        console.log(`${i + 1}. ${src} ← LOADED BEFORE INIT`);
    }
});

console.log('\n✅ Done\n');
