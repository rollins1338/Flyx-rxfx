/**
 * Try to find the API endpoint that returns the m3u8 URL
 * by analyzing the m3u8 URL pattern
 */

const fs = require('fs');

// Known m3u8 URL pattern:
// https://rrr.rapidshare.cc/pmjz/v5/{token}/list.m3u8
const knownM3u8 = 'https://rrr.rapidshare.cc/pmjz/v5/bapD3C40jf5WGa2zsLH0R4MmBe5hkz4NP-Ck0ImGLNq2qGM7Z-61k3opVv2yJhb1aMVshDCSXG-ZNiMmOFLcJpAVO_NjxAYUfQRj3-IjcIu070-bmWpYkQWI7MzAEoftamVMjPPr_nr_X1Gf8dh01d0gVd5DU3qPkI5NAyNR1/list.m3u8';

// Extract the token
const tokenMatch = knownM3u8.match(/\/v5\/([^/]+)\/list\.m3u8/);
const token = tokenMatch ? tokenMatch[1] : null;

console.log('=== Analyzing M3U8 URL ===\n');
console.log('Known M3U8:', knownM3u8);
console.log('\nToken:', token);
console.log('Token length:', token?.length);

// The token is 169 characters - likely base64 encoded
if (token) {
  console.log('\n=== Decoding Token ===');
  
  // Try base64 decode
  try {
    const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    console.log('Decoded length:', decoded.length);
    console.log('Decoded hex:', decoded.toString('hex').substring(0, 100) + '...');
  } catch (e) {
    console.log('Base64 decode failed:', e.message);
  }
  
  // The token might contain:
  // - Video ID
  // - Timestamp/expiry
  // - Signature
  // - Quality info
  
  // Look for patterns in the token
  console.log('\n=== Token Analysis ===');
  
  // Check if it contains the embed ID
  const embedId = 'kJCuIjiwWSyJcOLzFLpK6xfpCQ';
  if (token.includes(embedId)) {
    console.log('Token contains embed ID!');
  }
  
  // Check for timestamp patterns (Unix timestamps are ~10 digits)
  const timestampMatch = token.match(/\d{10}/);
  if (timestampMatch) {
    console.log('Possible timestamp:', timestampMatch[0]);
    console.log('Date:', new Date(parseInt(timestampMatch[0]) * 1000));
  }
}

// Try to construct the API endpoint
console.log('\n\n=== Possible API Endpoints ===');

const baseUrls = [
  'https://rapidshare.cc',
  'https://rrr.rapidshare.cc',
  'https://rapidairmax.site',
];

const endpoints = [
  '/api/source',
  '/api/stream',
  '/api/video',
  '/api/file',
  '/ajax/source',
  '/ajax/stream',
  '/pmjz/api',
];

console.log('Endpoints to try:');
for (const base of baseUrls) {
  for (const endpoint of endpoints) {
    console.log(`  ${base}${endpoint}`);
  }
}

// The PAGE_DATA decryption likely produces something like:
// { file: "https://rrr.rapidshare.cc/pmjz/v5/{token}/list.m3u8" }
// or
// { sources: [{ file: "...", type: "hls" }] }

console.log('\n\n=== Expected Decrypted Format ===');
console.log('The PAGE_DATA likely decrypts to a JSON object like:');
console.log(JSON.stringify({
  file: 'https://rrr.rapidshare.cc/pmjz/v5/{token}/list.m3u8',
  // or
  sources: [{
    file: 'https://rrr.rapidshare.cc/pmjz/v5/{token}/list.m3u8',
    type: 'hls'
  }]
}, null, 2));
