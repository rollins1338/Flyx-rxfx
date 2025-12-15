/**
 * Extract the static hash from 111movies
 * 
 * The hash is: fcd552c4 + some_middle_part + c4c0
 * 
 * From the captured API call:
 * fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0
 * 
 * So the middle part is: 321aeac1e62c5304913b3420be75a19d390807281a425aabbb5d
 * 
 * Let's verify this is static by checking multiple pages
 */

async function checkHashConsistency() {
  console.log('=== CHECKING IF HASH IS STATIC ===\n');
  
  const puppeteer = require('puppeteer');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    const hashes = [];
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        const parts = url.split('/');
        const fcdPart = parts.find(p => p.startsWith('fcd552c4'));
        if (fcdPart) {
          hashes.push(fcdPart);
          console.log('Hash found:', fcdPart);
        }
      }
    });
    
    // Test multiple movies
    const testIds = ['155', '550', '27205'];
    
    for (const id of testIds) {
      console.log(`\nLoading movie ${id}...`);
      await page.goto(`https://111movies.com/movie/${id}`, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log('\n=== RESULTS ===');
    console.log('Hashes collected:', hashes.length);
    
    // Check if all hashes are the same
    const uniqueHashes = [...new Set(hashes)];
    console.log('Unique hashes:', uniqueHashes.length);
    
    if (uniqueHashes.length === 1) {
      console.log('\n✓ Hash is STATIC!');
      console.log('Static hash:', uniqueHashes[0]);
    } else {
      console.log('\n✗ Hash is DYNAMIC');
      uniqueHashes.forEach(h => console.log('  ', h));
    }
    
  } finally {
    await browser.close();
  }
}

checkHashConsistency().catch(console.error);
