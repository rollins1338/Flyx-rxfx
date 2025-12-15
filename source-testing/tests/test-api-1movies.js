/**
 * Test the /api/stream/extract endpoint for 1movies
 */

async function testAPI() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('=== TESTING /api/stream/extract for 1movies ===\n');
  
  // Test explicit 1movies request
  const params = new URLSearchParams({
    tmdbId: '155',
    type: 'movie',
    provider: '1movies'
  });
  
  console.log(`Request: ${baseUrl}/api/stream/extract?${params}`);
  
  try {
    const response = await fetch(`${baseUrl}/api/stream/extract?${params}`);
    const data = await response.json();
    
    console.log('\nResponse status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 1500));
    
    if (data.sources && data.sources.length > 0) {
      console.log('\n=== SOURCES ===');
      for (const source of data.sources) {
        console.log(`- ${source.title}: ${source.url?.substring(0, 60)}...`);
        console.log(`  Status: ${source.status}, Proxy: ${source.requiresSegmentProxy}`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testAPI();
