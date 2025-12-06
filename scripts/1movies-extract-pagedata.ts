/**
 * Extract __PAGE_DATA from rapidshare embed and try to decrypt it
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const API = 'https://enc-dec.app/api';
const EMBED_URL = 'https://rapidshare.cc/e/kJCuIjiwWSyJcOLzFLpK6xfpCQ';

async function main() {
  console.log('=== Extracting PAGE_DATA from rapidshare embed ===\n');
  
  // Fetch the embed page
  const res = await fetch(EMBED_URL, { headers: HEADERS });
  const html = await res.text();
  
  console.log('Page length:', html.length);
  
  // Look for __PAGE_DATA
  const pageDataMatch = html.match(/__PAGE_DATA\s*=\s*['"]([^'"]+)['"]/);
  if (pageDataMatch) {
    const pageData = pageDataMatch[1];
    console.log('\n__PAGE_DATA found:', pageData);
    console.log('Length:', pageData.length);
    
    // Try various decryption endpoints
    const endpoints = [
      'dec-movies-flix',
      'dec-rapidshare',
      'dec-rapid',
      'dec-filemoon',
      'dec-vidplay',
      'dec-rabbitstream',
      'dec-megacloud',
      'decrypt',
      'decode'
    ];
    
    console.log('\n=== Trying decryption endpoints ===');
    
    for (const endpoint of endpoints) {
      try {
        // Try POST
        const postRes = await fetch(`${API}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pageData })
        });
        if (postRes.ok) {
          const json = await postRes.json();
          if (json.result && json.result !== pageData) {
            console.log(`\n✓ ${endpoint} (POST):`);
            console.log(JSON.stringify(json.result).substring(0, 500));
          }
        }
      } catch {}
      
      try {
        // Try GET
        const getRes = await fetch(`${API}/${endpoint}?text=${encodeURIComponent(pageData)}`);
        if (getRes.ok) {
          const json = await getRes.json();
          if (json.result && json.result !== pageData) {
            console.log(`\n✓ ${endpoint} (GET):`);
            console.log(JSON.stringify(json.result).substring(0, 500));
          }
        }
      } catch {}
    }
  } else {
    console.log('__PAGE_DATA not found in HTML');
    
    // Look for other patterns
    const patterns = [
      /window\.__PAGE_DATA\s*=\s*['"]([^'"]+)['"]/,
      /PAGE_DATA\s*=\s*['"]([^'"]+)['"]/,
      /data-page\s*=\s*['"]([^'"]+)['"]/,
      /encrypted\s*=\s*['"]([^'"]+)['"]/,
      /sources?\s*:\s*\[([^\]]+)\]/,
      /file\s*:\s*['"]([^'"]+)['"]/,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        console.log(`\nFound pattern ${pattern}:`);
        console.log(match[1].substring(0, 200));
      }
    }
  }
  
  // Also look for any base64-like strings
  console.log('\n=== Looking for encoded data ===');
  const base64Strings = html.match(/[A-Za-z0-9+/=_-]{50,}/g);
  if (base64Strings) {
    console.log(`Found ${base64Strings.length} potential encoded strings`);
    // Show unique ones
    const unique = Array.from(new Set(base64Strings)).slice(0, 5);
    unique.forEach((s, i) => {
      console.log(`\n${i + 1}. (${s.length} chars): ${s.substring(0, 80)}...`);
    });
  }
  
  // Save HTML for analysis
  const fs = await import('fs');
  fs.writeFileSync('rapidshare-embed.html', html);
  console.log('\nSaved HTML to rapidshare-embed.html');
}

main().catch(console.error);
