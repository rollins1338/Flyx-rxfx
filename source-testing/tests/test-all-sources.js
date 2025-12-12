/**
 * Test all enc-dec.app sources
 * 
 * Run: node source-testing/tests/test-all-sources.js
 */

const extractors = require('../extractors');

async function testDatabases() {
  console.log('\n=== TESTING DATABASES ===\n');
  
  // Test Kai (Anime) DB
  console.log('--- Kai (Anime) Database ---');
  try {
    const kaiStats = await extractors.db.kai.stats();
    console.log('Kai Stats:', kaiStats);
    
    const kaiSearch = await extractors.db.kai.search('naruto');
    console.log('Kai Search "naruto":', kaiSearch?.results?.slice(0, 2) || kaiSearch);
  } catch (e) {
    console.error('Kai Error:', e.message);
  }
  
  // Test Flix (Movies/TV) DB
  console.log('\n--- Flix (Movies/TV) Database ---');
  try {
    const flixStats = await extractors.db.flix.stats();
    console.log('Flix Stats:', flixStats);
    
    const flixSearch = await extractors.db.flix.search('inception');
    console.log('Flix Search "inception":', flixSearch?.results?.slice(0, 2) || flixSearch);
  } catch (e) {
    console.error('Flix Error:', e.message);
  }
}

async function testSources() {
  console.log('\n=== TESTING SOURCES ===\n');
  
  const testText = 'test123';
  
  // AnimeKai
  console.log('--- AnimeKai ---');
  try {
    const enc = await extractors.animekai.encrypt(testText);
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Flix
  console.log('\n--- Flix ---');
  try {
    const enc = await extractors.flix.encrypt(testText);
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Vidlink
  console.log('\n--- Vidlink ---');
  try {
    const enc = await extractors.vidlink.encrypt(testText);
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Vidstack
  console.log('\n--- Vidstack ---');
  try {
    const enc = await extractors.vidstack.encrypt();
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // XPrime
  console.log('\n--- XPrime ---');
  try {
    const enc = await extractors.xprime.encrypt();
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Mapple
  console.log('\n--- Mapple ---');
  try {
    const enc = await extractors.mapple.encrypt();
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // KissKH
  console.log('\n--- KissKH ---');
  try {
    const enc = await extractors.kisskh.encrypt(testText, 'sub');
    console.log('Encrypt:', enc);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function main() {
  console.log('========================================');
  console.log('  enc-dec.app Source Testing');
  console.log('========================================');
  
  await testDatabases();
  await testSources();
  
  console.log('\n========================================');
  console.log('  Testing Complete');
  console.log('========================================\n');
}

main().catch(console.error);
