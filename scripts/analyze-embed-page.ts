/**
 * Analyze the rapidshare embed page to find decryption logic
 */

const fs = require('fs');

async function fetchEmbedPage(embedId: string): Promise<string> {
  const url = `https://rapidshare.cc/e/${embedId}`;
  console.log('Fetching embed page:', url);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'https://yflix.to/'
    }
  });
  
  return res.text();
}

function analyzeEmbedPage(html: string): void {
  console.log('\n=== Embed Page Analysis ===');
  console.log('Page length:', html.length);
  
  // Extract all script tags
  const scriptTags = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  console.log('\nScript tags found:', scriptTags.length);
  
  // Look for inline scripts (not src)
  const inlineScripts = scriptTags.filter(s => !s.includes('src='));
  console.log('Inline scripts:', inlineScripts.length);
  
  inlineScripts.forEach((script, i) => {
    const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
    console.log(`\n--- Inline Script ${i + 1} (${content.length} chars) ---`);
    console.log(content.substring(0, 500));
    if (content.length > 500) console.log('...');
  });
  
  // Look for PAGE_DATA
  const pageDataMatch = html.match(/__PAGE_DATA\s*=\s*['"]([^'"]+)['"]/);
  if (pageDataMatch) {
    console.log('\n\n=== PAGE_DATA ===');
    console.log('Value:', pageDataMatch[1]);
    console.log('Length:', pageDataMatch[1].length);
  }
  
  // Look for other window variables
  const windowVars = html.match(/window\.(\w+)\s*=\s*['"]?([^'";\n]+)['"]?/g);
  if (windowVars) {
    console.log('\n\n=== Window Variables ===');
    windowVars.forEach(v => console.log('  ', v.substring(0, 100)));
  }
  
  // Look for external script URLs
  const scriptSrcs = html.match(/src=["']([^"']+\.js[^"']*)["']/gi);
  if (scriptSrcs) {
    console.log('\n\n=== External Scripts ===');
    scriptSrcs.forEach(s => console.log('  ', s));
  }
  
  // Save the page for manual analysis
  fs.writeFileSync('rapidshare-embed-full.html', html);
  console.log('\n\nSaved full page to rapidshare-embed-full.html');
}

async function fetchAndAnalyzeScript(url: string): Promise<void> {
  console.log('\n\n=== Fetching script:', url, '===');
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://rapidshare.cc/'
      }
    });
    
    const code = await res.text();
    console.log('Script length:', code.length);
    
    // Look for decryption patterns
    const patterns = [
      { name: 'PAGE_DATA', regex: /__PAGE_DATA/g },
      { name: 'decrypt', regex: /decrypt/gi },
      { name: 'AES', regex: /AES/gi },
      { name: 'CryptoJS', regex: /CryptoJS/gi },
      { name: 'atob', regex: /atob/g },
      { name: 'btoa', regex: /btoa/g },
      { name: 'charCodeAt', regex: /charCodeAt/g },
      { name: 'fromCharCode', regex: /fromCharCode/g },
      { name: 'setup', regex: /\.setup\s*\(/g },
      { name: 'file:', regex: /["']file["']\s*:/g },
      { name: 'sources', regex: /sources\s*:/g },
      { name: 'm3u8', regex: /m3u8/gi },
      { name: 'jwplayer', regex: /jwplayer/gi },
    ];
    
    console.log('\nPattern matches:');
    for (const p of patterns) {
      const matches = code.match(p.regex);
      if (matches && matches.length > 0) {
        console.log(`  ${p.name}: ${matches.length} occurrences`);
      }
    }
    
    // If it has jwplayer, look for setup calls
    if (code.includes('jwplayer')) {
      const setupMatch = code.match(/jwplayer[^.]*\.setup\s*\(\s*\{[^}]{100,1000}\}/g);
      if (setupMatch) {
        console.log('\n\nJWPlayer setup found:');
        setupMatch.forEach((s, i) => console.log(`${i + 1}. ${s.substring(0, 300)}...`));
      }
    }
    
    // Save for analysis
    const filename = url.split('/').pop()?.split('?')[0] || 'script.js';
    fs.writeFileSync(`rapidshare-${filename}`, code);
    console.log(`\nSaved to rapidshare-${filename}`);
    
  } catch (e: any) {
    console.log('Error fetching script:', e.message);
  }
}

async function main() {
  const embedId = 'kJCuIjiwWSyJcOLzFLpK6xfpCQ'; // Cyberpunk
  
  const html = await fetchEmbedPage(embedId);
  analyzeEmbedPage(html);
  
  // Fetch the main app.js
  await fetchAndAnalyzeScript('https://rapidshare.cc/assets/b/2457433dff948487f3bb6d58f9db2a11/min/app.js?v=19a76d77646');
  
  // Also check if there's a player-specific script
  const playerScripts = html.match(/src=["']([^"']*player[^"']*)["']/gi);
  if (playerScripts) {
    for (const script of playerScripts) {
      const urlMatch = script.match(/src=["']([^"']+)["']/i);
      if (urlMatch) {
        let scriptUrl = urlMatch[1];
        if (!scriptUrl.startsWith('http')) {
          scriptUrl = 'https://rapidshare.cc' + scriptUrl;
        }
        await fetchAndAnalyzeScript(scriptUrl);
      }
    }
  }
}

main().catch(console.error);
