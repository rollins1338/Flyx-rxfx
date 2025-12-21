/**
 * Test script to reverse engineer Flixer.sh - V5
 * 
 * Analyze the VideoPlayer JS bundle to find the source API
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
  console.log('=== Analyzing Flixer.sh VideoPlayer Bundle ===\n');
  
  // Fetch the VideoPlayer JS
  console.log('1. Fetching VideoPlayer-21683734.js...');
  const js = await fetch('https://flixer.sh/assets/js/VideoPlayer-21683734.js');
  console.log(`   Size: ${js.length} chars\n`);
  
  // Look for API endpoints
  console.log('2. Searching for API patterns...\n');
  
  // Find source/embed/stream related patterns
  const patterns = [
    { name: 'source API', regex: /["'`][^"'`]*(?:source|sources)[^"'`]*["'`]/gi },
    { name: 'embed API', regex: /["'`][^"'`]*embed[^"'`]*["'`]/gi },
    { name: 'stream API', regex: /["'`][^"'`]*stream[^"'`]*["'`]/gi },
    { name: 'video API', regex: /["'`]\/api\/[^"'`]*video[^"'`]*["'`]/gi },
    { name: 'player API', regex: /["'`]\/api\/[^"'`]*player[^"'`]*["'`]/gi },
    { name: 'watch API', regex: /["'`]\/api\/[^"'`]*watch[^"'`]*["'`]/gi },
    { name: 'vidsrc', regex: /vidsrc[^"'\s\`]*/gi },
    { name: 'vidplay', regex: /vidplay[^"'\s\`]*/gi },
    { name: 'superembed', regex: /superembed[^"'\s\`]*/gi },
    { name: 'm3u8', regex: /["'`][^"'`]*\.m3u8[^"'`]*["'`]/gi },
    { name: 'HLS', regex: /["'`][^"'`]*hls[^"'`]*["'`]/gi },
    { name: 'plsdontscrapemelove', regex: /plsdontscrapemelove[^"'\s\`]*/gi },
    { name: 'fetch calls', regex: /fetch\s*\(\s*["'`][^"'`]+["'`]/gi },
    { name: 'axios calls', regex: /axios\.[a-z]+\s*\(\s*["'`][^"'`]+["'`]/gi },
  ];
  
  for (const { name, regex } of patterns) {
    const matches = [...new Set(js.match(regex) || [])];
    if (matches.length > 0) {
      console.log(`   ${name}: ${matches.length} matches`);
      matches.slice(0, 10).forEach(m => console.log(`     - ${m.substring(0, 100)}`));
      console.log('');
    }
  }
  
  // Look for URL construction patterns
  console.log('3. Looking for URL construction...\n');
  
  // Find template literals with variables
  const templatePatterns = js.match(/`[^`]*\$\{[^}]+\}[^`]*`/g) || [];
  const urlTemplates = templatePatterns.filter(t => 
    t.includes('http') || t.includes('/api/') || t.includes('embed') || 
    t.includes('source') || t.includes('stream')
  );
  console.log(`   URL templates: ${urlTemplates.length}`);
  urlTemplates.slice(0, 15).forEach(t => console.log(`     - ${t.substring(0, 150)}`));
  
  // Look for base URLs
  console.log('\n4. Looking for base URLs...\n');
  const baseUrls = [...new Set(js.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];
  console.log(`   Found ${baseUrls.length} base URLs:`);
  baseUrls.forEach(u => console.log(`     - ${u}`));
  
  // Look for server/provider names
  console.log('\n5. Looking for server/provider names...\n');
  const serverPatterns = js.match(/["'`](?:server|provider|source)[^"'`]*["'`]\s*[:=]/gi) || [];
  console.log(`   Server patterns: ${serverPatterns.length}`);
  serverPatterns.slice(0, 10).forEach(p => console.log(`     - ${p}`));
  
  // Look for specific function names
  console.log('\n6. Looking for relevant function names...\n');
  const funcPatterns = [
    /function\s+\w*(?:source|embed|stream|video|player|fetch)\w*\s*\(/gi,
    /(?:const|let|var)\s+\w*(?:source|embed|stream|video|player)\w*\s*=/gi,
    /\w*(?:getSource|fetchSource|loadSource|getEmbed|fetchEmbed|loadVideo)\w*\s*[=(]/gi,
  ];
  
  for (const pattern of funcPatterns) {
    const matches = [...new Set(js.match(pattern) || [])];
    if (matches.length > 0) {
      matches.slice(0, 10).forEach(m => console.log(`     - ${m}`));
    }
  }
  
  // Look for the actual video source fetching logic
  console.log('\n7. Looking for video source fetching logic...\n');
  
  // Find sections that mention both tmdbId and source/embed
  const sections = js.split(/[;{}]/);
  const relevantSections = sections.filter(s => 
    (s.includes('tmdb') || s.includes('TMDB')) && 
    (s.includes('source') || s.includes('embed') || s.includes('stream'))
  );
  console.log(`   Found ${relevantSections.length} relevant sections:`);
  relevantSections.slice(0, 5).forEach(s => {
    const trimmed = s.trim().substring(0, 200);
    if (trimmed.length > 20) console.log(`     - ${trimmed}...`);
  });
  
  console.log('\n=== Analysis Complete ===');
}

analyzeVideoPlayer().catch(console.error);
