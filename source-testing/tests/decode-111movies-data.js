/**
 * Decode 111movies data encoding
 * 
 * The 'data' field in __NEXT_DATA__ contains encoded content info
 * We need to reverse engineer this encoding to make API calls
 */

async function fetchPageData(tmdbId, type = 'movie', season, episode) {
  let url;
  if (type === 'movie') {
    url = `https://111movies.com/movie/${tmdbId}`;
  } else {
    url = `https://111movies.com/tv/${tmdbId}/${season}/${episode}`;
  }
  
  console.log('Fetching:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await response.text();
  
  // Extract __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!nextDataMatch) {
    throw new Error('__NEXT_DATA__ not found');
  }
  
  const nextData = JSON.parse(nextDataMatch[1]);
  return nextData.props?.pageProps || {};
}

// Character frequency analysis
function analyzeCharFrequency(str) {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

// Try various decoding methods
function tryDecode(encoded) {
  console.log('\n=== DECODING ATTEMPTS ===');
  console.log('Input length:', encoded.length);
  console.log('Input preview:', encoded.substring(0, 100));
  
  // Character analysis
  console.log('\nCharacter frequency (top 20):');
  const freq = analyzeCharFrequency(encoded);
  console.log(freq.map(([c, n]) => `${c}:${n}`).join(', '));
  
  // Check character set
  const hasLower = /[a-z]/.test(encoded);
  const hasUpper = /[A-Z]/.test(encoded);
  const hasDigits = /[0-9]/.test(encoded);
  const hasSpecial = /[^a-zA-Z0-9]/.test(encoded);
  console.log(`\nCharset: lower=${hasLower}, upper=${hasUpper}, digits=${hasDigits}, special=${hasSpecial}`);
  
  // Find special characters
  const specialChars = encoded.match(/[^a-zA-Z0-9]/g);
  if (specialChars) {
    const uniqueSpecial = [...new Set(specialChars)];
    console.log('Special chars:', uniqueSpecial.join(' '));
  }
  
  // Try base64 decode
  console.log('\n--- Base64 decode ---');
  try {
    // Standard base64
    const decoded = Buffer.from(encoded, 'base64').toString();
    if (decoded.length > 0 && !decoded.includes('\ufffd')) {
      console.log('Standard base64:', decoded.substring(0, 100));
    } else {
      console.log('Standard base64: Invalid output');
    }
  } catch (e) {
    console.log('Standard base64: Failed -', e.message);
  }
  
  // Try URL-safe base64
  try {
    const urlSafe = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString();
    if (decoded.length > 0 && !decoded.includes('\ufffd')) {
      console.log('URL-safe base64:', decoded.substring(0, 100));
    }
  } catch (e) {}
  
  // Try hex decode
  console.log('\n--- Hex decode ---');
  try {
    const decoded = Buffer.from(encoded, 'hex').toString();
    if (decoded.length > 0) {
      console.log('Hex:', decoded.substring(0, 100));
    }
  } catch (e) {
    console.log('Hex: Failed');
  }
  
  // Try character substitution (ROT-like)
  console.log('\n--- ROT variations ---');
  for (const shift of [1, 3, 13, 47]) {
    let decoded = '';
    for (const char of encoded) {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) { // A-Z
        decoded += String.fromCharCode(((code - 65 + shift) % 26) + 65);
      } else if (code >= 97 && code <= 122) { // a-z
        decoded += String.fromCharCode(((code - 97 + shift) % 26) + 97);
      } else {
        decoded += char;
      }
    }
    if (decoded.includes('http') || decoded.includes('movie') || decoded.includes('tmdb')) {
      console.log(`ROT${shift}:`, decoded.substring(0, 100));
    }
  }
  
  // Try reverse
  console.log('\n--- Reverse ---');
  const reversed = encoded.split('').reverse().join('');
  console.log('Reversed:', reversed.substring(0, 100));
  
  // Try reverse + base64
  try {
    const decoded = Buffer.from(reversed, 'base64').toString();
    if (decoded.length > 0 && !decoded.includes('\ufffd')) {
      console.log('Reverse + base64:', decoded.substring(0, 100));
    }
  } catch (e) {}
  
  // Look for patterns
  console.log('\n--- Pattern analysis ---');
  
  // Check if it's split by underscore
  const parts = encoded.split('_');
  if (parts.length > 1) {
    console.log(`Split by '_': ${parts.length} parts`);
    parts.slice(0, 5).forEach((p, i) => console.log(`  Part ${i}: ${p}`));
  }
  
  // Check for repeating patterns
  const chunks = encoded.match(/.{1,4}/g);
  const uniqueChunks = new Set(chunks);
  console.log(`4-char chunks: ${chunks.length} total, ${uniqueChunks.size} unique`);
}

// Try to understand the API URL structure
async function analyzeApiStructure() {
  console.log('\n=== API STRUCTURE ANALYSIS ===\n');
  
  // The API uses URLs like: /fcd552c4/{encoded_data}/sr
  // Let's see if we can figure out what fcd552c4 is
  
  // It might be a hash of something
  const crypto = require('crypto');
  
  const testStrings = [
    '111movies',
    '111movies.com',
    'movie',
    'api',
    'stream',
    'sources'
  ];
  
  console.log('Testing if fcd552c4 is a hash:');
  for (const str of testStrings) {
    const md5 = crypto.createHash('md5').update(str).digest('hex');
    const sha1 = crypto.createHash('sha1').update(str).digest('hex');
    console.log(`  ${str}: md5=${md5.substring(0, 8)}, sha1=${sha1.substring(0, 8)}`);
  }
  
  // fcd552c4 looks like it could be a constant/version identifier
  console.log('\nfcd552c4 is likely a static API version/route identifier');
}

async function main() {
  console.log('=== 111MOVIES DATA DECODER ===\n');
  
  // Fetch data for a movie
  const movieData = await fetchPageData('155', 'movie');
  console.log('Movie data keys:', Object.keys(movieData));
  
  if (movieData.data) {
    tryDecode(movieData.data);
  }
  
  // Fetch data for a TV show
  console.log('\n\n=== TV SHOW DATA ===');
  const tvData = await fetchPageData('1396', 'tv', 1, 1);
  console.log('TV data keys:', Object.keys(tvData));
  
  if (tvData.data) {
    console.log('\nTV encoded data:');
    console.log('Length:', tvData.data.length);
    console.log('Preview:', tvData.data.substring(0, 100));
    
    // Compare movie and TV data
    console.log('\n--- Comparison ---');
    console.log('Movie data length:', movieData.data?.length);
    console.log('TV data length:', tvData.data?.length);
    
    // Check if they share common patterns
    const movieChars = new Set(movieData.data);
    const tvChars = new Set(tvData.data);
    const commonChars = [...movieChars].filter(c => tvChars.has(c));
    console.log('Common characters:', commonChars.length);
    console.log('Unique to movie:', [...movieChars].filter(c => !tvChars.has(c)).join(''));
    console.log('Unique to TV:', [...tvChars].filter(c => !movieChars.has(c)).join(''));
  }
  
  await analyzeApiStructure();
}

main().catch(console.error);
