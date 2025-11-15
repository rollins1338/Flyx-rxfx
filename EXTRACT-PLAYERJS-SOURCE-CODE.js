/**
 * EXTRACT COMPLETE PLAYERJS SOURCE CODE
 * Download and analyze the actual PlayerJS library to understand the decoding logic
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function extractPlayerJsSource() {
  console.log('📥 Extracting PlayerJS source code...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  
  const playerJsScripts = [];

  // Intercept all script loads
  await page.setRequestInterception(true);
  page.on('request', request => {
    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    
    // Capture PlayerJS scripts
    if (url.includes('player') && url.includes('.js') && 
        (url.includes('pro.rcp') || url.includes('vidsrc'))) {
      try {
        const content = await response.text();
        playerJsScripts.push({
          url: url,
          content: content,
          size: content.length
        });
        console.log(`✅ Captured: ${url} (${content.length} bytes)`);
      } catch (e) {
        console.log(`❌ Failed to capture: ${url}`);
      }
    }
  });

  console.log('📡 Loading pro.rcp page...');
  await page.goto('https://vidsrc.xyz/embed/movie/550', { 
    waitUntil: 'networkidle0',
    timeout: 60000 
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Also extract inline scripts from the page
  const inlineScripts = await page.evaluate(() => {
    const scripts = [];
    document.querySelectorAll('script').forEach(script => {
      if (script.innerHTML && script.innerHTML.length > 100) {
        scripts.push({
          type: 'inline',
          content: script.innerHTML,
          size: script.innerHTML.length
        });
      }
    });
    return scripts;
  });

  console.log(`\n📊 Found ${playerJsScripts.length} external scripts`);
  console.log(`📊 Found ${inlineScripts.length} inline scripts`);

  // Save all scripts
  playerJsScripts.forEach((script, index) => {
    const filename = `playerjs-external-${index}.js`;
    fs.writeFileSync(filename, script.content);
    console.log(`💾 Saved: ${filename} (${script.size} bytes)`);
    console.log(`   URL: ${script.url}`);
  });

  inlineScripts.forEach((script, index) => {
    const filename = `playerjs-inline-${index}.js`;
    fs.writeFileSync(filename, script.content);
    console.log(`💾 Saved: ${filename} (${script.size} bytes)`);
  });

  // Now search for the decoder function in all scripts
  console.log('\n🔍 Searching for decoder patterns...');
  
  const allScripts = [...playerJsScripts, ...inlineScripts];
  const decoderPatterns = [
    /function\s+\w+\s*\([^)]*\)\s*{[^}]*atob[^}]*}/g,
    /function\s+\w+\s*\([^)]*\)\s*{[^}]*charCodeAt[^}]*}/g,
    /function\s+\w+\s*\([^)]*\)\s*{[^}]*fromCharCode[^}]*}/g,
    /getElementById\s*\([^)]*\)[^;]*innerHTML/g,
    /\.innerHTML[^;]*atob/g,
    /atob[^;]*\.innerHTML/g
  ];

  const findings = [];

  allScripts.forEach((script, scriptIndex) => {
    decoderPatterns.forEach((pattern, patternIndex) => {
      const matches = script.content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          findings.push({
            scriptIndex,
            scriptType: script.url ? 'external' : 'inline',
            scriptUrl: script.url,
            patternIndex,
            match: match.substring(0, 200)
          });
        });
      }
    });
  });

  console.log(`\n🎯 Found ${findings.length} potential decoder patterns:`);
  findings.forEach((finding, index) => {
    console.log(`\n[${index + 1}] Script ${finding.scriptIndex} (${finding.scriptType})`);
    if (finding.scriptUrl) console.log(`    URL: ${finding.scriptUrl}`);
    console.log(`    Pattern: ${finding.patternIndex}`);
    console.log(`    Match: ${finding.match}...`);
  });

  fs.writeFileSync('decoder-findings.json', JSON.stringify(findings, null, 2));
  console.log('\n💾 Findings saved to decoder-findings.json');

  await browser.close();
}

extractPlayerJsSource().catch(console.error);
