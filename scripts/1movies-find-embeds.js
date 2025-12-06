/**
 * 1movies.bz - Find embed providers by analyzing the site
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
const uniqueUrls = [...new Set(urls)].filter(u => 
  !u.includes('cloudflare') && 
  !u.includes('google') && 
  !u.includes('jquery') &&
  !u.includes('bootstrap') &&
  !u.includes('1movies') &&
  !u.includes('cdnjs') &&
  !u.includes('swiperjs')
);
console.log('External URLs found:', uniqueUrls.slice(0, 20));

// Look for API-like paths
console.log('\nSearching for API paths in bundle...');
const apiPattern = /["']\/ajax\/[a-z\/]+["']/gi;
const apiPaths = bundle.match(apiPattern) || [];
console.log('API paths:', [...new Set(apiPaths)]);

// Look for domain patterns
console.log('\nSearching for domain patterns...');
const domainPattern = /[a-z0-9-]+\.(xyz|cc|to|me|su|io|tv|ws|net|org|co)/gi;
const domains = bundle.match(domainPattern) || [];
const uniqueDomains = [...new Set(domains)].filter(d => 
  !d.includes('1movies') && 
  d.length > 5
);
console.log('Domains found:', uniqueDomains.slice(0, 30));
