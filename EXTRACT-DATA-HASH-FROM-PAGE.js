const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('📡 Loading page...');
  await page.goto('https://vidsrc.xyz/embed/movie/550', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Extract all elements with data-hash
  const dataHashes = await page.evaluate(() => {
    const elements = document.querySelectorAll('[data-hash]');
    return Array.from(elements).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      dataHash: el.getAttribute('data-hash'),
      innerHTML: el.innerHTML.substring(0, 100)
    }));
  });
  
  console.log(`\n✅ Found ${dataHashes.length} elements with data-hash:\n`);
  dataHashes.forEach((item, index) => {
    console.log(`[${index + 1}] ${item.tag}#${item.id}.${item.className}`);
    console.log(`    Hash: ${item.dataHash.substring(0, 100)}...`);
    console.log(`    Content: ${item.innerHTML}...`);
  });
  
  fs.writeFileSync('data-hashes.json', JSON.stringify(dataHashes, null, 2));
  console.log('\n💾 Saved to data-hashes.json');
  
  // Also get the full page HTML
  const html = await page.content();
  fs.writeFileSync('full-page.html', html);
  console.log('💾 Saved full page to full-page.html');
  
  await browser.close();
})();
