/**
 * CAPTURE DIV CONTENT FROM PRORCP PAGE
 * This script captures the hidden div innerHTML which contains the encoded M3U8 URL
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    https.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': options.referer || '',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data }));
    }).on('error', reject).end();
  });
}

async function captureDivContent() {
  console.log('\n🎯 CAPTURING DIV CONTENT FROM PRORCP PAGE\n');
  
  // Step 1: Get ProRCP URL
  console.log('Step 1: Getting ProRCP URL...');
  const embedResp = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const $ = cheerio.load(embedResp.data);
  const dataHash = $('[data-hash]').first().attr('data-hash');
  
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
  const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
  
  // Get div ID from page
  const proRcpResp = await fetch(proRcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  const $2 = cheerio.load(proRcpResp.data);
  
  let divId = null;
  $2('div').each((i, elem) => {
    const style = $2(elem).attr('style');
    const id = $2(elem).attr('id');
    const content = $2(elem).html();
    
    if (style && style.includes('display:none') && id && content && content.length > 500) {
      divId = id;
      return false;
    }
  });
  
  console.log('✅ Div ID:', divId);
  console.log('✅ ProRCP URL:', proRcpUrl.substring(0, 80) + '...');
  
  // Step 2: Launch Puppeteer and capture div content
  console.log('\nStep 2: Launching Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Inject script to capture div content BEFORE it's processed
  await page.evaluateOnNewDocument((expectedDivId) => {
    window.capturedDiv = null;
    
    // Capture immediately when DOM is ready
    const observer = new MutationObserver(() => {
      const div = document.getElementById(expectedDivId);
      if (div && !window.capturedDiv) {
        window.capturedDiv = {
          id: expectedDivId,
          innerHTML: div.innerHTML,
          textContent: div.textContent,
          outerHTML: div.outerHTML
        };
        console.log('🎯 DIV CAPTURED!', expectedDivId, 'Length:', div.innerHTML.length);
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // Also try direct capture after a delay
    setTimeout(() => {
      const div = document.getElementById(expectedDivId);
      if (div && !window.capturedDiv) {
        window.capturedDiv = {
          id: expectedDivId,
          innerHTML: div.innerHTML,
          textContent: div.textContent,
          outerHTML: div.outerHTML
        };
        console.log('🎯 DIV CAPTURED (timeout)!', expectedDivId);
      }
    }, 1000);
  }, divId);
  
  await page.setExtraHTTPHeaders({
    'Referer': 'https://vidsrc-embed.ru/'
  });
  
  console.log('Loading page...');
  await page.goto(proRcpUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait a bit for the page to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Try to get the div directly - search for hidden divs
  const capturedDiv = await page.evaluate((expectedDivId) => {
    // First try the expected ID
    let div = document.getElementById(expectedDivId);
    if (div) {
      return {
        id: expectedDivId,
        innerHTML: div.innerHTML,
        textContent: div.textContent,
        outerHTML: div.outerHTML,
        found: 'by-id'
      };
    }
    
    // Search for all hidden divs
    const allDivs = document.querySelectorAll('div[style*="display:none"], div[style*="display: none"]');
    console.log('Found', allDivs.length, 'hidden divs');
    
    for (const d of allDivs) {
      const content = d.innerHTML;
      if (content && content.length > 500 && d.id) {
        console.log('Found hidden div:', d.id, 'length:', content.length);
        return {
          id: d.id,
          innerHTML: content,
          textContent: d.textContent,
          outerHTML: d.outerHTML,
          found: 'by-search'
        };
      }
    }
    
    return null;
  }, divId);
  
  if (capturedDiv) {
    console.log('\n✅ DIV CONTENT CAPTURED!');
    console.log('Div ID:', capturedDiv.id);
    console.log('innerHTML length:', capturedDiv.innerHTML.length);
    console.log('textContent length:', capturedDiv.textContent.length);
    console.log('\nFirst 200 chars of innerHTML:');
    console.log(capturedDiv.innerHTML.substring(0, 200));
    
    // Save to file
    fs.writeFileSync('captured-div-content.json', JSON.stringify(capturedDiv, null, 2));
    console.log('\n💾 Saved to captured-div-content.json');
    
    // Also save just the innerHTML
    fs.writeFileSync('div-innerHTML.txt', capturedDiv.innerHTML);
    console.log('💾 Saved innerHTML to div-innerHTML.txt');
  } else {
    console.log('\n❌ Failed to capture div content');
  }
  
  await browser.close();
  
  console.log('\n✅ Done!');
}

captureDivContent().catch(console.error);
