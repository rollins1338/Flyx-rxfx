/**
 * Test script for VidSrc Pro VM-based extractor
 */

const { VidsrcProVMExtractor } = require('./app/lib/services/vidsrc-pro-vm-extractor.ts');

async function test() {
  console.log('\n🧪 Testing VidSrc Pro VM Extractor\n');
  console.log('='.repeat(80));
  
  const extractor = new VidsrcProVMExtractor({ debug: true });
  
  try {
    console.log('\n📽️  Test 1: Fight Club (Movie 550)\n');
    const result = await extractor.extractMovie(550);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS!');
    console.log('='.repeat(80));
    console.log('\nResult:');
    console.log('  Method:', result.method);
    console.log('  Div ID:', result.divId);
    console.log('  M3U8 URL:', result.url.substring(0, 100) + '...');
    console.log('  ProRCP URL:', result.proRcpUrl.substring(0, 80) + '...');
    
    // Save result
    const fs = require('fs');
    fs.writeFileSync('test-vm-result.json', JSON.stringify(result, null, 2));
    console.log('\n💾 Result saved to test-vm-result.json');
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

test();
