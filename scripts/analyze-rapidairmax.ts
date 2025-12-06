/**
 * Analyze rapidairmax.site embed player
 * 
 * The page has:
 * - window.__PAGE_DATA with encrypted data
 * - JWPlayer for playback
 * - app.js that decrypts and plays
 */

const EMBED_URL = 'https://rapidairmax.site/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://rapidairmax.site/'
    }
  });
  return res.text();
}

async function analyze() {
  console.log('=== Analyzing rapidairmax.site ===\n');
  
  // Fetch the app.js
  const appJsUrl = 'https://rapidairmax.site/assets/b/2457433dff868594ecbf3b15e9f22a46efd70a/min/app.js?v=19a76d77646';
  console.log('Fetching app.js...');
  
  const appJs = await fetchText(appJsUrl);
  console.log('App.js length:', appJs.length);
  
  // Save for analysis
  const fs = await import('fs');
  fs.writeFileSync('rapidairmax-app.js', appJs);
  console.log('Saved to rapidairmax-app.js');
  
  // Look for decryption patterns
  console.log('\n=== Pattern Analysis ===');
  
  // Look for __PAGE_DATA usage
  const pageDataUsage = appJs.match(/__PAGE_DATA[^;]{0,100}/g);
  console.log('__PAGE_DATA usage:', pageDataUsage?.slice(0, 3));
  
  // Look for decrypt/decode functions
  const decryptPatterns = appJs.match(/decrypt|decode|atob|btoa/gi);
  console.log('Decrypt patterns:', decryptPatterns?.slice(0, 10));
  
  // Look for m3u8 references
  const m3u8Refs = appJs.match(/m3u8/gi);
  console.log('M3U8 references:', m3u8Refs?.length || 0);
  
  // Look for source/file patterns
  const sourcePatterns = appJs.match(/sources?|file/gi);
  console.log('Source/file patterns:', sourcePatterns?.slice(0, 10));
  
  // Look for API endpoints
  const apiPatterns = appJs.match(/["']\/[a-z]+\/[^"']+["']/gi);
  console.log('API patterns:', apiPatterns?.slice(0, 10));
  
  // Look for base64 patterns
  const base64Pattern = appJs.match(/[A-Za-z0-9+/=]{50,}/g);
  console.log('Long base64-like strings:', base64Pattern?.slice(0, 3));
  
  // Try to decode PAGE_DATA as base64
  console.log('\n=== Trying to decode PAGE_DATA ===');
  try {
    const decoded = Buffer.from(PAGE_DATA, 'base64').toString('utf8');
    console.log('Base64 decoded:', decoded.substring(0, 200));
  } catch (e) {
    console.log('Not valid base64');
  }
  
  // Try URL-safe base64
  try {
    const urlSafe = PAGE_DATA.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    console.log('URL-safe base64 decoded:', decoded.substring(0, 200));
  } catch (e) {
    console.log('Not valid URL-safe base64');
  }
}

analyze().catch(console.error);
