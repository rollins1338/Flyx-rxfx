/**
 * Analyze how PlayerJS reads m3u8 from PRO.RCP page
 * 
 * The flow is:
 * 1. PRO.RCP page loads with a hidden div containing encoded m3u8 URL
 * 2. PlayerJS script is loaded
 * 3. PlayerJS finds the div (likely by ID "pjsdiv" or similar)
 * 4. PlayerJS reads the div's innerHTML/textContent
 * 5. PlayerJS decodes the content (your SBX decoder)
 * 6. PlayerJS loads the m3u8 URL into the player
 */

const axios = require('axios');
const { JSDOM } = require('jsdom');

/**
 * Fetch and analyze a PRO.RCP page
 */
async function analyzeProrcpPage(prorcpUrl) {
  console.log('='.repeat(70));
  console.log('🔍 ANALYZING PRO.RCP PAGE');
  console.log('='.repeat(70));
  console.log(`\nURL: ${prorcpUrl}\n`);

  try {
    // Fetch the page
    console.log('📥 Fetching page...');
    const response = await axios.get(prorcpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/'
      }
    });

    const html = response.data;
    console.log(`✅ Page fetched: ${html.length} bytes\n`);

    // Parse with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 1. Find all divs with display:none or hidden
    console.log('1. HIDDEN DIVS:');
    const hiddenDivs = [];
    
    // Check for divs with display:none
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
      const style = div.getAttribute('style') || '';
      const className = div.getAttribute('class') || '';
      const id = div.getAttribute('id') || '';
      
      if (style.includes('display:none') || 
          style.includes('display: none') ||
          style.includes('visibility:hidden') ||
          className.includes('hidden')) {
        
        const content = div.textContent || div.innerHTML;
        if (content && content.length > 20) {
          hiddenDivs.push({
            id,
            className,
            style,
            content: content.substring(0, 200),
            fullContent: content
          });
        }
      }
    });

    console.log(`   Found ${hiddenDivs.length} hidden divs with content\n`);
    hiddenDivs.forEach((div, i) => {
      console.log(`   [${i + 1}] ID: "${div.id}" Class: "${div.className}"`);
      console.log(`       Content (first 100 chars): ${div.content.substring(0, 100)}...`);
      console.log(`       Full length: ${div.fullContent.length} chars\n`);
    });

    // 2. Find divs with specific IDs that might be used by PlayerJS
    console.log('\n2. DIVS WITH PLAYER-RELATED IDS:');
    const playerDivIds = ['pjsdiv', 'player', 'playerjs', 'video', 'stream', 'source', 'file'];
    playerDivIds.forEach(id => {
      const div = document.getElementById(id);
      if (div) {
        console.log(`   ✅ Found div with ID "${id}"`);
        const content = div.textContent || div.innerHTML;
        if (content) {
          console.log(`      Content: ${content.substring(0, 150)}...`);
          console.log(`      Length: ${content.length} chars\n`);
        }
      }
    });

    // 3. Find PlayerJS script tag
    console.log('\n3. PLAYERJS SCRIPT:');
    const scripts = document.querySelectorAll('script');
    let playerjsScript = null;
    scripts.forEach(script => {
      const src = script.getAttribute('src') || '';
      if (src.includes('playerjs') || src.includes('player.js')) {
        console.log(`   ✅ Found PlayerJS script: ${src}`);
        playerjsScript = src;
      }
    });

    // 4. Find player initialization code
    console.log('\n4. PLAYER INITIALIZATION:');
    const inlineScripts = [];
    scripts.forEach(script => {
      if (!script.getAttribute('src')) {
        const content = script.textContent || '';
        if (content.includes('Playerjs') || 
            content.includes('player') || 
            content.includes('file') ||
            content.includes('pjsdiv')) {
          inlineScripts.push(content);
        }
      }
    });

    console.log(`   Found ${inlineScripts.length} inline scripts with player references\n`);
    inlineScripts.forEach((script, i) => {
      console.log(`   [${i + 1}] Script (first 300 chars):`);
      console.log(`       ${script.substring(0, 300).replace(/\n/g, ' ')}...\n`);
    });

    // 5. Look for data attributes
    console.log('\n5. DATA ATTRIBUTES:');
    allDivs.forEach(div => {
      const attrs = div.attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (attr.name.startsWith('data-')) {
          console.log(`   Found ${attr.name} on div#${div.id || 'unknown'}`);
          console.log(`      Value: ${attr.value.substring(0, 100)}...\n`);
        }
      }
    });

    // 6. Summary and recommendations
    console.log('\n' + '='.repeat(70));
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(70));
    
    if (hiddenDivs.length > 0) {
      console.log('\n✅ Found hidden divs with encoded content');
      console.log('   These likely contain the encoded m3u8 URL');
      console.log('\n   Next steps:');
      console.log('   1. Extract the content from the hidden div');
      console.log('   2. Decode using your SBX decoder');
      console.log('   3. The decoded value should be the m3u8 URL');
      
      console.log('\n   Hidden div details:');
      hiddenDivs.forEach((div, i) => {
        console.log(`\n   Div ${i + 1}:`);
        console.log(`      ID: ${div.id || '(none)'}`);
        console.log(`      Content length: ${div.fullContent.length}`);
        console.log(`      First 200 chars: ${div.fullContent.substring(0, 200)}`);
      });
    } else {
      console.log('\n❌ No hidden divs found');
      console.log('   The page structure might be different');
    }

    if (playerjsScript) {
      console.log(`\n✅ PlayerJS script found: ${playerjsScript}`);
    }

    if (inlineScripts.length > 0) {
      console.log(`\n✅ Found ${inlineScripts.length} inline scripts`);
      console.log('   These might contain the player initialization logic');
    }

    return {
      hiddenDivs,
      playerjsScript,
      inlineScripts,
      html
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  node analyze-prorcp-playerjs-flow.js <prorcp_url>

Example:
  node analyze-prorcp-playerjs-flow.js "https://cloudnestra.com/prorcp/HASH"

This script will:
1. Fetch the PRO.RCP page
2. Find hidden divs with encoded content
3. Identify PlayerJS script references
4. Show player initialization code
5. Help you understand how PlayerJS reads the m3u8 URL
    `);
    process.exit(1);
  }

  const prorcpUrl = args[0];
  await analyzeProrcpPage(prorcpUrl);
}

if (require.main === module) {
  main();
}

module.exports = { analyzeProrcpPage };
