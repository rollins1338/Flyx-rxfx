/**
 * Try to decrypt rapidairmax PAGE_DATA using enc-dec.app
 */

const ENC_DEC_API = 'https://enc-dec.app/api';
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

async function tryDecrypt(endpoint: string, data: string): Promise<any> {
  try {
    // Try GET
    const getRes = await fetch(`${ENC_DEC_API}/${endpoint}?text=${encodeURIComponent(data)}`);
    if (getRes.ok) {
      const json = await getRes.json();
      if (json.result) return { method: 'GET', endpoint, result: json.result };
    }
  } catch (e) {}
  
  try {
    // Try POST
    const postRes = await fetch(`${ENC_DEC_API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data })
    });
    if (postRes.ok) {
      const json = await postRes.json();
      if (json.result) return { method: 'POST', endpoint, result: json.result };
    }
  } catch (e) {}
  
  return null;
}

async function main() {
  console.log('=== Trying to decrypt rapidairmax PAGE_DATA ===\n');
  console.log('PAGE_DATA:', PAGE_DATA);
  console.log('');
  
  // Try various endpoints
  const endpoints = [
    'dec-movies-flix',
    'dec-rapidairmax',
    'dec-rapid',
    'dec-filemoon',
    'dec-vidplay',
    'dec-megacloud',
    'dec-rabbitstream',
    'decrypt',
    'decode'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Trying ${endpoint}...`);
    const result = await tryDecrypt(endpoint, PAGE_DATA);
    if (result) {
      console.log(`  ✓ SUCCESS with ${result.method} ${result.endpoint}`);
      console.log(`  Result:`, result.result);
    } else {
      console.log(`  ✗ No result`);
    }
  }
  
  // Also try to list available endpoints
  console.log('\n=== Checking API endpoints ===');
  try {
    const res = await fetch(ENC_DEC_API);
    const text = await res.text();
    console.log('API root response:', text.substring(0, 500));
  } catch (e) {
    console.log('Could not fetch API root');
  }
}

main().catch(console.error);
