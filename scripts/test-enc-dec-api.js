/**
 * Test specific enc-dec.app endpoints for rapidshare decryption
 */

const API = 'https://enc-dec.app/api';
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

async function tryEndpoint(endpoint, data) {
  try {
    const res = await fetch(`${API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data })
    });
    const json = await res.json();
    return json;
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log('=== Testing enc-dec.app API ===\n');
  
  // Most likely endpoints
  const endpoints = [
    'dec-rapidshare',
    'dec-rapidairmax',
    'dec-rapid',
    'decrypt-rapidshare',
    'decode-rapidshare',
    'dec-movies-flix',
    'dec-filemoon',
    'dec-vidplay',
    'dec-rabbitstream',
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint}...`);
    const result = await tryEndpoint(endpoint, PAGE_DATA);
    console.log(`  Result: ${JSON.stringify(result).substring(0, 200)}`);
    
    if (result.result && typeof result.result === 'string' && result.result.includes('http')) {
      console.log(`\n*** SUCCESS: ${endpoint} ***`);
      console.log(result.result);
      return;
    }
  }
  
  console.log('\nNo working endpoint found');
}

main().catch(console.error);
