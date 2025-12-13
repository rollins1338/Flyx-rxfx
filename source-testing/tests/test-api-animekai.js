// Test the actual API endpoint to verify requiresSegmentProxy is false for MegaUp

async function test() {
  const params = new URLSearchParams({
    tmdbId: '37854',  // One Piece
    type: 'tv',
    provider: 'animekai',
    season: '1',
    episode: '646'
  });
  
  console.log('Calling API: /api/stream/extract?' + params.toString());
  console.log('');
  
  try {
    const res = await fetch(`http://localhost:3000/api/stream/extract?${params}`);
    const data = await res.json();
    
    console.log('Status:', res.status);
    console.log('Provider:', data.provider);
    console.log('Sources count:', data.sources?.length || 0);
    
    if (data.sources && data.sources.length > 0) {
      console.log('\nSources:');
      data.sources.forEach((src, i) => {
        console.log(`\n[${i + 1}] ${src.title}`);
        console.log('    URL:', src.url?.substring(0, 80) + '...');
        console.log('    requiresSegmentProxy:', src.requiresSegmentProxy);
        console.log('    referer:', src.referer);
        
        // Check if MegaUp URL has proxy disabled
        const isMegaUp = src.url?.includes('megaup') || src.url?.includes('hub26link') || src.url?.includes('app28base');
        if (isMegaUp) {
          if (src.requiresSegmentProxy === false) {
            console.log('    ✓ CORRECT: MegaUp URL has proxy disabled');
          } else {
            console.log('    ✗ WRONG: MegaUp URL should have requiresSegmentProxy: false');
          }
        }
      });
    } else {
      console.log('Error:', data.error || data.message || 'No sources');
    }
  } catch (e) {
    console.log('Error:', e.message);
    console.log('\nMake sure the dev server is running: npm run dev');
  }
}

test();
