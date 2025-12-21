/**
 * Get the exact fingerprint values from the browser
 */
const puppeteer = require('puppeteer');

async function getBrowserFingerprint() {
  console.log('=== Getting Browser Fingerprint Values ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Navigate to flixer to get the exact fingerprint
  await page.goto('https://flixer.sh', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Get fingerprint components
  const fpData = await page.evaluate(() => {
    const screen = window.screen;
    const nav = navigator;
    
    // Generate canvas data exactly like the client
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillText('FP', 2, 2);
    }
    const canvasDataUrl = canvas.toDataURL();
    const canvasSubstr = canvasDataUrl.substring(22, 50);
    
    // Build fingerprint string
    const fpString = `${screen.width}x${screen.height}:${screen.colorDepth}:${nav.userAgent.substring(0, 50)}:${nav.platform}:${nav.language}:${new Date().getTimezoneOffset()}:${canvasSubstr}`;
    
    // Hash it
    let hash = 0;
    for (let i = 0; i < fpString.length; i++) {
      hash = (hash << 5) - hash + fpString.charCodeAt(i);
      hash &= hash;
    }
    const fingerprint = Math.abs(hash).toString(36);
    
    return {
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      userAgent: nav.userAgent,
      userAgentFirst50: nav.userAgent.substring(0, 50),
      platform: nav.platform,
      language: nav.language,
      timezoneOffset: new Date().getTimezoneOffset(),
      canvasDataUrl: canvasDataUrl.substring(0, 100),
      canvasSubstr,
      fpString,
      fingerprint
    };
  });
  
  console.log('Browser Fingerprint Data:');
  console.log(JSON.stringify(fpData, null, 2));
  
  // Now compare with our Node.js implementation
  console.log('\n\n=== Our Node.js Implementation ===');
  const screenWidth = 1920, screenHeight = 1080, colorDepth = 24;
  const platform = 'Win32', language = 'en-US';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
  const timezoneOffset = new Date().getTimezoneOffset();
  
  // Our canvas data
  const canvasData = `canvas-fp-${screenWidth}x${screenHeight}-${colorDepth}-${platform}-${language}`;
  const canvasDataUrl = 'data:image/png;base64,' + Buffer.from(canvasData).toString('base64');
  const canvasSubstr = canvasDataUrl.substring(22, 50);
  
  const fpString = `${screenWidth}x${screenHeight}:${colorDepth}:${userAgent.substring(0, 50)}:${platform}:${language}:${timezoneOffset}:${canvasSubstr}`;
  
  let hash = 0;
  for (let i = 0; i < fpString.length; i++) {
    hash = (hash << 5) - hash + fpString.charCodeAt(i);
    hash &= hash;
  }
  const fingerprint = Math.abs(hash).toString(36);
  
  console.log('Node.js Fingerprint Data:');
  console.log({
    screenWidth,
    screenHeight,
    colorDepth,
    userAgentFirst50: userAgent.substring(0, 50),
    platform,
    language,
    timezoneOffset,
    canvasDataUrl: canvasDataUrl.substring(0, 100),
    canvasSubstr,
    fpString,
    fingerprint
  });
  
  await browser.close();
  console.log('\nDone!');
}

getBrowserFingerprint().catch(console.error);
