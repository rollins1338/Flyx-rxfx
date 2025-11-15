const puppeteer = require('puppeteer');
const fs = require('fs');

async function extractDecoderScript() {
  console.log('📥 EXTRACTING PRORCP DECODER SCRIPT');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'Referer': 'https://vidsrc-embed.ru/',
    'Origin': 'https://vidsrc-embed.ru'
  });
  
  const proRCPURL = 'https://cloudnestra.com/prorcp/ZTVhOGMxMmFhYjU1YTM0YjlhYzdjYzFjNWRjNGVmOWE6ZVZoWVdqSkhSR2w2UkZGaWNHTlZhRWt4VkVkd2FFWkNiVzB6TUdFMWJHTnBSM0p5TTFoRGNrdDFVbTR4YzNSd2VVSmxPRVZ3TUVJMVpuTlJVWHBLSzBaVmEzaGlLMWhZYVhkWFoySkZNblJXVjBJMGVXUkdlakp2VFRkTWNFVTBjV05EVVdaR1VHMXZjSGRPWm14Q1kxSlhaM1ZwVm1aRGVqVndSMnd3TW5veU9ESXJNRXgwUzAxU2RXd3dTVGRKUkVwR01tRjBNaXN5YmxwVFdsSmFWMFpRVnk5dWMwMXNOMlZJUTNSck9ISkJUVVl3VlZKbGIwcG1VRFZOT1M4d1VXcExPRFI1UkVkUmVUWkVRMXB6TUcxQ1dVNUlTR2syZHpCWlMzbDNNRnB5UjNsNk4yd3ZaMHAxT0dwM1RISjBXbEpSYjBOWWVHUlhTRFI1THpacWNISkRlR1ZITTFSSlZqaHRWbmRIVFhsbWJqaEhaR016VUdRMVkydHpObUl3Y25WNFdUWkhkVmxQT0VWWFF6aGpRMVl5U3pWQ1Eyb3ZWWEEzZEdwSk5IUnJja04wU1dOcVNtNUJOVXhhVlZOUVVpdE1PWEpwT1doNlZrVjVRbFp0YldvMGJrNWxNRTltWVVSNFFXcFBSWE5EV2s5WWNreFZiM1J1VEZSRlZITXdjU3M0V1dSMVRWSkdWWGxQYVdabVkwY3JZblZIV2xGaFJqTkdhRGhTUWtsM01WRnlOR2hFTUVGTFRsZDZRWE5QZGt0QlNIRlpUbFl2VVhwaWRVVlRUWGh6VUhWRU1sRmtlVkZaYkRoTlJEUnRRWEIxZVc5SlJGRXlSR1ptY2poTmNXNVhiSE5QUkdzcmNsVmtOR3QzUzBkWGJGTnNZVThyTUdKRE1HZFVSRThyVTJsUlYzbHBaMHN5YzBsamJtWnZXalI1VmtSNFpWaHRhamsxY0dOblEyWXhkeXMyVlRKQ1pscEVSV0V3VFhWWGR6bEpjMnBTUjBnM1kyNU9VMlJLTlRSS2VuWXpjRFJ1V0dJd1RsRnZWMlJJTXpONFJXMWhSVmhwYjIwcmNtSkhjemxvWjBaWlIycHlTazFpY3k5SU1UWXpPRzlJUVV4RE9YbFNTQ3ROVkRoaVJ5ODNiR1JLU1ZnM1VuSkhURlJPYkhvM1dESTVXblZUTlRSUlJuWm5ka0ZaWkU4dlVqZHhRWFZ0Y2xwTVZ5OWpWbGQ2VUVkb2RqWk9ia3hhTTAxUGNqRnpWR1Y1ZW05NFMydHRRblFyTUZkQllqWkZZVmQ2U0Rkb1QyVk9WMnN2VkVNMWRrUjRRbmxSUlZSR1pYTndUemRCVEN0S2IzVnFXSEpTTkhOcVNrYzFhazlPVURjd05sbHlWekZNUTNGcWRXWk1OR1JRSzI5dlVGTndaamhQUTJ4M2NGUlJTbkEyVFU1bGNucHNXV3R5WTFwak1qbHRSM2xoTkZsWFVGbElkV1VyVFhwdVVEVjBUbGRoSzFkVU5YcENNWEp4WjBST1duZ3JMMVF6TTNoWGRGTlVjVUZFV1dKalQyTkNLM041Tlc1bk1qbHhkbFp6UVdSdlZqUlZTbWs1U1d4MlRVWnlTVWd6TkRSR1ExZHFRU3NyYTJOQlpDdHZNVkpsVjFJclRtaDVWaXRQVkRkeWF6RlNkVWhXZVVoTVJrcDNSek5OUldkb2FrMXFTRzQzYjBsVVYxZGFVVEZoVm5wRFIwOW9NMmtyVUZjeWFWRjBkVUpYYXpGU01VWjNjRmMyUm5sM1NteExNak5rVFdGRVREZDJWblZqUmxOaWFUSk1VRE5oVEdjeFZsQlhTV2xRV1hCMldqTllNMHBUVTFJdlRVUkdTa1JaV0daQ1NIVnJLMVpMVW13eGIzSlRSRXc1ZGpkWFRqSlRUMnQ2VjBGTWN6WmlhMFZaYm1kUGNXaFlURTVUVlhGdU4xYzBPR04wZFUwNFNpOW5hbTl4UkdzNFRtSm1ZWGhDUkZkeE9GQkVlRlI2Ymtwc2NXcHVSRmcyVDFveGFHNXdhMnBFU2pKb2QxTTJUVWgyTmtaMlUyeE5UemxRYmxGSVVUMDk-';
  
  console.log('\n📍 Loading ProRCP page...');
  await page.goto(proRCPURL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get complete page HTML
  const html = await page.content();
  fs.writeFileSync('prorcp-complete-page.html', html);
  console.log('✅ Saved complete HTML');
  
  // Extract all scripts
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script')).map((script, i) => ({
      index: i,
      src: script.src || 'inline',
      content: script.textContent,
      length: script.textContent.length
    }));
  });
  
  console.log(`\n📜 Found ${scripts.length} scripts:`);
  
  scripts.forEach(script => {
    console.log(`\n${script.index + 1}. ${script.src}`);
    console.log(`   Length: ${script.length}`);
    
    if (script.src === 'inline' && script.length > 100) {
      const filename = `prorcp-script-${script.index + 1}.js`;
      fs.writeFileSync(filename, script.content);
      console.log(`   💾 Saved to ${filename}`);
      
      // Check if it's the decoder
      if (script.content.includes('getElementById') && 
          (script.content.includes('atob') || script.content.includes('charCodeAt'))) {
        console.log('   🎯 THIS IS THE DECODER SCRIPT!');
        fs.writeFileSync('PRORCP-DECODER-SCRIPT-FOUND.js', script.content);
      }
    }
  });
  
  // Also check for the M3U8 URL in the page
  const m3u8URLs = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const urls = [];
    
    for (let script of scripts) {
      const content = script.textContent;
      const matches = content.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/g);
      if (matches) {
        urls.push(...matches);
      }
    }
    
    return urls;
  });
  
  if (m3u8URLs.length > 0) {
    console.log('\n🎯 FOUND M3U8 URLs:');
    m3u8URLs.forEach(url => {
      console.log('   ', url);
    });
    fs.writeFileSync('prorcp-m3u8-urls.txt', m3u8URLs.join('\n'));
  }
  
  console.log('\n✅ Extraction complete!');
  console.log('\n⏸️  Browser staying open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
}

extractDecoderScript().catch(console.error);
