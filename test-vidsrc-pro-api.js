/**
 * Test the VidSrc Pro extractor directly
 */

const { extractVidsrcPro } = require('./COMPREHENSIVE-VIDSRC-PRO-EXTRACTOR.js');

async function test() {
  console.log('Testing VidSrc Pro extractor...\n');
  
  // Test with Fight Club
  const result = await extractVidsrcPro('movie', '550');
  
  if (result) {
    console.log('\n✅ SUCCESS!');
    console.log('URL:', result);
    
    // Replace placeholders
    const resolved = result
      .replace(/\{v1\}/g, 'shadowlandschronicles.com')
      .replace(/\{v2\}/g, 'shadowlandschronicles.com')
      .replace(/\{v3\}/g, 'shadowlandschronicles.com')
      .replace(/\{v4\}/g, 'shadowlandschronicles.com')
      .replace(/\{s1\}/g, 'shadowlandschronicles.com');
    
    console.log('\nResolved URL:', resolved.split(' or ')[0]);
  }
}

test().catch(console.error);
