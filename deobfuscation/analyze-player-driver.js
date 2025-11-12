const fs = require('fs');

console.log('=== ANALYZING PLAYER DRIVER ===\n');

const code = fs.readFileSync('examples/pjs_main_drv_cast.js', 'utf8');

console.log('File size:', code.length, 'bytes\n');

// Look for m3u8 patterns
console.log('=== M3U8 PATTERNS ===');
const m3u8Matches = code.match(/["']([^"']*m3u8[^"']*)["']/gi);
if (m3u8Matches) {
    console.log('Found', m3u8Matches.length, 'm3u8 references');
    [...new Set(m3u8Matches)].slice(0, 20).forEach(m => console.log('  -', m));
}

// Look for fetch/ajax patterns
console.log('\n=== FETCH/AJAX PATTERNS ===');
const fetchMatches = code.match(/fetch\([^)]+\)|ajax\([^)]+\)|XMLHttpRequest/gi);
if (fetchMatches) {
    console.log('Found', fetchMatches.length, 'network calls');
    [...new Set(fetchMatches)].slice(0, 10).forEach(m => console.log('  -', m));
}

// Look for URL patterns
console.log('\n=== URL PATTERNS ===');
const urlMatches = code.match(/https?:\/\/[^\s"'<>)]+/gi);
if (urlMatches) {
    console.log('Found', urlMatches.length, 'URLs');
    [...new Set(urlMatches)].slice(0, 20).forEach(url => console.log('  -', url));
}

// Look for decode/decrypt functions
console.log('\n=== DECODE/DECRYPT FUNCTIONS ===');
const decodeMatches = code.match(/(atob|btoa|decrypt|decode|deobfuscate)\s*\(/gi);
if (decodeMatches) {
    console.log('Found', decodeMatches.length, 'decode/decrypt calls');
    [...new Set(decodeMatches)].forEach(m => console.log('  -', m));
}

// Look for eval patterns
console.log('\n=== EVAL PATTERNS ===');
const evalMatches = code.match(/eval\s*\(/gi);
if (evalMatches) {
    console.log('Found', evalMatches.length, 'eval calls');
}

// Look for function definitions that might handle sources
console.log('\n=== SOURCE/STREAM FUNCTIONS ===');
const sourceFuncs = code.match(/function\s+\w*\s*\([^)]*\)\s*{[^}]{0,200}(source|stream|m3u8|url|file)[^}]{0,200}}/gi);
if (sourceFuncs) {
    console.log('Found', sourceFuncs.length, 'potential source functions');
    sourceFuncs.slice(0, 5).forEach(f => {
        console.log('\n---');
        console.log(f.substring(0, 300));
    });
}

// Look for specific server names
console.log('\n=== SERVER REFERENCES ===');
const servers = ['vidsrc', 'vidplay', 'filemoon', 'doodstream', 'upstream', 'mixdrop'];
servers.forEach(server => {
    if (code.toLowerCase().includes(server)) {
        console.log(`  ✓ Found reference to: ${server}`);
    }
});

// Look for hash/encryption keys
console.log('\n=== POTENTIAL KEYS/HASHES ===');
const keyMatches = code.match(/[a-f0-9]{32,}/gi);
if (keyMatches) {
    console.log('Found', keyMatches.length, 'potential hash values');
    [...new Set(keyMatches)].slice(0, 10).forEach(k => console.log('  -', k.substring(0, 40)));
}

console.log('\n=== ANALYSIS COMPLETE ===');
