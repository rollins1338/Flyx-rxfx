/**
 * Test AnimeKai by checking what the worker metrics show
 */

console.log('Checking AnimeKai Worker Metrics...\n');

async function checkMetrics() {
  try {
    const res = await fetch('https://media-proxy.vynx.workers.dev/health');
    const data = await res.json();
    
    console.log('Worker Health:', data.status);
    console.log('Uptime:', data.uptime);
    console.log('\nMetrics:');
    console.log('  Total Requests:', data.metrics.totalRequests);
    console.log('  HiAnime Requests:', data.metrics.hianimeRequests);
    console.log('  AnimeKai Requests:', data.metrics.animekaiRequests);
    console.log('  Errors:', data.metrics.errors);
    
    console.log('\n' + '='.repeat(80));
    
    if (data.metrics.animekaiRequests > 0) {
      console.log('✅ AnimeKai HAS been used! (' + data.metrics.animekaiRequests + ' requests)');
      console.log('   This means AnimeKai extraction is working on the worker.');
    } else {
      console.log('⚠️  AnimeKai has NOT been used yet (0 requests)');
      console.log('   This could mean:');
      console.log('   1. No one has requested AnimeKai streams yet');
      console.log('   2. The API is only using HiAnime');
      console.log('   3. AnimeKai extraction is failing silently');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\nTo test AnimeKai extraction:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Open browser: http://localhost:3000/anime/57658/watch?episode=1');
    console.log('3. Check if you see sources labeled [AnimeKai]');
    console.log('4. Check browser console for extraction logs');
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkMetrics();
