/**
 * Test Flixer Service with different content
 */

const { FlixerDecryptionService } = require('./flixer-decryption-service.js');

async function testService() {
  console.log('=== Testing Flixer Decryption Service ===\n');
  
  const service = new FlixerDecryptionService();
  
  try {
    await service.initialize();
    
    // Test with Breaking Bad (very popular)
    console.log('\n--- Testing Breaking Bad S01E01 ---');
    const bbSources = await service.getSources('tv', 1396, 1, 1);
    console.log('Breaking Bad Sources:', bbSources);
    
    // Test with Game of Thrones
    console.log('\n--- Testing Game of Thrones S01E01 ---');
    const gotSources = await service.getSources('tv', 1399, 1, 1);
    console.log('GoT Sources:', gotSources);
    
    // Test with The Office
    console.log('\n--- Testing The Office S01E01 ---');
    const officeSources = await service.getSources('tv', 2316, 1, 1);
    console.log('Office Sources:', officeSources);
    
    // Test with Inception (movie)
    console.log('\n--- Testing Inception ---');
    const inceptionSources = await service.getSources('movie', 27205);
    console.log('Inception Sources:', inceptionSources);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await service.close();
  }
}

testService().catch(console.error);
