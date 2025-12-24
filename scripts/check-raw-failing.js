/**
 * Check raw response for failing video
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';

async function main() {
  const mediaUrl = `https://megaup22.online/media/${failingVideoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  console.log('Fetching:', mediaUrl);
  
  const response = await fetch(proxyUrl);
  const text = await response.text();
  
  const data = JSON.parse(text);
  console.log('API status:', data.status);
  console.log('Result length:', data.result?.length);
  
  // Show base64 around position 100 (which is ~133 in base64)
  const result = data.result;
  console.log('\nBase64 chars 120-160:');
  console.log(result.substring(120, 160));
  
  // Decode and show hex around position 100
  const base64 = result.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  console.log('\nEncrypted bytes 95-110 (hex):');
  console.log(encBytes.slice(95, 110).toString('hex'));
  
  // Compare with working video
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const workingUrl = `https://megaup22.online/media/${workingVideoId}`;
  const workingProxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(workingUrl)}`;
  
  const workingResponse = await fetch(workingProxyUrl);
  const workingData = await workingResponse.json();
  const workingBase64 = workingData.result.replace(/-/g, '+').replace(/_/g, '/');
  const workingEncBytes = Buffer.from(workingBase64, 'base64');
  
  console.log('\nWorking encrypted bytes 95-110 (hex):');
  console.log(workingEncBytes.slice(95, 110).toString('hex'));
  
  // XOR to see difference
  console.log('\nXOR of encrypted bytes 95-110:');
  const xor = Buffer.alloc(15);
  for (let i = 0; i < 15; i++) {
    xor[i] = encBytes[95 + i] ^ workingEncBytes[95 + i];
  }
  console.log(xor.toString('hex'));
}

main().catch(console.error);
