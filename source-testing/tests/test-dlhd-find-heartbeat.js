/**
 * Find the heartbeat mechanism in DLHD player
 */

async function main() {
  console.log('=== Finding DLHD Heartbeat Mechanism ===\n');
  
  const channel = '51';
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  
  try {
    const res = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    });
    
    const html = await res.text();
    
    // Look for all JavaScript variables
    console.log('=== JavaScript Variables ===');
    const varMatches = html.matchAll(/(?:var|const|let)\s+([A-Z_][A-Z0-9_]*)\s*=\s*["']([^"']+)["']/g);
    for (const match of varMatches) {
      console.log(`${match[1]} = "${match[2]}"`);
    }
    
    // Look for all URLs
    console.log('\n=== All URLs ===');
    const urlMatches = html.matchAll(/https?:\/\/[^\s"'<>]+/g);
    const urls = [...new Set([...urlMatches].map(m => m[0]))];
    urls.forEach(u => console.log(u));
    
    // Look for heartbeat/session/ping patterns
    console.log('\n=== Heartbeat/Session Patterns ===');
    const patterns = ['heartbeat', 'hb', 'session', 'ping', 'alive', 'keepalive', 'init'];
    for (const pattern of patterns) {
      const regex = new RegExp(`[a-zA-Z_]*${pattern}[a-zA-Z_]*`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        console.log(`${pattern}:`, [...new Set(matches)]);
      }
    }
    
    // Look for fetch/XMLHttpRequest calls
    console.log('\n=== Fetch/XHR Patterns ===');
    const fetchMatches = html.match(/fetch\s*\([^)]+\)/g);
    if (fetchMatches) {
      fetchMatches.forEach(m => console.log(m.substring(0, 100)));
    }
    
    // Look for setInterval (heartbeat is usually on interval)
    console.log('\n=== setInterval Patterns ===');
    const intervalMatches = html.match(/setInterval\s*\([^)]+\)/g);
    if (intervalMatches) {
      intervalMatches.forEach(m => console.log(m.substring(0, 150)));
    }
    
    // Look for any kiko2.ru URLs
    console.log('\n=== kiko2.ru URLs ===');
    const kikoMatches = html.match(/https?:\/\/[^\s"'<>]*kiko2\.ru[^\s"'<>]*/g);
    if (kikoMatches) {
      [...new Set(kikoMatches)].forEach(u => console.log(u));
    }
    
    // Look for script src
    console.log('\n=== External Scripts ===');
    const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
    for (const match of scriptMatches) {
      console.log(match[1]);
    }
    
    // Save full HTML for manual inspection
    require('fs').writeFileSync('dlhd-player-page.html', html);
    console.log('\n=== Full HTML saved to dlhd-player-page.html ===');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
