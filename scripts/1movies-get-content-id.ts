/**
 * Get content ID from yflix.to page
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function getContentId(slug: string) {
  const url = `https://yflix.to/watch/${slug}`;
  console.log('Fetching:', url);
  
  const res = await fetch(url, { headers: HEADERS });
  const html = await res.text();
  
  console.log('Page length:', html.length);
  
  // Look for content ID patterns
  const patterns = [
    /data-tip="([a-zA-Z0-9_-]+)"/,  // This is the content ID!
    /data-id="([^"]+)"/,
    /content-id="([^"]+)"/,
    /"id"\s*:\s*"([a-zA-Z0-9_-]+)"/,
    /data-content="([^"]+)"/,
    /episodes\/list\?id=([^&"]+)/,
    /links\/list\?eid=([^&"]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      console.log(`Found with ${pattern}:`, match[1]);
    }
  }
  
  // Also look for the window.__$ token
  const tokenMatch = html.match(/window\.__\$\s*=\s*['"]([^'"]+)['"]/);
  if (tokenMatch) {
    console.log('Token:', tokenMatch[1]);
  }
  
  // Save for analysis
  const fs = await import('fs');
  fs.writeFileSync('yflix-page.html', html);
  console.log('Saved to yflix-page.html');
}

// Cyberpunk Edgerunners
getContentId('cyberpunk-edgerunners.kmyvy').catch(console.error);
