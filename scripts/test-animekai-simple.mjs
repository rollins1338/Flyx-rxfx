/**
 * Simple AnimeKai Test - Just call the API endpoint
 */

const testAnimeId = 57658; // Jujutsu Kaisen Season 3
const testEpisode = 1;

console.log('Testing AnimeKai Extraction via API...\n');

// Test via localhost API (requires dev server running)
async function testViaAPI() {
  try {
    const url = `http://localhost:3000/api/anime/stream?malId=${testAnimeId}&episode=${testEpisode}&provider=animekai`;
    console.log('URL:', url);
    console.log('Note: Requires dev server running (npm run dev)\n');
    
    const res = await fetch(url);
    const data = await res.json();
    
    console.log('Status:', res.status);
    console.log('Success:', data.success);
    console.log('Sources:', data.sources?.length || 0);
    console.log('Provider:', data.provider || data.providers);
    
    if (data.sources) {
      data.sources.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.title}`);
        console.log('   Language:', s.language);
        console.log('   URL:', s.url.substring(0, 80) + '...');
      });
    }
    
    if (data.error) {
      console.log('\nError:', data.error);
    }
    
    return data;
  } catch (e) {
    console.error('Error:', e.message);
    return null;
  }
}

// Test the worker health
async function testWorkerHealth() {
  try {
    const res = await fetch('https://media-proxy.vynx.workers.dev/animekai/health');
    const data = await res.json();
    console.log('\nWorker Health:', data.status);
    console.log('RPI Configured:', data.rpiProxy?.configured);
    return data;
  } catch (e) {
    console.error('Worker health check failed:', e.message);
    return null;
  }
}

async function run() {
  await testWorkerHealth();
  console.log('\n' + '='.repeat(80) + '\n');
  await testViaAPI();
}

run();
