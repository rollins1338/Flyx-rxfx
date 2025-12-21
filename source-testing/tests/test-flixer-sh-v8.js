/**
 * Test script to reverse engineer Flixer.sh - V8
 * 
 * Check the main index bundle for source API
 */

const https = require('https');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://flixer.sh/',
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

async function analyzeMainBundle() {
  console.log('=== Analyzing Flixer.sh Main Bundle ===\n');
  
  const js = await fetch('https://flixer.sh/assets/js/index-21683734.js');
  console.log(`JS Size: ${js.length} chars\n`);
  
  // Look for BASE_URL or API_URL definitions
  console.log('1. Looking for URL configurations...\n');
  
  const urlConfigs = js.match(/(?:BASE_URL|API_URL|BACKEND_URL|SERVER_URL)\s*[:=]\s*["'`][^"'`]+["'`]/gi) || [];
  console.log(`   Found ${urlConfigs.length} URL configs:`);
  urlConfigs.forEach(c => console.log(`     - ${c}`));
  
  // Look for plsdontscrapemelove patterns
  console.log('\n2. Looking for plsdontscrapemelove patterns...\n');
  
  const plsPatterns = js.match(/plsdontscrapemelove[^"'\s\`]*/gi) || [];
  console.log(`   Found ${plsPatterns.length} patterns:`);
  [...new Set(plsPatterns)].forEach(p => console.log(`     - ${p}`));
  
  // Look for the context around plsdontscrapemelove
  const plsIndex = js.indexOf('plsdontscrapemelove');
  if (plsIndex !== -1) {
    const context = js.substring(Math.max(0, plsIndex - 200), plsIndex + 500);
    console.log('\n   Context:');
    console.log('   ' + context);
  }
  
  // Look for source/server API patterns
  console.log('\n3. Looking for source/server API patterns...\n');
  
  const apiPatterns = js.match(/["'`][^"'`]*(?:\/source|\/server|\/embed|\/stream|\/video)[^"'`]*["'`]/gi) || [];
  console.log(`   Found ${apiPatterns.length} API patterns:`);
  [...new Set(apiPatterns)].forEach(p => console.log(`     - ${p}`));
  
  // Look for fetch configurations
  console.log('\n4. Looking for fetch configurations...\n');
  
  // Find fetch calls with headers
  const fetchWithHeaders = js.match(/fetch\s*\([^)]+\)\s*\.then/gi) || [];
  console.log(`   Found ${fetchWithHeaders.length} fetch calls with .then`);
  
  // Look for axios or other HTTP client configurations
  const httpClients = js.match(/(?:axios|ky|got|request)\s*\.\s*(?:get|post|create)/gi) || [];
  console.log(`   Found ${httpClients.length} HTTP client calls`);
  
  // Look for the poster server mythology names (found in earlier analysis)
  console.log('\n5. Looking for poster server names...\n');
  
  const mythologyNames = ['Ares', 'Balder', 'Circe', 'Dionysus', 'Eros', 'Freya', 'Gaia', 'Hades', 
                          'Isis', 'Juno', 'Kronos', 'Loki', 'Medusa', 'Nyx', 'Odin', 'Persephone',
                          'Quirinus', 'Ra', 'Selene', 'Thor', 'Uranus', 'Vulcan', 'Woden', 'Xolotl', 
                          'Ymir', 'Zeus'];
  
  for (const name of mythologyNames) {
    if (js.includes(name)) {
      console.log(`   Found: ${name}`);
    }
  }
  
  // Look for the actual source fetching logic
  console.log('\n6. Looking for source fetching logic...\n');
  
  // Find patterns that look like source fetching
  const sourceFetchPatterns = [
    /getSource[^(]*\([^)]*\)/gi,
    /fetchSource[^(]*\([^)]*\)/gi,
    /loadSource[^(]*\([^)]*\)/gi,
    /getServer[^(]*\([^)]*\)/gi,
    /fetchServer[^(]*\([^)]*\)/gi,
  ];
  
  for (const pattern of sourceFetchPatterns) {
    const matches = js.match(pattern) || [];
    if (matches.length > 0) {
      console.log(`   Pattern: ${pattern}`);
      matches.slice(0, 5).forEach(m => console.log(`     - ${m}`));
    }
  }
  
  // Look for the tmdb-poster-utils patterns
  console.log('\n7. Looking for poster utils patterns...\n');
  
  const posterUtilsIndex = js.indexOf('tmdb-poster-utils');
  if (posterUtilsIndex !== -1) {
    const context = js.substring(Math.max(0, posterUtilsIndex - 100), posterUtilsIndex + 300);
    console.log('   Context around tmdb-poster-utils:');
    console.log('   ' + context);
  }
  
  // Look for the image enhancer patterns
  console.log('\n8. Looking for image enhancer patterns...\n');
  
  const imageEnhancerIndex = js.indexOf('tmdb-image-enhancer');
  if (imageEnhancerIndex !== -1) {
    const context = js.substring(Math.max(0, imageEnhancerIndex - 100), imageEnhancerIndex + 300);
    console.log('   Context around tmdb-image-enhancer:');
    console.log('   ' + context);
  }
  
  console.log('\n=== Analysis Complete ===');
}

analyzeMainBundle().catch(console.error);
