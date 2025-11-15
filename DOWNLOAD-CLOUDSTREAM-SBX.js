const https = require('https');
const fs = require('fs');

// Download the sbx.js script from Cloudstream
const url = 'https://cloudnestra.com/sbx.js?t=1751380596';

console.log('📥 Downloading Cloudstream sbx.js...');
console.log('URL:', url);

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('✅ Downloaded!');
    console.log('Length:', data.length);
    
    fs.writeFileSync('cloudstream-sbx.js', data);
    console.log('💾 Saved to cloudstream-sbx.js');
    
    // Analyze for ProRCP references
    console.log('\n🔍 Analyzing for ProRCP references...');
    
    const proRCPMatches = data.match(/prorcp/gi);
    if (proRCPMatches) {
      console.log(`✅ Found ${proRCPMatches.length} references to "prorcp"`);
    }
    
    // Look for URL patterns
    const urlMatches = data.match(/(https?:\/\/[^\s"']+)/g);
    if (urlMatches) {
      console.log(`\n📍 Found ${urlMatches.length} URLs:`);
      const uniqueUrls = [...new Set(urlMatches)];
      uniqueUrls.forEach(url => {
        if (url.includes('prorcp') || url.includes('rcp')) {
          console.log('   🎯', url);
        } else {
          console.log('   ', url);
        }
      });
    }
    
    // Look for iframe creation
    const iframeMatches = data.match(/createElement\s*\(\s*["']iframe["']\s*\)/gi);
    if (iframeMatches) {
      console.log(`\n✅ Found ${iframeMatches.length} iframe creation(s)`);
    }
    
    // Look for .src assignments
    const srcMatches = data.match(/\.src\s*=\s*[^;]+/g);
    if (srcMatches) {
      console.log(`\n✅ Found ${srcMatches.length} .src assignment(s):`);
      srcMatches.slice(0, 10).forEach(match => {
        console.log('   ', match);
      });
    }
    
    console.log('\n✅ Analysis complete! Check cloudstream-sbx.js for full content.');
  });
}).on('error', (err) => {
  console.error('❌ Error:', err.message);
});
