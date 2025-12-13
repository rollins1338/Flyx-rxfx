/**
 * Test enc-dec.app API with correct parameters
 * 
 * The API expects:
 * - text: The encrypted __PAGE_DATA string (not the URL!)
 * - agent: The User-Agent that was used to fetch the page
 */

const ENC_DEC_API = 'https://enc-dec.app';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const TEST_EMBED_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function main() {
  console.log('Testing enc-dec.app API with correct parameters...\n');
  
  // Step 1: Fetch the embed page to get __PAGE_DATA
  console.log('=== Step 1: Fetch embed page ===');
  const pageResponse = await fetch(TEST_EMBED_URL, {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  
  const html = await pageResponse.text();
  
  // Extract __PAGE_DATA
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  if (!pageDataMatch) {
    console.log('No __PAGE_DATA found!');
    return;
  }
  
  const pageData = pageDataMatch[1];
  console.log('__PAGE_DATA:', pageData);
  
  // Extract the ua variable from the page
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  const pageUa = uaMatch ? uaMatch[1] : HEADERS['User-Agent'];
  console.log('Page UA:', pageUa.substring(0, 60) + '...');
  
  // Step 2: Call dec-mega with the encrypted text and agent
  console.log('\n=== Step 2: Call dec-mega API ===');
  
  // Test with __PAGE_DATA as text
  console.log('\nTest A: __PAGE_DATA as text');
  try {
    const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify({ 
        text: pageData,
        agent: pageUa
      }),
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.result) {
      console.log('\n✓✓✓ SUCCESS! ✓✓✓');
      console.log('Decrypted:', data.result);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test with URL as text (in case the API fetches it)
  console.log('\nTest B: URL as text');
  try {
    const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify({ 
        text: TEST_EMBED_URL,
        agent: pageUa
      }),
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test with different User-Agent formats
  console.log('\nTest C: Different UA formats');
  
  const uaVariants = [
    HEADERS['User-Agent'],
    pageUa,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0',
  ];
  
  for (const ua of uaVariants) {
    try {
      const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...HEADERS },
        body: JSON.stringify({ 
          text: pageData,
          agent: ua
        }),
      });
      
      const data = await response.json();
      console.log(`UA "${ua.substring(0, 30)}...": ${response.status} - ${data.error || 'OK'}`);
      
      if (data.result) {
        console.log('  ✓ Decrypted:', data.result.substring(0, 100));
      }
    } catch (e) {
      console.log(`UA "${ua.substring(0, 30)}...": Error - ${e.message}`);
    }
  }
}

main().catch(console.error);
