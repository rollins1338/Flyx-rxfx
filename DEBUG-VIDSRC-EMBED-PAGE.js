const puppeteer = require('puppeteer');

async function debugVidsrcEmbedPage() {
  console.log('🔍 DEBUGGING VIDSRC-EMBED.RU PAGE');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  console.log('\n📍 Navigating to vidsrc-embed.ru...');
  const url = 'https://vidsrc-embed.ru/embed/movie/550';
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n✅ Page loaded. Analyzing content...\n');
    
    const pageData = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body?.textContent?.substring(0, 500),
        iframes: Array.from(document.querySelectorAll('iframe')).map(i => ({
          src: i.src,
          id: i.id,
          className: i.className
        })),
        scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src),
        inlineScripts: Array.from(document.querySelectorAll('script:not([src])')).map(s => ({
          length: s.textContent.length,
          sample: s.textContent.substring(0, 200)
        })),
        divs: Array.from(document.querySelectorAll('div[id]')).map(d => ({
          id: d.id,
          className: d.className,
          textLength: d.textContent?.length || 0
        }))
      };
    });
    
    console.log('📄 Page Title:', pageData.title);
    console.log('\n📦 Body Text Sample:', pageData.bodyText);
    
    console.log('\n🖼️  Iframes found:', pageData.iframes.length);
    pageData.iframes.forEach((iframe, i) => {
      console.log(`   ${i + 1}. ${iframe.src}`);
      if (iframe.id) console.log(`      ID: ${iframe.id}`);
      if (iframe.className) console.log(`      Class: ${iframe.className}`);
    });
    
    console.log('\n📜 External Scripts:', pageData.scripts.length);
    pageData.scripts.forEach((src, i) => {
      console.log(`   ${i + 1}. ${src}`);
    });
    
    console.log('\n📝 Inline Scripts:', pageData.inlineScripts.length);
    pageData.inlineScripts.forEach((script, i) => {
      console.log(`   ${i + 1}. Length: ${script.length}`);
      console.log(`      Sample: ${script.sample}`);
    });
    
    console.log('\n📦 Divs with IDs:', pageData.divs.length);
    pageData.divs.slice(0, 10).forEach((div, i) => {
      console.log(`   ${i + 1}. ID: ${div.id}, Class: ${div.className}, Text: ${div.textLength} chars`);
    });
    
    // Wait for user to inspect
    console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

debugVidsrcEmbedPage().catch(console.error);
