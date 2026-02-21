/**
 * DLHD Recon Phase 3 - Deep dive into lefttoplay.xyz and daddyliveplayer.shop
 * 
 * Key findings from Phase 2:
 * - lefttoplay.xyz/premiumtv/daddyhd.php?id=51 → has EPlayerAuth with channelSalt!
 * - daddyliveplayer.shop/embed/... → has clappr player, 205KB page
 * - ddyplayer.cfd → redirects to cdn-live.tv, uses OPlayer
 * - tv-bu1.blogspot.com → massive page with moveonjoy/thetvapp.to M3U8 URLs
 * - M3U8 works with ANY referer (lefttoplay.xyz, epaly.fun, daddyliveplayer.shop, dlhd.link)
 * 
 * This phase: Extract actual stream URLs from lefttoplay.xyz and daddyliveplayer.shop
 */

const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchUrl(url, referer = 'https://dlhd.link/', timeout = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(url, {
      headers: {
        'User-Agent': UA,
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout,
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data, elapsed: Date.now() - start, url });
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, elapsed: Date.now() - start, url }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', elapsed: Date.now() - start, url }); });
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('DLHD RECON PHASE 3 - Deep Dive');
  console.log('='.repeat(80));

  // =========================================================================
  // 1. lefttoplay.xyz - Extract EPlayerAuth details
  // =========================================================================
  console.log('\n--- lefttoplay.xyz premiumtv ch51 ---');
  const ltp = await fetchUrl('https://lefttoplay.xyz/premiumtv/daddyhd.php?id=51', 'https://dlhd.link/');
  console.log(`Status: ${ltp.status} | Size: ${ltp.body?.length || 0} | Time: ${ltp.elapsed}ms`);
  
  if (ltp.body) {
    // Extract EPlayerAuth.init()
    const epaMatch = ltp.body.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
    if (epaMatch) {
      console.log('\n  EPlayerAuth.init() found:');
      const initStr = epaMatch[1];
      // Print the full init string (cleaned up)
      console.log('  Raw init:', initStr.replace(/\s+/g, ' ').trim());
    }
    
    // Extract all script tags with their content
    const scripts = ltp.body.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    console.log(`\n  Total script tags: ${scripts.length}`);
    
    // Look for inline scripts with auth/stream logic
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.includes('EPlayerAuth') || script.includes('dvalna') || script.includes('mono.css') || 
          script.includes('m3u8') || script.includes('Hls') || script.includes('channelSalt')) {
        console.log(`\n  Script #${i} (relevant):`);
        const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
        // Print first 500 chars
        console.log('  ' + content.substring(0, 800).replace(/\n/g, '\n  '));
        if (content.length > 800) console.log('  ... (truncated)');
      }
    }
    
    // Look for dvalna.ru references
    const dvalnaRefs = ltp.body.match(/[a-z0-9]+new\.dvalna\.ru[^\s"'<>]*/g);
    if (dvalnaRefs) {
      console.log('\n  dvalna.ru references:', [...new Set(dvalnaRefs)]);
    }
    
    // Look for key URL patterns
    const keyRefs = ltp.body.match(/chevy\.dvalna\.ru\/key\/[^\s"'<>]*/g);
    if (keyRefs) {
      console.log('  Key URL patterns:', [...new Set(keyRefs)]);
    }
    
    // Look for server_lookup references
    const serverLookup = ltp.body.match(/server_lookup[^\s"'<>]*/g);
    if (serverLookup) {
      console.log('  server_lookup refs:', [...new Set(serverLookup)]);
    }
  }

  // =========================================================================
  // 2. lefttoplay.xyz - Try channel 44 (ESPN)
  // =========================================================================
  console.log('\n\n--- lefttoplay.xyz premiumtv ch44 (ESPN) ---');
  const ltp44 = await fetchUrl('https://lefttoplay.xyz/premiumtv/daddyhd.php?id=44', 'https://dlhd.link/');
  console.log(`Status: ${ltp44.status} | Size: ${ltp44.body?.length || 0} | Time: ${ltp44.elapsed}ms`);
  
  if (ltp44.body) {
    const epaMatch = ltp44.body.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
    if (epaMatch) {
      console.log('  EPlayerAuth.init():', epaMatch[1].replace(/\s+/g, ' ').trim());
    }
  }

  // =========================================================================
  // 3. daddyliveplayer.shop - Extract stream source
  // =========================================================================
  console.log('\n\n--- daddyliveplayer.shop embed ---');
  const dlp = await fetchUrl('https://daddyliveplayer.shop/embed/wffwehg9yklo7k3dmabqxi70sbws5w4q', 'https://dlhd.link/');
  console.log(`Status: ${dlp.status} | Size: ${dlp.body?.length || 0} | Time: ${dlp.elapsed}ms`);
  
  if (dlp.body) {
    // Look for stream source URLs
    const streamUrls = dlp.body.match(/(?:source|src|url|stream|file|source_url)\s*[:=]\s*["']([^"']+)/gi);
    if (streamUrls) {
      console.log('  Stream URLs found:');
      streamUrls.forEach(u => console.log('    ' + u.substring(0, 120)));
    }
    
    // Look for Clappr config
    const clapprMatch = dlp.body.match(/new\s+Clappr\.Player\s*\(\s*\{[\s\S]{0,2000}\}\s*\)/);
    if (clapprMatch) {
      console.log('\n  Clappr config:', clapprMatch[0].substring(0, 500));
    }
    
    // Look for any m3u8/stream references
    const m3u8s = dlp.body.match(/https?:\/\/[^\s"']+(?:\.m3u8|mono\.css|\.ts|index\.m3u8)[^\s"']*/g);
    if (m3u8s) {
      console.log('\n  M3U8/stream URLs:', [...new Set(m3u8s)]);
    }
    
    // Look for dvalna references
    if (dlp.body.includes('dvalna')) {
      console.log('  Has dvalna.ru references');
      const dvalnaRefs = dlp.body.match(/[^\s"'<>]*dvalna[^\s"'<>]*/g);
      if (dvalnaRefs) console.log('  dvalna refs:', [...new Set(dvalnaRefs)]);
    }
    
    // Look for cstream.fit references
    if (dlp.body.includes('cstream')) {
      console.log('  Has cstream.fit references');
    }
    
    // Look for inline scripts with stream logic
    const scripts = dlp.body.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
      if (content.length > 100 && (content.includes('source') || content.includes('stream') || 
          content.includes('player') || content.includes('Clappr') || content.includes('Hls'))) {
        console.log(`\n  Script #${i} (player-related, ${content.length} chars):`);
        console.log('  ' + content.substring(0, 1000).replace(/\n/g, '\n  '));
        if (content.length > 1000) console.log('  ... (truncated)');
      }
    }
  }

  // =========================================================================
  // 4. cdn-live.tv - Extract stream from casting folder
  // =========================================================================
  console.log('\n\n--- cdn-live.tv (casting folder redirect) ---');
  const cdnlive = await fetchUrl('https://cdn-live.tv/api/v1/channels/player/?name=abc&code=us&user=daddylive&plan=free', 'https://dlhd.link/');
  console.log(`Status: ${cdnlive.status} | Size: ${cdnlive.body?.length || 0} | Time: ${cdnlive.elapsed}ms`);
  
  if (cdnlive.body) {
    // Look for stream URLs
    const m3u8s = cdnlive.body.match(/https?:\/\/[^\s"']+(?:\.m3u8|mono\.css|index\.m3u8)[^\s"']*/g);
    if (m3u8s) {
      console.log('  M3U8 URLs:', [...new Set(m3u8s)].slice(0, 10));
    }
    
    // Look for OPlayer config
    const oplayerMatch = cdnlive.body.match(/OPlayer\s*\(\s*\{[\s\S]{0,2000}\}\s*\)/);
    if (oplayerMatch) {
      console.log('\n  OPlayer config:', oplayerMatch[0].substring(0, 500));
    }
    
    // Look for inline scripts with stream logic
    const scripts = cdnlive.body.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (let i = 0; i < scripts.length; i++) {
      const content = scripts[i].replace(/<\/?script[^>]*>/gi, '').trim();
      if (content.length > 100 && (content.includes('source') || content.includes('m3u8') || 
          content.includes('player') || content.includes('OPlayer') || content.includes('hls'))) {
        console.log(`\n  Script #${i} (${content.length} chars):`);
        console.log('  ' + content.substring(0, 1200).replace(/\n/g, '\n  '));
        if (content.length > 1200) console.log('  ... (truncated)');
      }
    }
  }

  // =========================================================================
  // 5. Test cstream.fit embed (appears in daddyliveplayer.shop)
  // =========================================================================
  console.log('\n\n--- cstream.fit embed test ---');
  const cstream = await fetchUrl('https://cstream.fit/embed/wffwehg9yklo7k3dmabqxi70sbws5w4q', 'https://daddyliveplayer.shop/');
  console.log(`Status: ${cstream.status} | Size: ${cstream.body?.length || 0} | Time: ${cstream.elapsed}ms`);
  if (cstream.error) console.log(`Error: ${cstream.error}`);
  
  if (cstream.body && cstream.status === 200) {
    // Look for stream URLs
    const m3u8s = cstream.body.match(/https?:\/\/[^\s"']+(?:\.m3u8|mono\.css)[^\s"']*/g);
    if (m3u8s) console.log('  M3U8 URLs:', [...new Set(m3u8s)]);
    
    // Look for dvalna references
    if (cstream.body.includes('dvalna')) {
      const refs = cstream.body.match(/[^\s"'<>]*dvalna[^\s"'<>]*/g);
      console.log('  dvalna refs:', [...new Set(refs || [])]);
    }
    
    // EPlayerAuth
    const epa = cstream.body.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
    if (epa) console.log('  EPlayerAuth:', epa[1].replace(/\s+/g, ' ').trim());
    
    // Any iframes
    const iframes = cstream.body.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
    if (iframes) {
      console.log('  Iframes:', iframes.map(m => m.match(/src=["']([^"']+)["']/)?.[1]).filter(Boolean));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 3 RECON COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
