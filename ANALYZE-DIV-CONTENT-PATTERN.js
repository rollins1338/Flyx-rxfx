/**
 * ANALYZE DIV CONTENT TO CRACK THE DECODER
 * Let's examine the raw div content and figure out the decoding algorithm
 */

const VidsrcProExtractor = require('./VIDSRC-PRO-WORKING-EXTRACTOR.js');

(async () => {
  const extractor = new VidsrcProExtractor({ debug: true });
  
  console.log('🔍 Extracting div content for analysis...\n');
  
  const result = await extractor.extractMovie(550);
  
  console.log('\n📊 DIV ANALYSIS:');
  console.log('Div ID:', result.divId);
  console.log('Content Length:', result.divContent.length);
  console.log('\n📝 Raw Content (first 500 chars):');
  console.log(result.divContent.substring(0, 500));
  console.log('\n📝 Raw Content (last 500 chars):');
  console.log(result.divContent.substring(result.divContent.length - 500));
  
  // Analyze character distribution
  const chars = {};
  for (const char of result.divContent) {
    chars[char] = (chars[char] || 0) + 1;
  }
  
  console.log('\n📈 Character Distribution:');
  const sorted = Object.entries(chars).sort((a, b) => b[1] - a[1]).slice(0, 20);
  sorted.forEach(([char, count]) => {
    const display = char === ' ' ? 'SPACE' : char === '\n' ? 'NEWLINE' : char;
    console.log(`  ${display}: ${count}`);
  });
  
  // Check if it's base64-like
  const base64Pattern = /^[A-Za-z0-9+/=]+$/;
  const isBase64Like = base64Pattern.test(result.divContent);
  console.log('\n🔍 Is Base64-like?', isBase64Like);
  
  // Try base64 decode
  if (isBase64Like) {
    console.log('\n🔓 Attempting base64 decode...');
    try {
      const decoded = Buffer.from(result.divContent, 'base64').toString('utf8');
      console.log('✅ Decoded (first 200 chars):');
      console.log(decoded.substring(0, 200));
      
      // Check if decoded looks like a URL
      if (decoded.includes('http') || decoded.includes('.m3u8')) {
        console.log('\n🎯 FOUND M3U8 URL IN DECODED CONTENT!');
        console.log(decoded);
      }
    } catch (e) {
      console.log('❌ Base64 decode failed:', e.message);
    }
  }
  
  // Save for further analysis
  const fs = require('fs');
  fs.writeFileSync('div-content-raw.txt', result.divContent);
  console.log('\n💾 Raw content saved to div-content-raw.txt');
  
})().catch(console.error);
