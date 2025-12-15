/**
 * Test the 111movies extractor
 */

const BASE_URL = 'https://111movies.com';

function getOneMoviesEmbedUrl(tmdbId, type = 'movie', season, episode) {
  if (type === 'movie') {
    return `${BASE_URL}/movie/${tmdbId}`;
  } else {
    return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  }
}

async function getOneMoviesSubtitles(tmdbId) {
  try {
    const response = await fetch(`https://sub.wyzie.ru/search?id=${tmdbId}&format=srt`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return [];
    }

    const subtitles = await response.json();
    
    return subtitles.slice(0, 20).map(sub => ({
      url: sub.url,
      label: sub.display || sub.language,
      language: sub.language,
    }));
  } catch (error) {
    console.error('Subtitles error:', error);
    return [];
  }
}

async function extractOneMoviesStream(tmdbId, type = 'movie', season, episode) {
  try {
    const embedUrl = getOneMoviesEmbedUrl(tmdbId, type, season, episode);
    
    console.log(`Embed URL: ${embedUrl}`);

    // Verify the page exists
    const pageResponse = await fetch(embedUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!pageResponse.ok) {
      console.error(`Page not found: ${pageResponse.status}`);
      return null;
    }

    // Fetch subtitles
    const subtitles = await getOneMoviesSubtitles(tmdbId);

    return {
      embedUrl,
      sources: [
        { name: 'Alpha', description: 'Original audio' },
        { name: 'Charlie', description: 'Original audio' },
        { name: 'Delta', description: 'Original audio' },
      ],
      subtitles,
    };

  } catch (error) {
    console.error('Extraction error:', error);
    return null;
  }
}

async function main() {
  console.log('=== TESTING 111MOVIES EXTRACTOR ===\n');
  
  // Test movie
  console.log('Testing movie (The Dark Knight - TMDB 155)...');
  const movieResult = await extractOneMoviesStream('155', 'movie');
  
  if (movieResult) {
    console.log('\nMovie Result:');
    console.log('  Embed URL:', movieResult.embedUrl);
    console.log('  Sources:', movieResult.sources.length);
    console.log('  Subtitles:', movieResult.subtitles.length);
    if (movieResult.subtitles.length > 0) {
      console.log('  First subtitle:', movieResult.subtitles[0]);
    }
  }
  
  // Test TV show
  console.log('\n\nTesting TV show (Game of Thrones S1E1 - TMDB 1399)...');
  const tvResult = await extractOneMoviesStream('1399', 'tv', 1, 1);
  
  if (tvResult) {
    console.log('\nTV Result:');
    console.log('  Embed URL:', tvResult.embedUrl);
    console.log('  Sources:', tvResult.sources.length);
    console.log('  Subtitles:', tvResult.subtitles.length);
  }
  
  // Test non-existent content
  console.log('\n\nTesting non-existent content...');
  const badResult = await extractOneMoviesStream('999999999', 'movie');
  console.log('Bad result:', badResult ? 'found' : 'not found');
}

main().catch(console.error);
