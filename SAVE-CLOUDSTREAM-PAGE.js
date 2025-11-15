const puppeteer = require('puppeteer');
const fs = require('fs');

async function saveCloudstreamPage() {
  console.log('📥 SAVING CLOUDSTREAM PAGE');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  const cloudstreamURL = 'https://cloudnestra.com/rcp/ZDYzMjUwYTNlOTI3MjRiMWI1ZWM2MGU5YTJmN2Y5NDA6TDFCVVNWaG5OR2czYUdwbVIwVmlPVFI1ZG1KWFNGbzRPVVpEY0ZOeVNUVklXbHB2V2trNFlUTlRORWN6YTNFMGFtWk1OR00zY1hsb2FuVXJhMWxGUlhCMWRYSXZTRFp4TWtsUVZteHVPWEJ0VUVOU05EZzJjM0JTVHpFdmN6QmlTMjlEZEdGeGRqWjNibGswVjFSeGVYQXJSMmRsZWtaWGRYWnFVMDQzTDBReGVtdHpiVUpPT0d4d2RVdG1NbGN2WW5WMmJWSXplak0xSzJjeFJqVnBTVXA2V0c5T2JDdHZZMFpRYmtGME5IZGFlVkJ1VmpRdlNXRnFjM2cxYkc5SlpWRlNjMHhhZVdWRmFYTmlXR3h4WWs4MGNTdFpUbXhXZDNaTlQxWnNWbFZhVm1kamRVWm9NbXRvTUhob2FTOXpUVEUzVkRocVVFeExaa1JDZUhsSGVrZEVaVmhqYTBsRlJrWkRhekpOY0ZFdloyeEVaRXhHTkdvMWJUUlNabEZEUTJWSldWSkRjM1pIU3pKcFFrMVJRbGh4U2t4QlkyNHdRV3ByVFV4bFlXdFJOVGx0WTJ4eFZHTnJTbmR1VTJsblpYWTFUV05FY1ZKSGJDc3dRaXRVWkZVNFZEaHhVemx5WWtodVJHSTVRVFU0SzA4MGVqUk9jMEp3VUVkaGRYTTNTRWhuY2xwbmMwMXpObU5TUzFCTVNVUk9MekJTUlRneVRGUldLMFZ2TURad1RWSjRjVzQzVDFSdmRXeFpia1l4WkZwUk1sYzJRVmx3V1RsS1pGWkJVelZsVjJoRFVrY3dTV1JVYzBFdlUyaENNVWRKUjJKYVFXeE5kMWsyV0ZSUFpWSXhiVzVWV0RKaE5IQmplREp4VDNwa1YzZ3pOMDF1ZGtWWGRVSkdhM1pQZVdwREt6UXlNbEkwZVd0V2VXTm5hREpFTTBwSFpFNTZNbFpQYkdWTFpTdDVjMlJ2V0hsMVZ6QkJZMHBaT0hwVlVuUk9WVlkxYTJObE9EaFRNa2xSUkN0cVpXcFpZM05RWVV4blVtMVZLMnhvSzI5eVZWVlpRWGcxWm1oR1RqTkVWbXRZVGpaRmFUazRUVlk1VjJkd1dYRjJjQzlJYjBSMWFURkVjbVk1VkdkRE1tTnVZVVZaYW1obFFqWkJTQzlrTTBacE5IZ3JaMnBMZVhWdVZUUkJhR05OT1ZOWVZUWlJaM2cxUjBwcFYwcFpTbmN5VFVFeE1VWmFNRTR6TmpNNWVqaEljVmRYYmxoSFQycHhUa2RtYjBoM01sSlBTWHBYYmtSbk9HMUxXbFZvVTBGamQxcFNjWEJTYVZkcmFuVjFhemt2UlRSUGJXWjJXa05OYVVoeFIxTjNVbFJIUWpKVkswZHNVbXBEU2xVM1NYbG1WbU13UzBaVlRXaEtTRFppVHpOcU1IZDFXVFJPVkVWVEsyeEJibEI2YzNSbEwzbERaalZMZEhJeFVUVk5RVTlRYURoMEwwVnVVVzF2ZWsxeWRqWlllbmR5ZUZkemRYbGFjRGsxWW5ZNFdIUTVWMU5XWVhSUFJESkpkRmhoYjFkd2IyRktWRkpLUldWYU9FeElPRE5uVkhoNVZUaElTRzA1VTFwWllrOWpXRkEyUVU4NGFFRjRXRFIwZUM5SU5VTnplbU01THprcmRUQTRUa1Y0ZUhWRU5XMTVUakkzVjJseGRsSnJhV3hsTjJNd1oxaDJXR0ZVUjBVNGFEVnpMMHQzWTBoUWNsRTROSGRvV21FclVFaE5jSFI0Vm1welNVWXJhazlwY0ZCTE1EQndZbXcwVGpWMGRVUlpTVkk1T1dkQmVHUjJWRlJpY0hKbVFYcFhiVVJ4WVZOeVkzWk9iREZqVXpnMFpYQnVPVU5SWTBrdlZXazJaRU5wZWxsRWRYVjZjM2QzZFRWMk5XWnZSRGxDYUZkdFFXeHZhVmw1VjJOS1dIZFhNekI2TTBacWNEbG1NSFJxTUhvMFFYUXdTRXd6ZVUxcWVIVmFiR3R4U2tkaGVuTnFLemczTVU5bVEyaEZjVXg0U0hGQlVGVkRRMjlFTW1GQ2FFRkhVblF4YWtwR1VUMDk-';
  
  console.log('\n📍 Loading Cloudstream page...');
  await page.goto(cloudstreamURL, { waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log('⏳ Waiting for page to fully load...');
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Get the complete HTML
  const html = await page.content();
  fs.writeFileSync('cloudstream-page.html', html);
  console.log('✅ Saved HTML to cloudstream-page.html');
  
  // Extract all inline scripts
  const inlineScripts = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    return scripts.map((s, i) => ({
      index: i,
      content: s.textContent,
      length: s.textContent.length
    }));
  });
  
  console.log(`\n📜 Found ${inlineScripts.length} inline scripts:`);
  inlineScripts.forEach(script => {
    console.log(`   ${script.index + 1}. Length: ${script.length}`);
    
    // Save each script
    fs.writeFileSync(`cloudstream-inline-script-${script.index + 1}.js`, script.content);
    
    // Check for ProRCP references
    if (script.content.includes('prorcp') || script.content.includes('ProRCP')) {
      console.log('      🎯 CONTAINS PRORCP!');
    }
    
    // Check for iframe creation
    if (script.content.includes('iframe')) {
      console.log('      📦 Creates iframe');
    }
    
    // Check for URL patterns
    const urls = script.content.match(/(https?:\/\/[^\s"']+)/g);
    if (urls) {
      console.log(`      🔗 Contains ${urls.length} URL(s)`);
      urls.forEach(url => {
        if (url.includes('prorcp')) {
          console.log(`         🎯 ${url}`);
        }
      });
    }
  });
  
  // Check all frames
  const frames = page.frames();
  console.log(`\n📦 Total frames: ${frames.length}`);
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const url = frame.url();
    console.log(`   ${i + 1}. ${url}`);
    
    if (url.includes('prorcp')) {
      console.log('      🎯 THIS IS PRORCP!');
      
      // Save ProRCP URL
      fs.writeFileSync('prorcp-url.txt', url);
      console.log('      💾 Saved to prorcp-url.txt');
    }
  }
  
  console.log('\n✅ Complete! Check the saved files.');
  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
}

saveCloudstreamPage().catch(console.error);
