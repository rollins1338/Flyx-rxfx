/**
 * Test the AnimeKai encryption on RPI
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function test() {
  // Test with episode 140 (the one we know works)
  console.log('=== Test: Full extract for DBZ episode 140 ===\n');
  
  const url = `${RPI_URL}/animekai/full-extract?key=${RPI_KEY}&kai_id=d4e49A&episode=140`;
  console.log('URL:', url.substring(0, 80) + '...\n');
  
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
