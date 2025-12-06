/**
 * Step 16: Find video/stream related code
 * 
 * The rapidshare player must have code to:
 * 1. Fetch video sources
 * 2. Initialize JWPlayer
 * 3. Handle HLS/MP4 streams
 */

const fs = require('fs');

console.log('=== Step 16: Finding Video/Stream Code ===\n');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Look for JWPlayer related code
console.log('=== JWPlayer References ===');
const jwplayerRefs = original.match(/jwplayer|JWPlayer|jw\s*\(/gi);
if (jwplayerRefs) {
  console.log('JWPlayer references:', jwplayerRefs.length);
  console.log('Types:', [...new Set(jwplayerRefs)].join(', '));
}

// Look for setup() calls
console.log('\n=== setup() Calls ===');
const setupCalls = original.match(/\.setup\s*\([^)]*\)/g);
if (setupCalls) {
  console.log('setup() calls:', setupCalls.length);
  setupCalls.slice(0, 5).forEach(s => console.log('  ', s.substring(0, 100)));
}

// Look for file/source references
console.log('\n=== File/Source References ===');
const fileRefs = original.match(/["']file["']|["']source["']|["']sources["']/gi);
if (fileRefs) {
  console.log('File/source references:', fileRefs.length);
}

// Look for HLS/M3U8 references
console.log('\n=== HLS/M3U8 References ===');
const hlsRefs = original.match(/\.m3u8|hls|HLS|\.ts\b/gi);
if (hlsRefs) {
  console.log('HLS references:', hlsRefs.length);
  console.log('Types:', [...new Set(hlsRefs)].join(', '));
}

// Look for fetch/XMLHttpRequest
console.log('\n=== Network Request References ===');
const fetchRefs = original.match(/fetch\s*\(|XMLHttpRequest|\.ajax|axios/gi);
if (fetchRefs) {
  console.log('Network request references:', fetchRefs.length);
  console.log('Types:', [...new Set(fetchRefs)].join(', '));
}

// Look for the pageData or similar config
console.log('\n=== Config/Data References ===');
const configRefs = original.match(/pageData|config|options|settings/gi);
if (configRefs) {
  console.log('Config references:', configRefs.length);
}

// Look for encryption/decryption
console.log('\n=== Crypto References ===');
const cryptoRefs = original.match(/crypto|CryptoJS|AES|encrypt|decrypt|atob|btoa/gi);
if (cryptoRefs) {
  console.log('Crypto references:', cryptoRefs.length);
  console.log('Types:', [...new Set(cryptoRefs)].join(', '));
}

// Look for the actual player initialization
console.log('\n=== Looking for Player Init Pattern ===');
// Common patterns: jwplayer("player").setup({...})
const playerInitPattern = /\w+\s*\(\s*["'][^"']+["']\s*\)\s*\.\s*setup\s*\(/g;
const playerInits = original.match(playerInitPattern);
if (playerInits) {
  console.log('Player init patterns:', playerInits.length);
  playerInits.forEach(p => console.log('  ', p));
}

// Look for event listeners that might handle video
console.log('\n=== Event Listener Patterns ===');
const eventPatterns = original.match(/addEventListener\s*\(\s*["'][^"']+["']/g);
if (eventPatterns) {
  const uniqueEvents = [...new Set(eventPatterns)];
  console.log('Event listeners:', uniqueEvents.length);
  uniqueEvents.slice(0, 20).forEach(e => console.log('  ', e));
}

// Look for the actual video URL construction
console.log('\n=== URL Construction Patterns ===');
// Look for string concatenation that might build URLs
const urlBuildPatterns = original.match(/["']https?:\/\/["']\s*\+|["']\/\/["']\s*\+/g);
if (urlBuildPatterns) {
  console.log('URL building patterns:', urlBuildPatterns.length);
}

// Look for domain references
console.log('\n=== Domain References ===');
const domainPatterns = original.match(/["'][a-z0-9-]+\.[a-z]{2,}["']/gi);
if (domainPatterns) {
  const uniqueDomains = [...new Set(domainPatterns)];
  console.log('Domain references:', uniqueDomains.length);
  uniqueDomains.slice(0, 20).forEach(d => console.log('  ', d));
}

// Look for the beautified version if it exists
console.log('\n\n=== Checking beautified version ===');
try {
  const beautified = fs.readFileSync('rapidairmax-app-beautified.js', 'utf8');
  console.log('Beautified file size:', beautified.length);
  
  // Look for clearer patterns in beautified code
  const jwSetup = beautified.match(/jwplayer[^;]{0,500}setup/gi);
  if (jwSetup) {
    console.log('\nJWPlayer setup in beautified:');
    jwSetup.slice(0, 3).forEach(s => console.log('  ', s.substring(0, 200)));
  }
} catch (e) {
  console.log('No beautified version found');
}
