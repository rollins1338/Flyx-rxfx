/**
 * Test MegaUp Embed Decryption
 */

const ENC_DEC_API = 'https://enc-dec.app';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Connection': 'keep-alive',
};

const TEST_EMBED_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function main() {
  console.log('Testing MegaUp Embed Decryption');
  console.log('Embed URL:', TEST_EMBED_URL);
  
  // Step 1: Try manual extraction
  console.log('\n--- Manual Extraction ---');
  try {
    const response = await fetch(TEST_EMBED_URL, {
      headers: {
        ...HEADERS,
        'Referer': 'https://animekai.to/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const html = await response.text();
      console.log('Page Length:', html.length);
      
      // Show first part of HTML
      console.log('\nHTML Start:');
      console.log(html.substring(0, 1500));
      
      // Look for patterns
      console.log('\n--- Pattern Search ---');
      
      // m3u8 URL
      const m3u8Match = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (m3u8Match) {
        console.log('✓ Found m3u8:', m3u8Match[0]);
      }
      
      // file: pattern
      const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        console.log('✓ Found file:', fileMatch[1]);
      }
      
      // sources: pattern
      const sourcesMatch = html.match(/sources\s*:\s*\[([^\]]+)\]/i);
      if (sourcesMatch) {
        console.log('✓ Found sources:', sourcesMatch[0].substring(0, 200));
      }
      
      // Check for packed JS
      if (html.includes('eval(function(p,a,c,k,e,')) {
        console.log('⚠ Found packed JavaScript');
        
        // Extract packed content
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]*?\}?\('([^']+)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/);
        if (packedMatch) {
          console.log('Packed params found, attempting unpack...');
          const [, p, aStr, cStr, keywords] = packedMatch;
          console.log('Keywords:', keywords.split('|').slice(0, 20).join(', '), '...');
        }
      }
      
      // Look for any URL patterns
      const urlMatches = html.match(/https?:\/\/[^\s"'<>]+/g);
      if (urlMatches) {
        console.log('\nAll URLs found:');
        const uniqueUrls = [...new Set(urlMatches)];
        uniqueUrls.forEach(url => {
          if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('stream') || url.includes('video')) {
            console.log('  ✓', url);
          }
        });
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Step 2: Try dec-mega API
  console.log('\n--- dec-mega API ---');
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
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Error:', text.substring(0, 500));
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
}

main().catch(console.error);
