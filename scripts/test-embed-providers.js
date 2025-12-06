/**
 * Test common embed providers with 1movies content IDs
 * 
 * Many pirate sites use the same embed providers.
 * We'll try to find which one 1movies uses.
 */

const https = require('https');
const http = require('http');

// Known IDs from 1movies
const linkId = 'doO486al6Q';
const movieId = 'c4a7-KGm';
const episodeId = 'cYu_-KCi';

// FNAF 2 TMDB ID (approximate)
const tmdbId = '1228246';
const imdbId = 'tt21692408'; // FNAF 2 IMDB

// Common embed provider URL patterns
const embedPatterns = [
  // VidSrc variants
  `https://vidsrc.xyz/embed/movie/${tmdbId}`,
  `https://vidsrc.to/embed/movie/${tmdbId}`,
  `https://vidsrc.me/embed/movie/${tmdbId}`,
  `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
  `https://vidsrc.in/embed/movie/${tmdbId}`,
  
  // 2embed
  `https://2embed.cc/embed/${tmdbId}`,
  `https://2embed.org/embed/${tmdbId}`,
  
  // AutoEmbed
  `https://autoembed.co/movie/tmdb/${tmdbId}`,
  
  // SuperEmbed
  `https://multiembed.mov/directstream.php?video_id=${tmdbId}`,
  
  // MoviesAPI
  `https://moviesapi.club/movie/${tmdbId}`,
  
  // Embed.su
  `https://embed.su/embed/movie/${tmdbId}`,
  
  // VidLink
  `https://vidlink.pro/movie/${tmdbId}`,
  
  // Try with IMDB
  `https://vidsrc.xyz/embed/movie/${imdbId}`,
  `https://vidsrc.to/embed/movie/${imdbId}`,
  `https://2embed.cc/embed/${imdbId}`,
  
  // Try with 1movies link ID
  `https://vidsrc.xyz/embed/${linkId}`,
  `https://embed.su/embed/${linkId}`,
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          hasPlayer: data.includes('player') || data.includes('video') || data.includes('iframe'),
          hasM3u8: data.includes('m3u8'),
          size: data.length
        });
      });
    });
    
    req.on('error', () => resolve({ url, status: 'error', hasPlayer: false, hasM3u8: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 'timeout', hasPlayer: false, hasM3u8: false });
    });
  });
}

async function testProviders() {
  console.log('=== Testing Embed Providers ===\n');
  console.log('Testing with TMDB ID:', tmdbId);
  console.log('Testing with IMDB ID:', imdbId);
  console.log('Testing with 1movies Link ID:', linkId);
  console.log('');
  
  for (const url of embedPatterns) {
    const result = await checkUrl(url);
    const status = result.status === 200 ? '✓' : '✗';
    const player = result.hasPlayer ? '[HAS PLAYER]' : '';
    const m3u8 = result.hasM3u8 ? '[HAS M3U8]' : '';
    console.log(`${status} ${result.status} ${url} ${player} ${m3u8}`);
  }
}

testProviders();
