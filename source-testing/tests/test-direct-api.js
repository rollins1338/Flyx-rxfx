/**
 * Test API directly without browser - check if it's an IP/geo block
 */

async function main() {
  console.log('=== TESTING API DIRECTLY ===\n');
  
  const fetch = (await import('node-fetch')).default;
  
  // Test different endpoints
  const endpoints = [
    'https://api.smashystream.top/api/v1/status',
    'https://api.smashystream.top/api/v1/status?tmdb=155',
    'https://smashystream.top/api/v1/status',
    'https://embed.smashystream.com/dude.php?imdb=tt0468569',
    'https://player.smashystream.com/'
  ];
  
  for (const url of endpoints) {
    console.log(`\nTesting: ${url}`);
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': 'https://player.smashystream.com/'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      console.log(`  Status: ${response.status}`);
      const body = await response.text();
      console.log(`  Body: ${body.substring(0, 200)}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Test with a fresh token format
  console.log('\n\n=== TESTING WITH MOCK TOKEN ===\n');
  
  // Generate a mock token in the correct format
  const timestamp = Math.floor(Date.now() / 1000);
  const mockToken = `7f6_Uvi5w9kiubAtfgbkk3aa5xZzHL5YgY7a.IBxPrs2bvwbVcXbMU0eL9Q.${timestamp}`;
  const mockUserId = '8E4A4253_00c7fb9880a5db8c353db5c26423bcb3';
  
  const apiUrl = `https://api.smashystream.top/api/v1/data?tmdb=155&token=${mockToken}&user_id=${mockUserId}`;
  
  console.log('URL:', apiUrl);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://player.smashystream.com/',
        'Origin': 'https://player.smashystream.com'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers), null, 2));
    const body = await response.text();
    console.log('Body:', body.substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);
