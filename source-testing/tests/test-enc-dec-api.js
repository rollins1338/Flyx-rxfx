/**
 * Test the enc-dec.app API directly with proper parameters
 */

const ENC_DEC_API = 'https://enc-dec.app';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const TEST_EMBED_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function main() {
  console.log('Testing enc-dec.app API...\n');
  
  // Test 1: Basic dec-mega call
  console.log('=== Test 1: Basic dec-mega ===');
  try {
    const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify({ text: TEST_EMBED_URL }),
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 2: With agent parameter
  console.log('\n=== Test 2: With agent parameter ===');
  try {
    const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify({ 
        text: TEST_EMBED_URL,
        agent: HEADERS['User-Agent']
      }),
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 3: With url parameter instead of text
  console.log('\n=== Test 3: With url parameter ===');
  try {
    const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify({ 
        url: TEST_EMBED_URL,
        agent: HEADERS['User-Agent']
      }),
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 4: GET request
  console.log('\n=== Test 4: GET request ===');
  try {
    const response = await fetch(`${ENC_DEC_API}/api/dec-mega?url=${encodeURIComponent(TEST_EMBED_URL)}`, {
      headers: HEADERS,
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 5: Check API documentation
  console.log('\n=== Test 5: API root ===');
  try {
    const response = await fetch(`${ENC_DEC_API}/api`, {
      headers: HEADERS,
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 6: Check available endpoints
  console.log('\n=== Test 6: Available endpoints ===');
  const endpoints = [
    '/api/dec-mega',
    '/api/dec-megaup',
    '/api/megaup',
    '/api/hosters/megaup',
    '/hosters/megaup',
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${ENC_DEC_API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...HEADERS },
        body: JSON.stringify({ url: TEST_EMBED_URL }),
      });
      
      console.log(`${endpoint}: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log('  Response:', JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log(`${endpoint}: Error - ${e.message}`);
    }
  }
}

main().catch(console.error);
