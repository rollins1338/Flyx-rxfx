/**
 * Test PPV.to API
 */

const PPV_API_BASE = 'https://api.ppvs.su/api';
const EMBED_BASE = 'https://pooembed.top';

async function testPPVStreams() {
  console.log('=== Testing PPV.to Streams API ===\n');
  
  try {
    const response = await fetch(`${PPV_API_BASE}/streams`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://ppv.to',
        'Referer': 'https://ppv.to/',
      },
    });
    
    console.log('Status:', response.status);
    
    if (!response.ok) {
      console.log('Error:', await response.text());
      return;
    }
    
    const data = await response.json();
    console.log('Success:', data.success);
    console.log('Timestamp:', data.timestamp);
    console.log('Categories:', data.streams?.length);
    
    // Find a live stream to test
    let testStream = null;
    for (const category of data.streams || []) {
      console.log(`\nCategory: ${category.category} (${category.streams?.length} streams)`);
      
      for (const stream of category.streams || []) {
        const isLive = stream.always_live || (Date.now() / 1000 >= stream.starts_at && Date.now() / 1000 <= stream.ends_at);
        if (isLive && !testStream) {
          testStream = stream;
          console.log(`  LIVE: ${stream.name} (${stream.uri_name})`);
        }
      }
    }
    
    if (testStream) {
      console.log('\n=== Testing Stream Extraction ===');
      console.log('Stream:', testStream.name);
      console.log('URI:', testStream.uri_name);
      
      await testEmbedExtraction(testStream.uri_name);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testEmbedExtraction(uriName) {
  const embedUrl = `${EMBED_BASE}/embed/${uriName}`;
  console.log('\nFetching embed:', embedUrl);
  
  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://ppv.to/',
      },
    });
    
    console.log('Status:', response.status);
    
    if (!response.ok) {
      console.log('Error response');
      return;
    }
    
    const html = await response.text();
    console.log('HTML length:', html.length);
    
    // Pattern 1: const src = atob("base64_string");
    const atobPattern = /const\s+src\s*=\s*atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/;
    const atobMatch = html.match(atobPattern);
    
    if (atobMatch) {
      const base64 = atobMatch[1];
      const m3u8Url = Buffer.from(base64, 'base64').toString('utf-8');
      console.log('\n=== Found M3U8 URL (atob method) ===');
      console.log(m3u8Url);
      return;
    }
    
    // Pattern 2: Direct file URL in JWPlayer setup
    const filePattern = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/;
    const fileMatch = html.match(filePattern);
    
    if (fileMatch) {
      console.log('\n=== Found M3U8 URL (direct file) ===');
      console.log(fileMatch[1]);
      return;
    }
    
    // Pattern 3: Look for any m3u8 URL in the page
    const m3u8Pattern = /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/;
    const m3u8Match = html.match(m3u8Pattern);
    
    if (m3u8Match) {
      console.log('\n=== Found M3U8 URL (regex) ===');
      console.log(m3u8Match[1]);
      return;
    }
    
    // Check for offline messages
    if (html.includes('not live') || html.includes('offline') || html.includes('coming soon')) {
      console.log('\nStream is not currently live');
      return;
    }
    
    console.log('\nCould not extract stream URL');
    console.log('HTML snippet:', html.substring(0, 2000));
    
  } catch (error) {
    console.error('Embed error:', error.message);
  }
}

testPPVStreams();
