/**
 * Extract and immediately test streams from dude.php
 */

async function main() {
  const url = 'https://embed.smashystream.com/dude.php?imdb=tt0468569';
  
  console.log('Fetching dude.php...');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://smashystream.com/',
    }
  });
  
  const html = await response.text();
  console.log(`Got ${html.length} chars`);
  
  // Extract stream URLs
  const filePattern = /"file"\s*:\s*"(https?:[^"]+)"/g;
  const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
  
  const streams = [];
  let match;
  while ((match = filePattern.exec(html)) !== null) {
    const streamUrl = match[1].replace(/\\\//g, '/');
    streams.push(streamUrl);
  }
  
  const titles = [];
  while ((match = titlePattern.exec(html)) !== null) {
    titles.push(match[1]);
  }
  
  console.log(`Found ${streams.length} streams`);
  
  // Test each stream IMMEDIATELY
  for (let i = 0; i < streams.length; i++) {
    const streamUrl = streams[i];
    const title = titles[i] || `Stream ${i + 1}`;
    
    console.log(`\n--- ${title} ---`);
    console.log(`URL: ${streamUrl}`);
    
    // Parse the URL to see the timestamp
    const timestampMatch = streamUrl.match(/:(\d{10}):/);
    if (timestampMatch) {
      const ts = parseInt(timestampMatch[1]);
      const date = new Date(ts * 1000);
      const now = new Date();
      const diffSec = Math.floor((date - now) / 1000);
      console.log(`Timestamp: ${ts} (${date.toISOString()})`);
      console.log(`Expires in: ${diffSec} seconds`);
    }
    
    // Test with different headers
    console.log('\nTesting with Referer...');
    try {
      const resp = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://embed.smashystream.com/',
          'Origin': 'https://embed.smashystream.com',
        }
      });
      console.log(`Status: ${resp.status}`);
      
      if (resp.ok) {
        const text = await resp.text();
        console.log(`Is M3U8: ${text.includes('#EXTM3U')}`);
        if (text.includes('#EXTM3U')) {
          console.log('SUCCESS! Stream is working!');
          console.log(`Preview:\n${text.substring(0, 400)}`);
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    
    // Also try without referer
    console.log('\nTesting without Referer...');
    try {
      const resp = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      console.log(`Status: ${resp.status}`);
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
