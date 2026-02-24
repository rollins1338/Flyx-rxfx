#!/usr/bin/env node
/**
 * Test the new AnimeKai search API format
 */

async function testNewSearchAPI() {
  const domain = 'animekai.to';
  const searchUrl = `https://${domain}/ajax/anime/search?keyword=Jujutsu%20Kaisen`;
  
  console.log('Testing new AnimeKai search API');
  console.log('URL:', searchUrl);
  console.log('');
  
  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Referer': `https://${domain}/`,
      'X-Requested-With': 'XMLHttpRequest',
    },
    signal: AbortSignal.timeout(10000),
  });
  
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  // Parse the HTML to extract anime data
  if (data.result && data.result.html) {
    console.log('\n' + '='.repeat(60));
    console.log('Parsing HTML results...');
    console.log('='.repeat(60));
    
    const html = data.result.html;
    
    // Extract all anime links
    const linkRegex = /href="\/watch\/([^"]+)"/g;
    const links = [...html.matchAll(linkRegex)].map(m => m[1]);
    console.log(`\nFound ${links.length} anime:`);
    links.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link}`);
    });
    
    // Extract titles
    const titleRegex = /<div class="title"[^>]*>([^<]+)<\/div>/g;
    const titles = [...html.matchAll(titleRegex)].map(m => m[1].trim());
    console.log(`\nTitles:`);
    titles.forEach((title, i) => {
      console.log(`  ${i + 1}. ${title}`);
    });
    
    // Check for data attributes that might contain IDs
    const dataAttrRegex = /data-([a-z-]+)="([^"]+)"/g;
    const dataAttrs = [...html.matchAll(dataAttrRegex)];
    if (dataAttrs.length > 0) {
      console.log(`\nData attributes found:`);
      dataAttrs.slice(0, 10).forEach(m => {
        console.log(`  data-${m[1]}="${m[2]}"`);
      });
    }
  }
}

testNewSearchAPI().catch(console.error);
