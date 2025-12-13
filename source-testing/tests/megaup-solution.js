/**
 * MegaUp Solution - Found the correct flow!
 * 
 * 1. Fetch /media/{videoId} to get encrypted stream data
 * 2. Decrypt with enc-dec.app/api/dec-mega
 */

const ENC_DEC_API = 'https://enc-dec.app';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

const TEST_EMBED_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function extractMegaUpStream(embedUrl) {
  console.log('Extracting MegaUp stream...');
  console.log('Embed URL:', embedUrl);
  
  // Parse video ID from URL
  const videoId = embedUrl.split('/e/')[1];
  const baseUrl = new URL(embedUrl).origin;
  
  console.log('Video ID:', videoId);
  console.log('Base URL:', baseUrl);
  
  // Step 1: Fetch /media/{videoId}
  console.log('\n=== Step 1: Fetch /media/ endpoint ===');
  
  const mediaUrl = `${baseUrl}/media/${videoId}`;
  console.log('Media URL:', mediaUrl);
  
  const mediaResponse = await fetch(mediaUrl, {
    headers: { 
      ...HEADERS, 
      'Referer': embedUrl,
    },
  });
  
  console.log('Media response status:', mediaResponse.status);
  
  if (!mediaResponse.ok) {
    throw new Error(`Media request failed: ${mediaResponse.status}`);
  }
  
  const mediaData = await mediaResponse.json();
  console.log('Media response:', JSON.stringify(mediaData, null, 2));
  
  if (!mediaData.result) {
    throw new Error('No result in media response');
  }
  
  const encryptedData = mediaData.result;
  console.log('Encrypted data:', encryptedData.substring(0, 100) + '...');
  
  // Step 2: Decrypt with enc-dec.app
  console.log('\n=== Step 2: Decrypt with enc-dec.app ===');
  
  const decryptResponse = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...HEADERS,
    },
    body: JSON.stringify({
      text: encryptedData,
      agent: HEADERS['User-Agent'],
    }),
  });
  
  console.log('Decrypt response status:', decryptResponse.status);
  
  const decryptData = await decryptResponse.json();
  console.log('Decrypt response:', JSON.stringify(decryptData, null, 2));
  
  if (decryptData.result) {
    console.log('\n✓✓✓ SUCCESS! ✓✓✓');
    
    // Parse the result
    let streamData;
    if (typeof decryptData.result === 'string') {
      try {
        streamData = JSON.parse(decryptData.result);
      } catch {
        streamData = { file: decryptData.result };
      }
    } else {
      streamData = decryptData.result;
    }
    
    console.log('Stream data:', JSON.stringify(streamData, null, 2));
    
    // Extract the m3u8 URL
    const streamUrl = streamData.file || streamData.sources?.[0]?.file;
    if (streamUrl) {
      console.log('\n🎬 STREAM URL:', streamUrl);
    }
    
    return streamData;
  } else {
    console.log('\n✗ Decryption failed:', decryptData.error);
    console.log('Hint:', decryptData.hint);
    
    // The hint says User-Agent must match - let's try fetching the embed page first
    // to ensure we're using the same UA
    console.log('\n=== Trying with page UA ===');
    
    const pageResponse = await fetch(embedUrl, {
      headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
    });
    const html = await pageResponse.text();
    
    const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
    if (uaMatch) {
      const pageUa = uaMatch[1];
      console.log('Page UA:', pageUa);
      
      const retryResponse = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': pageUa,
        },
        body: JSON.stringify({
          text: encryptedData,
          agent: pageUa,
        }),
      });
      
      const retryData = await retryResponse.json();
      console.log('Retry response:', JSON.stringify(retryData, null, 2));
      
      if (retryData.result) {
        console.log('\n✓✓✓ SUCCESS with page UA! ✓✓✓');
        return retryData.result;
      }
    }
    
    return null;
  }
}

async function main() {
  try {
    const result = await extractMegaUpStream(TEST_EMBED_URL);
    
    if (result) {
      console.log('\n========================================');
      console.log('EXTRACTION SUCCESSFUL!');
      console.log('========================================');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
