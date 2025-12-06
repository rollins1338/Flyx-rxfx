/**
 * 1movies.bz - Find embed providers by analyzing the site
 * 
 * Strategy: Look at the HTML and JS to find what embed domains they use
 */

const fs = require('fs');

// Read the saved HTML and bundle
const html = fs.existsSync('1movies-fnaf2.html') ? fs.readFileSync('1movies-fnaf2.html', 'utf8') : '';
const bundle = fs.existsSync('1movies-bundle.js') ? fs.readFileSync('1movies-bundle.js', 'utf8') : '';

console.log('=== Analyzing 1movies.bz for embed providers ===\n');

// Common embed providers used by pirate sites
const knownProviders = [
  'vidsrc', 'vidcloud', 'vidplay', 'filemoon', 'streamtape',
  'doodstream', 'mixdrop', 'upstream', 'streamwish', 'vidhide',
  'embedsu', 'voe', 'streamlare', 'mp4upload', 'supervideo',
  'rabbitstream', 'megacloud', 'vidmoly', 'vtube', 'streamsb',
  '2embed', 'autoembed', 'superembed', 'moviesapi', 'multiembed',
  'vidsrc.me', 'vidsrc.to', 'vidsrc.xyz', 'vidsrc.cc',
  'embed.su', 'embedsito', 'gomovies', 'fmovies', 'flixhq',
  'vidlink', 'vidfast', 'vidnext', 'vidnode', 'vidstreaming'
];

console.log('Searching HTML for embed providers...');
for (const provider of knownProviders) {
  if (html.toLowerCase().includes(provider.toLowerCase())) {
    console.log(`  Found: ${provider}`);
  }
}

console.log('\nSearching bundle.js for embed providers...');
for (const provider of knownProviders) {
  if (bundle.toLowerCase().includes(provider.toLowerCase())) {
    console.log(`  Found: ${provider}`);
  }
}

// Look for URLs in the bundle
console.log('\nSearching for URLs in bundle...');
const urlPattern = /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const urls = bundle.match(urlPattern) || [];
const uniqueUrls = Array.from(new Set(urls)).filter((u: string) => 
  !u.includes('cloudflare') && 
  !u.includes('google') && 
  !u.includes('jquery') &&
  !u.includes('bootstrap') &&
  !u.includes('1movies')
);
console.log('External URLs found:', uniqueUrls.slice(0, 20));

// Look for iframe patterns
console.log('\nSearching for iframe patterns...');
const iframePattern = /iframe[^>]*src[^"]*"([^"]+)"/gi;
let match;
while ((match = iframePattern.exec(html)) !== null) {
  console.log('  Iframe src:', match[1]);
}

// Look for embed-related strings in bundle
console.log('\nSearching for embed-related strings in bundle...');
const embedStrings = bundle.match(/["'][^"']*embed[^"']*["']/gi) || [];
console.log('Embed strings:', Array.from(new Set(embedStrings)).slice(0, 10));

// Look for .m3u8 references
console.log('\nSearching for m3u8 references...');
const m3u8Pattern = /[^"'\s]*\.m3u8[^"'\s]*/gi;
const m3u8Refs = bundle.match(m3u8Pattern) || [];
console.log('M3U8 refs:', Array.from(new Set(m3u8Refs)));

// Look for API-like paths
console.log('\nSearching for API paths...');
const apiPattern = /["']\/[a-z]+\/[a-z]+["']/gi;
const apiPaths = bundle.match(apiPattern) || [];
console.log('API paths:', Array.from(new Set(apiPaths)).slice(0, 20));
