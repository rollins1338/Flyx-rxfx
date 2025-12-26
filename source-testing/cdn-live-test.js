/**
 * cdn-live.tv Quick Test
 */

const API_BASE = 'https://api.cdn-live.tv';
const SITE_BASE = 'https://cdn-live.tv';

async function test() {
  console.log('Testing cdn-live.tv API...\n');
  
  // Test channels API
  try {
    const channelsUrl = `${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`;
    console.log('Fetching:', channelsUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(channelsUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeout);
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Channels count:', data.length);
      console.log('First 3 channels:', JSON.stringify(data.slice(0, 3), null, 2));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test player page
  try {
    const playerUrl = `${SITE_BASE}/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free`;
    console.log('\nFetching player:', playerUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(playerUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    clearTimeout(timeout);
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    if (response.ok) {
      const html = await response.text();
      console.log('HTML length:', html.length);
      
      // Check for key patterns
      console.log('\nContains OPlayer:', html.includes('oplayer'));
      console.log('Contains eval:', html.includes('eval('));
      console.log('Contains m3u8:', html.includes('.m3u8'));
      console.log('Contains playlistUrl:', html.includes('playlistUrl'));
      
      // Look for any URLs
      const urls = html.match(/https?:\/\/[^\s"'<>]+/g);
      if (urls) {
        console.log('\nUnique URLs found:', [...new Set(urls)].length);
        const streamUrls = urls.filter(u => u.includes('stream') || u.includes('hls') || u.includes('m3u8') || u.includes('live'));
        console.log('Stream-related URLs:', streamUrls);
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
