/**
 * Script to re-extract fresh stream URLs when they expire
 * Usage: node fix-expired-stream.js [tmdbId] [mediaType] [season] [episode]
 */

async function reExtractStream(tmdbId, mediaType = 'movie', season = null, episode = null) {
  console.log('🔄 Re-extracting fresh stream URL...');
  console.log('Parameters:', { tmdbId, mediaType, season, episode });
  
  try {
    // Build extraction URL
    let extractUrl = `http://localhost:3000/api/stream/extract?tmdbId=${tmdbId}&mediaType=${mediaType}`;
    if (season) extractUrl += `&season=${season}`;
    if (episode) extractUrl += `&episode=${episode}`;
    
    console.log('🌐 Extraction URL:', extractUrl);
    
    const response = await fetch(extractUrl);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Fresh stream extracted successfully!');
      console.log('📊 Sources found:', data.data.sources.length);
      
      data.data.sources.forEach((source, index) => {
        console.log(`\n🎬 Source ${index + 1}:`);
        console.log('  Quality:', source.quality);
        console.log('  Type:', source.type);
        console.log('  URL:', source.url.substring(0, 100) + '...');
      });
      
      if (data.data.subtitles.length > 0) {
        console.log(`\n📝 Subtitles found: ${data.data.subtitles.length}`);
      }
      
      return data.data;
    } else {
      console.log('❌ Extraction failed:', data.error || data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Re-extraction error:', error.message);
    return null;
  }
}

// Test with example parameters
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node fix-expired-stream.js [tmdbId] [mediaType] [season] [episode]');
    console.log('📋 Example: node fix-expired-stream.js 550 movie');
    console.log('📋 Example: node fix-expired-stream.js 1399 tv 1 1');
    return;
  }
  
  const [tmdbId, mediaType = 'movie', season, episode] = args;
  await reExtractStream(tmdbId, mediaType, season, episode);
}

main().catch(console.error);