const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * Trace the complete vidsrc chain by monitoring ALL network requests
 * This will show us the exact flow: vidsrc-embed → cloudstream → prorcp
 */

async function traceCompleteChain() {
  console.log('🔍 TRACING COMPLETE VIDSRC CHAIN');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  const networkLog = [];
  const chain = {
    vidsrcEmbed: null,
    cloudstreamRCP: null,
    proRCP: null
  };
  
  // Monitor ALL network requests
  page.on('request', request => {
    const url = request.url();
    networkLog.push({
      type: 'request',
      url: url,
      method: request.method(),
      timestamp: Date.now()
    });
    
    // Check for cloudstream
    if (url.includes('cloudstream') || url.includes('srcrcp')) {
      console.log('🎯 CLOUDSTREAM REQUEST:', url);
      if (!chain.cloudstreamRCP) chain.cloudstreamRCP = url;
    }
    
    // Check for prorcp
    if (url.includes('prorcp')) {
      console.log('🎯 PRORCP REQUEST:', url);
      if (!chain.proRCP) chain.proRCP = url;
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    networkLog.push({
      type: 'response',
      url: url,
      status: response.status(),
      timestamp: Date.now()
    });
  });
  
  page.on('framenavigated', frame => {
    const url = frame.url();
    console.log('📍 Frame navigated:', url);
    
    if (url.includes('cloudstream') || url.includes('srcrcp')) {
      console.log('   ✅ This is Cloudstream!');
      if (!chain.cloudstreamRCP) chain.cloudstreamRCP = url;
    }
    
    if (url.includes('prorcp')) {
      console.log('   ✅ This is ProRCP!');
      if (!chain.proRCP) chain.proRCP = url;
    }
  });
  
  console.log('\n📍 Starting at vidsrc-embed.ru...');
  const startUrl = 'https://vidsrc-embed.ru/embed/movie/550';
  chain.vidsrcEmbed = startUrl;
  
  try {
    await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Initial page loaded');
    
    // Wait for iframes to load
    console.log('\n⏳ Waiting for iframes to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Get all frames
    const frames = page.frames();
    console.log(`\n📦 Total frames: ${frames.length}`);
    
    frames.forEach((frame, i) => {
      const url = frame.url();
      console.log(`   ${i + 1}. ${url}`);
      
      if (url.includes('cloudstream') || url.includes('srcrcp')) {
        console.log('      ✅ CLOUDSTREAM FRAME!');
        if (!chain.cloudstreamRCP) chain.cloudstreamRCP = url;
      }
      
      if (url.includes('prorcp')) {
        console.log('      ✅ PRORCP FRAME!');
        if (!chain.proRCP) chain.proRCP = url;
      }
    });
    
    // Try to find ProRCP in any frame
    console.log('\n🔍 Searching for ProRCP in all frames...');
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        const frameData = await frame.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll('iframe'));
          return iframes.map(iframe => iframe.src);
        });
        
        if (frameData.length > 0) {
          console.log(`   Frame ${i + 1} contains ${frameData.length} iframe(s):`);
          frameData.forEach(src => {
            console.log(`      - ${src}`);
            if (src.includes('prorcp')) {
              console.log('        ✅ FOUND PRORCP!');
              if (!chain.proRCP) chain.proRCP = src;
            }
          });
        }
      } catch (e) {
        // Frame might be detached or cross-origin
      }
    }
    
    // Save network log
    fs.writeFileSync('network-log.json', JSON.stringify(networkLog, null, 2));
    console.log('\n💾 Saved network log to network-log.json');
    
    // Save chain
    fs.writeFileSync('traced-chain.json', JSON.stringify(chain, null, 2));
    console.log('💾 Saved chain to traced-chain.json');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 CHAIN SUMMARY:');
    console.log('=' .repeat(60));
    console.log('1. vidsrc-embed:', chain.vidsrcEmbed);
    console.log('2. Cloudstream RCP:', chain.cloudstreamRCP || 'NOT FOUND');
    console.log('3. ProRCP:', chain.proRCP || 'NOT FOUND');
    
    if (chain.proRCP) {
      console.log('\n✅ SUCCESS! Found ProRCP URL');
      console.log('Now we can analyze it directly:');
      console.log(chain.proRCP);
    } else {
      console.log('\n⚠️  ProRCP not found yet. Check network-log.json for all requests.');
    }
    
    // Keep browser open for inspection
    console.log('\n⏸️  Browser will stay open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

traceCompleteChain().catch(console.error);
