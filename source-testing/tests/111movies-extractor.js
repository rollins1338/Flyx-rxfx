/**
 * 111movies stream extractor using Puppeteer
 * This extracts the stream URL by loading the page and intercepting the API response
 */

const puppeteer = require('puppeteer');

async function extract111MoviesStream(tmdbId, type = 'movie', season = null, episode = null) {
  console.log(`Extracting stream for ${type} ${tmdbId}${season ? ` S${season}E${episode}` : ''}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture the stream response
    let streamData = null;
    let sources = [];
    
    page.on('response', async res => {
      const url = res.url();
      
      // Capture sources response (ends with /sr)
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        try {
          const data = await res.json();
          sources = data;
          console.log(`Found ${data.length} sources`);
        } catch (e) {}
      }
      
      // Capture stream response (contains the m3u8 URL)
      if (url.includes('fcd552c4') && !url.endsWith('/sr') && res.status() === 200) {
        try {
          const data = await res.json();
          if (data.url) {
            streamData = data;
            console.log('Found stream URL');
          }
        } catch (e) {}
      }
    });
    
    // Build URL
    let pageUrl;
    if (type === 'movie') {
      pageUrl = `https://111movies.com/movie/${tmdbId}`;
    } else {
      pageUrl = `https://111movies.com/tv/${tmdbId}/${season}/${episode}`;
    }
    
    console.log('Loading:', pageUrl);
    await page.goto(pageUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Wait a bit for the stream to load
    await new Promise(r => setTimeout(r, 3000));
    
    if (!streamData) {
      console.log('No stream data found');
      return null;
    }
    
    return {
      url: streamData.url,
      tracks: streamData.tracks || [],
      sources: sources.map(s => ({
        name: s.name,
        description: s.description
      }))
    };
    
  } finally {
    await browser.close();
  }
}

// Test
async function main() {
  console.log('=== TESTING 111MOVIES EXTRACTOR ===\n');
  
  // Test with The Dark Knight (TMDB 155)
  const result = await extract111MoviesStream('155', 'movie');
  
  if (result) {
    console.log('\n=== RESULT ===\n');
    console.log('Stream URL:', result.url);
    console.log('Subtitles:', result.tracks.length);
    console.log('Sources:', result.sources);
    
    // Test if the stream URL works
    console.log('\n=== TESTING STREAM URL ===\n');
    
    const https = require('https');
    const response = await new Promise((resolve, reject) => {
      https.get(result.url, {
        headers: {
          'Referer': 'https://111movies.com/',
          'Origin': 'https://111movies.com'
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
    
    console.log('Status:', response.status);
    console.log('M3U8 content:', response.data.substring(0, 500));
  }
}

module.exports = { extract111MoviesStream };

if (require.main === module) {
  main().catch(console.error);
}
