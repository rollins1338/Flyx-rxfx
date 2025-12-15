/**
 * Analyze the browser's encoded output to understand the pattern
 */

const puppeteer = require('puppeteer');

async function analyzeBrowserEncoded() {
  console.log('=== ANALYZING BROWSER ENCODED OUTPUT ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    let browserEncoded = null;
    let pageData = null;
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        const parts = url.split('/');
        const fcdIdx = parts.findIndex(p => p.startsWith('fcd552c4'));
        browserEncoded = parts[fcdIdx + 1];
      }
    });
    
    await page.goto('https://111movies.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    pageData = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      return script ? JSON.parse(script.textContent).props?.pageProps?.data : null;
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Page data length:', pageData.length);
    console.log('Browser encoded length:', browserEncoded.length);
    console.log('Ratio:', (browserEncoded.length / pageData.length).toFixed(2));
    
    console.log('\n=== BROWSER ENCODED STRUCTURE ===');
    
    // Split by 'p' and analyze
    const parts = browserEncoded.split('p');
    console.log('Parts (split by p):', parts.length);
    console.log('Part lengths:', parts.map(p => p.length));
    
    // Check if there's a pattern
    // The browser encoded has 783 chars, page data has 172
    // 783 / 172 = 4.55
    
    // If each input char becomes ~4.5 output chars, that's unusual
    // Let's check if the encoding is per-character
    
    console.log('\n=== PATTERN ANALYSIS ===');
    
    // Check for repeating patterns
    const chunks4 = browserEncoded.match(/.{1,4}/g);
    const uniqueChunks4 = new Set(chunks4);
    console.log('4-char chunks:', chunks4.length, 'total,', uniqueChunks4.size, 'unique');
    
    // Check character distribution
    const charCounts = {};
    for (const c of browserEncoded) {
      charCounts[c] = (charCounts[c] || 0) + 1;
    }
    
    const sortedChars = Object.entries(charCounts).sort((a, b) => b[1] - a[1]);
    console.log('\nTop 15 characters:');
    sortedChars.slice(0, 15).forEach(([c, n]) => {
      console.log(`  '${c}': ${n} (${(n / browserEncoded.length * 100).toFixed(1)}%)`);
    });
    
    // Check if 'p' appears at regular intervals
    console.log('\n=== "p" POSITIONS ===');
    const pPositions = [];
    for (let i = 0; i < browserEncoded.length; i++) {
      if (browserEncoded[i] === 'p') {
        pPositions.push(i);
      }
    }
    console.log('Total "p" count:', pPositions.length);
    console.log('First 20 positions:', pPositions.slice(0, 20));
    
    // Calculate intervals
    const intervals = [];
    for (let i = 1; i < pPositions.length; i++) {
      intervals.push(pPositions[i] - pPositions[i - 1]);
    }
    console.log('First 20 intervals:', intervals.slice(0, 20));
    
    // Check if intervals follow a pattern
    const uniqueIntervals = [...new Set(intervals)].sort((a, b) => a - b);
    console.log('Unique intervals:', uniqueIntervals);
    
    // The pattern might be: every 4th character is 'p' (like base64 with delimiter)
    // Or: 'p' is part of the substitution alphabet
    
    console.log('\n=== CHECKING IF "p" IS SUBSTITUTED ===');
    // In our substitution: 'p' in standard alphabet maps to '1' in shuffled
    // And '5' in standard maps to 'p' in shuffled
    // So 'p' in output means the base64 had '5' at that position
    
    // Let's check if the browser output has 'p' where we'd expect '5' in base64
    
  } finally {
    await browser.close();
  }
}

analyzeBrowserEncoded().catch(console.error);
