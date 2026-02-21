/**
 * Test AnimeKai Extraction RIGHT NOW
 */

const testAnimeId = 57658; // Jujutsu Kaisen Season 3
const testEpisode = 1;

console.log('='.repeat(80));
console.log('ANIMEKAI EXTRACTION TEST');
console.log('='.repeat(80));
console.log(`Test Anime: MAL ID ${testAnimeId}, Episode ${testEpisode}`);
console.log('');

async function testAnimeKaiDirect() {
  console.log('Testing AnimeKai Native Extractor...');
  console.log('-'.repeat(80));
  
  try {
    // Import the extractor
    const { extractAnimeKaiStreams } = await import('../app/lib/services/animekai-extractor.ts');
    
    console.log('Calling extractAnimeKaiStreams...');
    const startTime = Date.now();
    
    const result = await extractAnimeKaiStreams(
      '0',           // tmdbId (not used when malId provided)
      'tv',          // type
      1,             // season
      testEpisode,   // episode
      testAnimeId,   // malId
      'Jujutsu Kaisen' // title
    );
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\nResult (${elapsed}ms):`);
    console.log('Success:', result.success);
    console.log('Sources:', result.sources?.length || 0);
    
    if (result.success && result.sources) {
      result.sources.forEach((source, i) => {
        console.log(`\nSource ${i + 1}:`);
        console.log('  Title:', source.title);
        console.log('  Quality:', source.quality);
        console.log('  Language:', source.language || 'unknown');
        console.log('  Type:', source.type);
        console.log('  URL:', source.url.substring(0, 100) + '...');
        console.log('  Requires Proxy:', source.requiresSegmentProxy);
        console.log('  Skip Origin:', source.skipOrigin);
        if (source.skipIntro) console.log('  Skip Intro:', source.skipIntro);
        if (source.skipOutro) console.log('  Skip Outro:', source.skipOutro);
      });
      
      console.log('\nSubtitles:', result.subtitles?.length || 0);
      if (result.subtitles) {
        result.subtitles.forEach((sub, i) => {
          console.log(`  ${i + 1}. ${sub.label} (${sub.language})`);
        });
      }
    } else {
      console.log('Error:', result.error);
    }
    
    return result;
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
    return null;
  }
}

async function testAnimeKaiWorker() {
  console.log('\n\nTesting AnimeKai via Cloudflare Worker...');
  console.log('-'.repeat(80));
  
  try {
    // The worker has /animekai/full-extract endpoint
    const url = `https://media-proxy.vynx.workers.dev/animekai/full-extract?kai_id=UNKNOWN&episode=${testEpisode}`;
    console.log('URL:', url);
    console.log('Note: We need the AnimeKai content_id, not MAL ID');
    console.log('The native extractor handles MAL ID → AnimeKai ID lookup');
    
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

async function run() {
  const result = await testAnimeKaiDirect();
  await testAnimeKaiWorker();
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
  
  if (result && result.success) {
    console.log('✅ AnimeKai extraction WORKS!');
    console.log(`   Found ${result.sources?.length || 0} sources`);
  } else {
    console.log('❌ AnimeKai extraction FAILED!');
    console.log('   Error:', result?.error || 'Unknown error');
  }
}

run().catch(console.error);
