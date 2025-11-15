const fs = require('fs');

const encoded = fs.readFileSync('encoded-full.txt', 'utf8').trim();

console.log('Testing if this is a URL path...');

// Replace g with 8 and : with /
const replaced = encoded.replace(/g/g, '8').replace(/:/g, '/');

console.log('Replaced:', replaced.substring(0, 200));

// Try constructing URLs
const possibleUrls = [
  `https://${replaced}`,
  `http://${replaced}`,
  `https://shadowlandschronicles.com/${replaced}`,
  `https://shadowlandschronicles.net/${replaced}`,
  `https://shadowlandschronicles.io/${replaced}`,
  `https://shadowlandschronicles.org/${replaced}`,
];

for (const url of possibleUrls) {
  if (url.includes('.m3u8')) {
    console.log('\n✓✓✓ Found M3U8 URL:');
    console.log(url);
    break;
  }
}

// Check if it contains domain patterns
if (replaced.match(/[a-z0-9-]+\.[a-z]{2,}/i)) {
  console.log('\n✓ Contains domain pattern');
  
  // Extract potential URL
  const urlMatch = replaced.match(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}[^\s]*/i);
  if (urlMatch) {
    let url = urlMatch[0];
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    console.log('\nExtracted URL:');
    console.log(url);
  }
}
