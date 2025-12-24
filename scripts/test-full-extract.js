/**
 * Test the full AnimeKai extraction flow via CF Worker -> RPI
 * Dragon Ball Z: kai_id=d4e49A, episode=140 (S5E1)
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function testFullExtract() {
  console.log('=== Testing /animekai/full-extract ===');
  console.log('Dragon Ball Z: kai_id=d4e49A, episode=140 (S5E1)\n');
  
  const url = `${RPI_URL}/animekai/full-extract?key=${RPI_KEY}&kai_id=d4e49A&episode=140`;
  console.log('URL:', url.substring(0, 80) + '...\n');
  
  try {
    const start = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const elapsed = Date.now() - start;
    
    console.log(`Status: ${response.status} (${elapsed}ms)`);
    
    const data = await response.json();
    console.log('\nResponse:', JSON.stringify(data, null, 2));
    
    if (data.success && data.streamUrl) {
      console.log('\n✅ SUCCESS!');
      console.log('Stream URL:', data.streamUrl.substring(0, 100) + '...');
    } else {
      console.log('\n❌ FAILED');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFullExtract();
