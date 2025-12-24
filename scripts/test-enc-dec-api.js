#!/usr/bin/env node
/**
 * Test the enc-dec.app API for MegaUp decryption
 * This verifies the API works before deploying to RPI
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Dragon Ball Z - the failing video
const DBZ_KAI_ID = 'd4e49A';
const DBZ_EPISODE = 140;

async function testEncDecAPI() {
  console.log('=== Testing enc-dec.app API for MegaUp decryption ===\n');
  
  // Step 1: Get encrypted data from RPI (it can fetch from MegaUp)
  console.log('Step 1: Fetching encrypted data from MegaUp via RPI...');
  
  // First, we need to get the encrypted embed from AnimeKai
  // Let's use the full-extract endpoint to see what happens
  const fullExtractUrl = `${RPI_URL}/animekai/full-extract?key=${RPI_KEY}&kai_id=${DBZ_KAI_ID}&episode=${DBZ_EPISODE}`;
  console.log(`URL: ${fullExtractUrl}\n`);
  
  const response = await fetch(fullExtractUrl);
  const result = await response.json();
  
  console.log('Response:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('\n✅ SUCCESS! Stream URL:', result.streamUrl);
  } else {
    console.log('\n❌ FAILED:', result.error);
    if (result.debug) {
      console.log('Debug info:', JSON.stringify(result.debug, null, 2));
    }
  }
}

// Also test the enc-dec.app API directly with a known encrypted value
async function testAPIDirectly() {
  console.log('\n=== Testing enc-dec.app API directly ===\n');
  
  // First get encrypted data from MegaUp via RPI proxy
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  const mediaUrl = `https://megaup22.online/media/${failingVideoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  console.log('Fetching encrypted data from MegaUp...');
  const mediaResponse = await fetch(proxyUrl, { headers: { 'User-Agent': UA } });
  const mediaData = await mediaResponse.json();
  
  if (!mediaData.result) {
    console.log('Failed to get encrypted data:', mediaData);
    return;
  }
  
  console.log(`Got encrypted data: ${mediaData.result.length} chars`);
  console.log(`First 50: ${mediaData.result.substring(0, 50)}`);
  
  // Now decrypt via enc-dec.app
  console.log('\nDecrypting via enc-dec.app...');
  const decResponse = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: mediaData.result, agent: UA }),
  });
  
  const decResult = await decResponse.json();
  console.log('API response status:', decResult.status);
  
  if (decResult.status === 200) {
    const decrypted = typeof decResult.result === 'string' 
      ? decResult.result 
      : JSON.stringify(decResult.result);
    console.log('\n✅ Decrypted successfully!');
    console.log('First 200 chars:', decrypted.substring(0, 200));
    
    // Parse and show stream URL
    try {
      const data = JSON.parse(decrypted);
      if (data.sources && data.sources[0]) {
        console.log('\n🎬 Stream URL:', data.sources[0].file);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  } else {
    console.log('❌ API error:', decResult);
  }
}

async function main() {
  await testAPIDirectly();
  console.log('\n' + '='.repeat(60) + '\n');
  await testEncDecAPI();
}

main().catch(console.error);
