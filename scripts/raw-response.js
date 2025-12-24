/**
 * Get raw response and check if it's valid base64
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const failingVideoId = 'js_JTDu8WS2JcOLzF79M6RvpCQ';

async function main() {
  const mediaUrl = `https://megaup22.online/media/${failingVideoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  console.log('Fetching:', mediaUrl);
  
  const response = await fetch(proxyUrl);
  const text = await response.text();
  
  console.log('\nRaw response (first 500 chars):');
  console.log(text.substring(0, 500));
  
  // Parse as JSON
  const data = JSON.parse(text);
  console.log('\nAPI status:', data.status);
  console.log('Result length:', data.result?.length);
  
  // Check if result is valid base64
  const result = data.result;
  const base64Regex = /^[A-Za-z0-9+/_-]+=*$/;
  const isValidBase64 = base64Regex.test(result.replace(/-/g, '+').replace(/_/g, '/'));
  console.log('Is valid base64:', isValidBase64);
  
  // Show first and last 50 chars of result
  console.log('\nResult first 50:', result.substring(0, 50));
  console.log('Result last 50:', result.substring(result.length - 50));
}

main().catch(console.error);
