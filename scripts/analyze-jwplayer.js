/**
 * Analyze the JWPlayer script for video source setup
 */

const fs = require('fs');

const code = fs.readFileSync('rapidshare-jwplayer.js', 'utf8');

console.log('=== Analyzing JWPlayer Script ===\n');
console.log('Script length:', code.length);

// Look for setup function
const setupMatch = code.match(/setup\s*:\s*function[^}]+\}/);
if (setupMatch) {
  console.log('\nSetup function found:');
  console.log(setupMatch[0].substring(0, 500));
}

// Look for sources handling
const sourcesMatch = code.match(/sources\s*[=:][^;]+/g);
if (sourcesMatch) {
  console.log('\n\nSources patterns:');
  sourcesMatch.slice(0, 5).forEach(s => console.log('  ', s.substring(0, 100)));
}

// Look for file handling
const fileMatch = code.match(/file\s*[=:][^;,}]+/g);
if (fileMatch) {
  console.log('\n\nFile patterns:');
  [...new Set(fileMatch)].slice(0, 10).forEach(f => console.log('  ', f.substring(0, 80)));
}

// Look for m3u8 handling
const m3u8Match = code.match(/m3u8[^;]{0,100}/gi);
if (m3u8Match) {
  console.log('\n\nM3U8 patterns:');
  m3u8Match.forEach(m => console.log('  ', m.substring(0, 80)));
}

// The key is to find where the video source URL is constructed
// Look for URL construction patterns
console.log('\n\n=== URL Construction ===');
const urlPatterns = code.match(/https?:\/\/[^"'\s]+/g);
if (urlPatterns) {
  console.log('URLs found:');
  [...new Set(urlPatterns)].forEach(u => console.log('  ', u));
}

// Look for the playlist/source configuration
const playlistMatch = code.match(/playlist\s*[=:][^;]+/g);
if (playlistMatch) {
  console.log('\n\nPlaylist patterns:');
  playlistMatch.slice(0, 5).forEach(p => console.log('  ', p.substring(0, 100)));
}
