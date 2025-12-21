/**
 * Test script to reverse engineer Flixer.sh - V10
 * 
 * Analyze the WASM-related files and poster utils
 */

const https = require('https');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://flixer.sh/',
  'Origin': 'https://flixer.sh',
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function analyzeFlixerUtils() {
  console.log('=== Analyzing Flixer.sh Utils Files ===\n');
  
  // Fetch the poster utils
  console.log('1. Fetching tmdb-poster-utils.js...');
  try {
    const posterUtils = await fetch('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-poster-utils.js');
    console.log(`   Size: ${posterUtils.length} chars\n`);
    console.log('   Content:');
    console.log(posterUtils);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Fetch the image enhancer
  console.log('2. Fetching tmdb-image-enhancer.js...');
  try {
    const imageEnhancer = await fetch('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-image-enhancer.js');
    console.log(`   Size: ${imageEnhancer.length} chars\n`);
    console.log('   Content:');
    console.log(imageEnhancer);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Fetch the WASM JS wrapper
  console.log('3. Fetching img_data.js (WASM wrapper)...');
  try {
    const wasmWrapper = await fetch('https://plsdontscrapemelove.flixer.sh/assets/wasm/img_data.js');
    console.log(`   Size: ${wasmWrapper.length} chars\n`);
    console.log('   Content preview:');
    console.log(wasmWrapper.substring(0, 3000));
    console.log('\n   ...\n');
    console.log(wasmWrapper.substring(wasmWrapper.length - 1000));
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  console.log('\n=== Analysis Complete ===');
}

analyzeFlixerUtils().catch(console.error);
