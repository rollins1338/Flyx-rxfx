/**
 * Test LIVE Production Anime Playback
 */

const LIVE_URL = 'https://flyx.tv';
const testAnimeId = 57658; // Jujutsu Kaisen Season 3
const testEpisode = 1;

console.log('='.repeat(80));
console.log('TESTING LIVE PRODUCTION ANIME PLAYBACK');
console.log('='.repeat(80));
console.log(`URL: ${LIVE_URL}`);
console.log(`Anime: MAL ID ${testAnimeId}, Episode ${testEpisode}\n`);

async function testLiveAPI() {
  try {
    const url = `${LIVE_URL}/api/anime/stream?malId=${testAnimeId}&episode=${testEpisode}`;
    console.log('Fetching:', url);
    console.log('');
    
    const startTime = Date.now();
    const res = await fetch(url);
    const elapsed = Date.now() - startTime;
    const data = await res.json();
    
    console.log(`Response: ${res.status} (${elapsed}ms)`);
    console.log('Success:', data.success);
    console.log('');
    
    if (data.success) {
      console.log('✅ API WORKS!');
      console.log('');
      console.log('Sources Found:', data.sources?.length || 0);
      console.log('Providers Used:', data.providers || data.provider);
      console.log('');
      
      if (data.sources) {
        data.sources.forEach((source, i) => {
          console.log(`${i + 1}. ${source.title}`);
          console.log(`   Language: ${source.language || 'unknown'}`);
          console.log(`   Type: ${source.type}`);
          console.log(`   URL: ${source.url.substring(0, 80)}...`);
          console.log('');
        });
      }
      
      console.log('Subtitles:', data.subtitles?.length || 0);
      console.log('Execution Time:', data.executionTime + 'ms');
      
      // Check if BOTH providers are present
      console.log('');
      console.log('='.repeat(80));
      const hasHiAnime = data.sources?.some(s => s.title.includes('HiAnime'));
      const hasAnimeKai = data.sources?.some(s => s.title.includes('AnimeKai'));
      
      if (hasHiAnime && hasAnimeKai) {
        console.log('✅ BOTH PROVIDERS WORKING!');
        console.log('   - HiAnime: ✅');
        console.log('   - AnimeKai: ✅');
      } else if (hasHiAnime) {
        console.log('⚠️  ONLY HiAnime working');
        console.log('   - HiAnime: ✅');
        console.log('   - AnimeKai: ❌');
      } else if (hasAnimeKai) {
        console.log('⚠️  ONLY AnimeKai working');
        console.log('   - HiAnime: ❌');
        console.log('   - AnimeKai: ✅');
      } else {
        console.log('❌ NO PROVIDERS WORKING!');
      }
      
    } else {
      console.log('❌ API FAILED!');
      console.log('Error:', data.error);
    }
    
    return data;
  } catch (e) {
    console.error('❌ REQUEST FAILED:', e.message);
    return null;
  }
}

async function testStreamPlayback(sources) {
  if (!sources || sources.length === 0) {
    console.log('\nNo sources to test playback');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TESTING STREAM PLAYBACK');
  console.log('='.repeat(80));
  
  for (let i = 0; i < Math.min(sources.length, 2); i++) {
    const source = sources[i];
    console.log(`\nTesting: ${source.title}`);
    console.log('URL:', source.url.substring(0, 80) + '...');
    
    try {
      const startTime = Date.now();
      const res = await fetch(source.url);
      const elapsed = Date.now() - startTime;
      
      if (res.ok) {
        const text = await res.text();
        const isM3U8 = text.includes('#EXTM3U');
        console.log(`✅ SUCCESS (${elapsed}ms)`);
        console.log('   Status:', res.status);
        console.log('   Content-Type:', res.headers.get('content-type'));
        console.log('   Size:', text.length, 'bytes');
        console.log('   Is M3U8:', isM3U8);
        if (isM3U8) {
          const lines = text.split('\n').filter(l => l && !l.startsWith('#'));
          console.log('   Playlist URLs:', lines.length);
        }
      } else {
        console.log(`❌ FAILED (${elapsed}ms)`);
        console.log('   Status:', res.status, res.statusText);
      }
    } catch (e) {
      console.log('❌ ERROR:', e.message);
    }
  }
}

async function run() {
  const data = await testLiveAPI();
  if (data && data.sources) {
    await testStreamPlayback(data.sources);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

run();
