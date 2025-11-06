/**
 * Test to reproduce the 500 error in analytics tracking
 */

async function test500Error() {
  try {
    console.log('🧪 Testing analytics tracking 500 error...');
    
    // Test GET endpoint first
    console.log('\n1. Testing GET endpoint...');
    const getResponse = await fetch('http://localhost:3000/api/analytics/track');
    console.log(`GET Status: ${getResponse.status}`);
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.log('GET Error Response:', errorText);
    } else {
      const getData = await getResponse.json();
      console.log('GET Success:', getData);
    }
    
    // Test POST endpoint
    console.log('\n2. Testing POST endpoint...');
    const postResponse = await fetch('http://localhost:3000/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        event_type: 'test_500_debug',
        timestamp: Date.now()
      }])
    });
    
    console.log(`POST Status: ${postResponse.status}`);
    
    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.log('POST Error Response:', errorText);
    } else {
      const postData = await postResponse.json();
      console.log('POST Success:', postData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test500Error();