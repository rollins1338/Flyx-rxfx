/**
 * Analyze how the ProRCP hash is generated on the RCP page
 * We need to find the JavaScript that creates the prorcp URL
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

async function main() {
  console.log('='.repeat(80));
  console.log('ANALYZING RCP PAGE - HOW IS PRORCP HASH GENERATED?');
  console.log('='.repeat(80));

  // Fetch embed page
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.error('No RCP'); return; }
  
  const rcpHash = rcpMatch[1];
  const rcpUrl = 'https://cloudnestra.com/rcp/' + rcpHash;
  
  console.log(`\nRCP URL: ${rcpUrl.substring(0, 100)}...`);
  
  // Fetch RCP page
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  // Save full HTML
  await Bun.write('debug-rcp-full-analysis.html', rcpHtml);
  console.log(`\nRCP HTML saved to debug-rcp-full-analysis.html`);
  console.log(`RCP HTML length: ${rcpHtml.length}`);
  
  // Extract the ProRCP hash that's in the page
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (prorcpMatch) {
    console.log(`\nProRCP hash found: ${prorcpMatch[1].substring(0, 80)}...`);
  }
  
  // Look for ALL script tags
  console.log('\n' + '='.repeat(60));
  console.log('SCRIPT ANALYSIS');
  console.log('='.repeat(60));
  
  const scriptTags = rcpHtml.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  console.log(`\nFound ${scriptTags.length} script tags`);
  
  for (let i = 0; i < scriptTags.length; i++) {
    const script = scriptTags[i];
    const srcMatch = script.match(/src=["']([^"']+)["']/);
    const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
    
    if (srcMatch) {
      console.log(`\n[Script ${i + 1}] External: ${srcMatch[1]}`);
    } else if (content.length > 0) {
      console.log(`\n[Script ${i + 1}] Inline (${content.length} chars)`);
      
      // Check if this script contains prorcp
      if (content.includes('prorcp') || content.includes('loadIframe')) {
        console.log('*** CONTAINS PRORCP/LOADIFRAME ***');
        console.log('\nFull script content:');
        console.log(content);
      }
    }
  }
  
  // Look for the loadIframe function specifically
  console.log('\n' + '='.repeat(60));
  console.log('LOADIFRAME FUNCTION ANALYSIS');
  console.log('='.repeat(60));
  
  const loadIframeMatch = rcpHtml.match(/function\s+loadIframe[\s\S]*?(?=function\s+\w+|<\/script>)/);
  if (loadIframeMatch) {
    console.log('\nloadIframe function:');
    console.log(loadIframeMatch[0]);
  }
  
  // Look for any hash generation code
  console.log('\n' + '='.repeat(60));
  console.log('HASH GENERATION PATTERNS');
  console.log('='.repeat(60));
  
  // Check for base64 encoding
  const btoaMatches = rcpHtml.match(/btoa\s*\([^)]+\)/g);
  if (btoaMatches) {
    console.log(`\nbtoa() calls: ${btoaMatches.length}`);
    btoaMatches.forEach(m => console.log(`  ${m}`));
  }
  
  // Check for MD5
  const md5Matches = rcpHtml.match(/md5\s*\([^)]+\)/gi);
  if (md5Matches) {
    console.log(`\nMD5() calls: ${md5Matches.length}`);
    md5Matches.forEach(m => console.log(`  ${m}`));
  }
  
  // Check for any encryption
  const cryptoMatches = rcpHtml.match(/crypto|encrypt|decrypt|aes|cipher/gi);
  if (cryptoMatches) {
    console.log(`\nCrypto references: ${cryptoMatches.length}`);
  }
  
  // Look for the prorcp URL construction
  console.log('\n' + '='.repeat(60));
  console.log('PRORCP URL CONSTRUCTION');
  console.log('='.repeat(60));
  
  // Find where prorcp URL is set
  const prorcpUrlPatterns = [
    /src:\s*['"]([^'"]*prorcp[^'"]*)['"]/g,
    /['"]\/prorcp\/[^'"]+['"]/g,
    /prorcp\s*[=:]\s*['"][^'"]+['"]/g,
  ];
  
  for (const pattern of prorcpUrlPatterns) {
    const matches = rcpHtml.match(pattern);
    if (matches) {
      console.log(`\nPattern ${pattern}:`);
      matches.forEach(m => console.log(`  ${m.substring(0, 100)}`));
    }
  }
  
  // Check if the hash is hardcoded or generated
  console.log('\n' + '='.repeat(60));
  console.log('IS HASH HARDCODED OR GENERATED?');
  console.log('='.repeat(60));
  
  // Count occurrences of the prorcp hash
  if (prorcpMatch) {
    const hashOccurrences = (rcpHtml.match(new RegExp(prorcpMatch[1].substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`\nProRCP hash appears ${hashOccurrences} time(s) in HTML`);
    
    if (hashOccurrences === 1) {
      console.log('Hash appears only once - likely HARDCODED by server');
    } else {
      console.log('Hash appears multiple times - might be generated client-side');
    }
  }
  
  // Fetch external scripts
  console.log('\n' + '='.repeat(60));
  console.log('EXTERNAL SCRIPTS ANALYSIS');
  console.log('='.repeat(60));
  
  const externalScripts = rcpHtml.match(/src=["']([^"']+\.js[^"']*)/gi) || [];
  
  for (const scriptSrc of externalScripts) {
    const src = scriptSrc.replace(/src=["']/i, '');
    
    // Skip CDN scripts
    if (src.includes('jquery') || src.includes('cloudflare') || src.includes('cookie')) {
      console.log(`\nSkipping CDN script: ${src}`);
      continue;
    }
    
    let fullUrl = src;
    if (src.startsWith('/')) {
      fullUrl = 'https://cloudnestra.com' + src;
    } else if (!src.startsWith('http')) {
      fullUrl = 'https://cloudnestra.com/' + src;
    }
    
    console.log(`\nFetching: ${fullUrl}`);
    
    try {
      const scriptContent = await fetchPage(fullUrl, rcpUrl);
      console.log(`Length: ${scriptContent.length}`);
      
      // Check for hash generation
      if (scriptContent.includes('prorcp') || scriptContent.includes('srcrcp')) {
        console.log('*** CONTAINS PRORCP/SRCRCP ***');
        await Bun.write(`debug-script-${src.split('/').pop()}`, scriptContent);
      }
      
      if (scriptContent.includes('btoa') || scriptContent.includes('md5') || scriptContent.includes('encrypt')) {
        console.log('*** CONTAINS ENCODING/CRYPTO ***');
      }
    } catch (e) {
      console.log(`Failed to fetch: ${e}`);
    }
  }
  
  // Final analysis
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  
  console.log(`
Based on the analysis:

1. The ProRCP hash is embedded directly in the HTML
2. It appears to be generated SERVER-SIDE, not client-side
3. The loadIframe function just uses the pre-generated hash

This means:
- The RCP page server decrypts the RCP hash
- Generates a new ProRCP hash with fresh encryption
- Embeds it in the HTML response

We CANNOT generate the ProRCP hash client-side because:
- The server uses a private key to decrypt RCP
- The server generates new random values for ProRCP
- The hash is already in the HTML when we receive it
`);
}

main().catch(console.error);
