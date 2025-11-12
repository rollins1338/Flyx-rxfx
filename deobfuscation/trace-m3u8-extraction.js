const fs = require('fs');

console.log('=== TRACING M3U8 EXTRACTION LOGIC ===\n');

const code = fs.readFileSync('examples/pjs_main_drv_cast.js', 'utf8');

// Look for functions that handle source/file/url
console.log('1. Looking for source handling functions...\n');
const sourceHandlers = code.match(/function\s+\w*\([^)]*\)\s*{[^}]{0,500}(source|file|url|m3u8)[^}]{0,500}}/gi);
if (sourceHandlers) {
    console.log(`Found ${sourceHandlers.length} potential source handlers`);
}

// Look for fetch/ajax patterns with URLs
console.log('\n2. Looking for network request patterns...\n');
const networkPatterns = [
    /fetch\s*\(\s*['"](https?:\/\/[^'"]+)['"]/gi,
    /XMLHttpRequest[^;]+open\s*\([^,]+,\s*['"](https?:\/\/[^'"]+)['"]/gi,
    /\.get\s*\(\s*['"](https?:\/\/[^'"]+)['"]/gi,
    /ajax\s*\(\s*{[^}]*url\s*:\s*['"](https?:\/\/[^'"]+)['"]/gi
];

networkPatterns.forEach((pattern, i) => {
    const matches = [...code.matchAll(pattern)];
    if (matches.length > 0) {
        console.log(`Pattern ${i+1}: Found ${matches.length} matches`);
        matches.slice(0, 3).forEach(m => console.log('  -', m[1]));
    }
});

// Look for base64 encoded data that might contain URLs
console.log('\n3. Looking for base64 encoded data...\n');
const base64Patterns = code.match(/atob\s*\(\s*['"]([A-Za-z0-9+/=]{50,})['"]\s*\)/gi);
if (base64Patterns) {
    console.log(`Found ${base64Patterns.length} base64 decode operations`);
    base64Patterns.slice(0, 3).forEach(p => {
        const match = p.match(/['"]([A-Za-z0-9+/=]+)['"]/);
        if (match) {
            try {
                const decoded = Buffer.from(match[1], 'base64').toString('utf8');
                if (decoded.includes('http') || decoded.includes('m3u8')) {
                    console.log('\nDecoded base64 contains URL:');
                    console.log(decoded.substring(0, 200));
                }
            } catch (e) {}
        }
    });
}

// Look for URL construction patterns
console.log('\n4. Looking for URL construction patterns...\n');
const urlConstructors = code.match(/['"]https?:\/\/[^'"]+['"]\s*\+|concat\([^)]*https?:\/\//gi);
if (urlConstructors) {
    console.log(`Found ${urlConstructors.length} URL construction patterns`);
    [...new Set(urlConstructors)].slice(0, 10).forEach(u => console.log('  -', u.substring(0, 80)));
}

// Look for specific server domains
console.log('\n5. Looking for streaming server domains...\n');
const domains = [
    'vidsrc', 'vidplay', 'filemoon', 'doodstream', 'upstream', 'mixdrop',
    'streamtape', 'streamsb', 'streamlare', 'cloudnestra', 'embedsu'
];

domains.forEach(domain => {
    const regex = new RegExp(domain, 'gi');
    const matches = code.match(regex);
    if (matches) {
        console.log(`  ✓ ${domain}: ${matches.length} references`);
        
        // Try to find context around the domain
        const contextRegex = new RegExp(`.{0,100}${domain}.{0,100}`, 'gi');
        const contexts = [...code.matchAll(contextRegex)];
        if (contexts.length > 0) {
            console.log(`    Context: ${contexts[0][0].substring(0, 150)}`);
        }
    }
});

// Look for HLS/DASH manifest handling
console.log('\n6. Looking for HLS/DASH manifest handling...\n');
const manifestPatterns = [
    /\.m3u8/gi,
    /\.mpd/gi,
    /application\/vnd\.apple\.mpegurl/gi,
    /application\/dash\+xml/gi
];

manifestPatterns.forEach((pattern, i) => {
    const matches = code.match(pattern);
    if (matches) {
        console.log(`  Pattern ${i+1}: ${matches.length} matches`);
    }
});

// Look for iframe/embed patterns
console.log('\n7. Looking for iframe/embed patterns...\n');
const iframePatterns = code.match(/iframe|embed|contentWindow/gi);
if (iframePatterns) {
    console.log(`Found ${iframePatterns.length} iframe/embed references`);
}

console.log('\n=== TRACE COMPLETE ===');
