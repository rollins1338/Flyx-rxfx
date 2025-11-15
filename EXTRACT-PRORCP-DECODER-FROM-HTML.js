const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('prorcp-page.html', 'utf8');
const $ = cheerio.load(html);

console.log('\n🔍 EXTRACTING DECODER FROM PRORCP PAGE\n');

// Find all script tags
const scripts = [];
$('script').each((i, elem) => {
  const src = $(elem).attr('src');
  const content = $(elem).html();
  
  if (content && content.trim()) {
    scripts.push({
      index: i,
      type: 'inline',
      length: content.length,
      content: content
    });
  } else if (src) {
    scripts.push({
      index: i,
      type: 'external',
      src: src
    });
  }
});

console.log(`Found ${scripts.length} scripts\n`);

// Find the decoder script (look for div ID manipulation)
scripts.forEach((script, i) => {
  if (script.type === 'inline') {
    console.log(`\n=== Script ${i + 1} (${script.length} chars) ===`);
    
    // Check if it contains decoder logic
    if (script.content.includes('atob') || 
        script.content.includes('fromCharCode') ||
        script.content.includes('getElementById')) {
      console.log('✅ Contains decoder functions!');
      console.log('\nFirst 1000 chars:');
      console.log(script.content.substring(0, 1000));
      console.log('\n...\n');
      
      // Save to file
      fs.writeFileSync(`decoder-script-${i + 1}.js`, script.content);
      console.log(`💾 Saved to decoder-script-${i + 1}.js`);
    } else {
      console.log('Content preview:', script.content.substring(0, 200));
    }
  } else {
    console.log(`\n=== Script ${i + 1} (external) ===`);
    console.log('Source:', script.src);
  }
});

console.log('\n✅ Done!');
