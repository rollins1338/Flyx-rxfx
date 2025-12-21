/**
 * Test script to reverse engineer Flixer.sh - V6
 * 
 * Deep dive into the VideoPlayer bundle to find the source API
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

async function analyzeVideoPlayer() {
  console.log('=== Deep Analysis of Flixer.sh VideoPlayer ===\n');
  
  const js = await fetch('https://flixer.sh/assets/js/VideoPlayer-21683734.js');
  console.log(`JS Size: ${js.length} chars\n`);
  
  // Look for the source fetching function
  console.log('1. Looking for source fetching patterns...\n');
  
  // Find fetch/axios calls with source-related URLs
  const fetchPatterns = [
    /fetch\s*\([^)]*source[^)]*\)/gi,
    /fetch\s*\([^)]*server[^)]*\)/gi,
    /fetch\s*\([^)]*embed[^)]*\)/gi,
    /fetch\s*\([^)]*stream[^)]*\)/gi,
  ];
  
  for (const pattern of fetchPatterns) {
    const matches = js.match(pattern) || [];
    if (matches.length > 0) {
      console.log(`   Pattern: ${pattern}`);
      matches.forEach(m => console.log(`     - ${m.substring(0, 200)}`));
    }
  }
  
  // Look for API endpoint definitions
  console.log('\n2. Looking for API endpoint definitions...\n');
  
  // Find patterns like: /api/source, /api/server, etc.
  const apiEndpoints = js.match(/["'`]\/api\/[^"'`]+["'`]/g) || [];
  console.log(`   Found ${apiEndpoints.length} API endpoints:`);
  [...new Set(apiEndpoints)].forEach(e => console.log(`     - ${e}`));
  
  // Look for wyzie.ru patterns (subtitle service found earlier)
  console.log('\n3. Looking for wyzie.ru patterns...\n');
  const wyziePatterns = js.match(/wyzie[^"'\s\`]*/gi) || [];
  console.log(`   Found ${wyziePatterns.length} wyzie patterns:`);
  [...new Set(wyziePatterns)].forEach(p => console.log(`     - ${p}`));
  
  // Look for subtitle/source URL patterns
  console.log('\n4. Looking for subtitle/source URL patterns...\n');
  const subPatterns = js.match(/https?:\/\/[^"'\s\`]*(?:sub|subs|subtitle|caption)[^"'\s\`]*/gi) || [];
  console.log(`   Found ${subPatterns.length} subtitle patterns:`);
  [...new Set(subPatterns)].forEach(p => console.log(`     - ${p}`));
  
  // Look for vidsrc.to or similar patterns
  console.log('\n5. Looking for video source provider patterns...\n');
  const providerPatterns = [
    /vidsrc\.to[^"'\s\`]*/gi,
    /vidsrc\.cc[^"'\s\`]*/gi,
    /vidsrc\.me[^"'\s\`]*/gi,
    /vidplay[^"'\s\`]*/gi,
    /2embed[^"'\s\`]*/gi,
    /superembed[^"'\s\`]*/gi,
    /autoembed[^"'\s\`]*/gi,
    /moviesapi[^"'\s\`]*/gi,
    /multiembed[^"'\s\`]*/gi,
  ];
  
  for (const pattern of providerPatterns) {
    const matches = [...new Set(js.match(pattern) || [])];
    if (matches.length > 0) {
      console.log(`   ${pattern}: ${matches.length} matches`);
      matches.forEach(m => console.log(`     - ${m}`));
    }
  }
  
  // Look for the ServerSwitch component mentioned in the error
  console.log('\n6. Looking for ServerSwitch patterns...\n');
  const serverSwitchPatterns = js.match(/ServerSwitch[^;]{0,500}/gi) || [];
  console.log(`   Found ${serverSwitchPatterns.length} ServerSwitch patterns:`);
  serverSwitchPatterns.slice(0, 5).forEach(p => console.log(`     - ${p.substring(0, 200)}...`));
  
  // Look for server list/array definitions
  console.log('\n7. Looking for server list definitions...\n');
  const serverListPatterns = js.match(/servers?\s*[:=]\s*\[[^\]]+\]/gi) || [];
  console.log(`   Found ${serverListPatterns.length} server list patterns:`);
  serverListPatterns.slice(0, 5).forEach(p => console.log(`     - ${p.substring(0, 300)}`));
  
  // Look for the actual source URL construction
  console.log('\n8. Looking for source URL construction...\n');
  
  // Find patterns that construct URLs with tmdbId
  const urlConstructions = js.match(/`[^`]*\$\{[^}]*(?:tmdb|id)[^}]*\}[^`]*`/gi) || [];
  console.log(`   Found ${urlConstructions.length} URL constructions with tmdb/id:`);
  urlConstructions.slice(0, 20).forEach(u => console.log(`     - ${u}`));
  
  // Look for BASE_URL definitions
  console.log('\n9. Looking for BASE_URL definitions...\n');
  const baseUrlDefs = js.match(/BASE_URL\s*[:=]\s*["'`][^"'`]+["'`]/gi) || [];
  console.log(`   Found ${baseUrlDefs.length} BASE_URL definitions:`);
  baseUrlDefs.forEach(d => console.log(`     - ${d}`));
  
  // Look for environment variable patterns
  console.log('\n10. Looking for environment/config patterns...\n');
  const envPatterns = js.match(/(?:VITE_|NEXT_PUBLIC_|REACT_APP_)[A-Z_]+/g) || [];
  console.log(`   Found ${[...new Set(envPatterns)].length} env patterns:`);
  [...new Set(envPatterns)].forEach(e => console.log(`     - ${e}`));
  
  console.log('\n=== Analysis Complete ===');
}

analyzeVideoPlayer().catch(console.error);
