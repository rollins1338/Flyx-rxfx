/**
 * DLHD Recon Phase 2 - Probe the NEW embed domains discovered in Phase 1
 * 
 * Phase 1 findings:
 *   stream  → lefttoplay.xyz/premiumtv/daddyhd.php?id=51
 *   cast    → lefttoplay.xyz/premiumtv/daddyhd.php?id=51
 *   watch   → topembed.pw/channel/AbcTv[USA]  (DNS dead)
 *   plus    → daddyliveplayer.shop/embed/wffwehg9yklo7k3dmabqxi70sbws5w4q
 *   casting → ddyplayer.cfd/api/v1/channels/player/daddylive/?name=abc&code=us&user=cdnlivetv&plan=free
 *   player  → tv-bu1.blogspot.com/p/e1.html?id=51a
 * 
 * Also: epaly.fun has SSL handshake failure, eplayer.to DNS dead, codepcplay.fun DNS dead
 * The PRIMARY embed domain has rotated to lefttoplay.xyz!
 */

const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchUrl(url, referer = 'https://dlhd.link/', timeout = 15000, followRedirects = true) {
  return new Promise((resolve) => {
    const start = Date.now();
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    
    const req = lib.get(url, {
      headers: {
        'User-Agent': UA,
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout,
      rejectUnauthorized: false,
    }, (res) => {
      // Follow redirects
      if (followRedirects && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        console.log(`  → Redirect: ${redirectUrl}`);
        return fetchUrl(redirectUrl, referer, timeout, true).then(resolve);
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          elapsed: Date.now() - start,
          url,
          redirectUrl: res.headers.location || null,
        });
      });
    });
    
    req.on('error', (e) => {
      resolve({ status: 0, error: e.message, elapsed: Date.now() - start, url });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'TIMEOUT', elapsed: Date.now() - start, url });
    });
  });
}

function extractPlayerInfo(html) {
  const info = {};
  
  // EPlayerAuth.init()
  const epaMatch = html.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
  if (epaMatch) {
    info.hasEPlayerAuth = true;
    const initStr = epaMatch[1];
    for (const field of ['authToken', 'channelKey', 'channelSalt', 'country', 'timestamp']) {
      const m = initStr.match(new RegExp(`${field}\\s*:\\s*["']([^"']+)["']`));
      if (m) info[field] = field === 'channelSalt' ? m[1].substring(0, 20) + '...' : m[1].substring(0, 80);
      const mNum = initStr.match(new RegExp(`${field}\\s*:\\s*(\\d+)`));
      if (mNum && !m) info[field] = mNum[1];
    }
  }
  
  // JWT tokens
  const jwtMatch = html.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwtMatch) {
    info.hasJWT = true;
    try {
      const payload = JSON.parse(Buffer.from(jwtMatch[0].split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
      info.jwtPayload = payload;
    } catch {}
  }
  
  // iframes
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
  if (iframeMatch) {
    info.iframes = iframeMatch.map(m => {
      const srcMatch = m.match(/src=["']([^"']+)["']/);
      return srcMatch ? srcMatch[1] : null;
    }).filter(Boolean);
  }
  
  // m3u8 URLs
  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
  if (m3u8Match) info.m3u8Urls = [...new Set(m3u8Match)];
  
  // mono.css (DLHD's M3U8 disguise)
  const monoMatch = html.match(/https?:\/\/[^\s"']+mono\.css[^\s"']*/g);
  if (monoMatch) info.monoCssUrls = [...new Set(monoMatch)];
  
  // HLS.js or video player references
  if (html.includes('hls.js') || html.includes('Hls(') || html.includes('Hls.')) info.hasHlsJs = true;
  if (html.includes('clappr') || html.includes('Clappr')) info.hasClappr = true;
  if (html.includes('jwplayer') || html.includes('JWPlayer')) info.hasJWPlayer = true;
  if (html.includes('video.js') || html.includes('videojs')) info.hasVideoJs = true;
  
  // Script sources
  const scriptMatch = html.match(/<script[^>]+src=["']([^"']+)["']/gi);
  if (scriptMatch) {
    info.scripts = scriptMatch.map(m => {
      const srcMatch = m.match(/src=["']([^"']+)["']/);
      return srcMatch ? srcMatch[1] : null;
    }).filter(Boolean).slice(0, 10);
  }
  
  // Inline script content (look for stream URLs, auth patterns)
  const inlineScripts = html.match(/<script[^>]*>([^<]{50,})<\/script>/gi);
  if (inlineScripts) {
    for (const script of inlineScripts) {
      const content = script.replace(/<\/?script[^>]*>/gi, '');
      // Look for stream/source URLs
      const urlMatch = content.match(/(?:source|src|url|stream|file)\s*[:=]\s*["']([^"']+(?:m3u8|mpd|mp4|css)[^"']*)/i);
      if (urlMatch) {
        info.streamUrl = urlMatch[1];
      }
      // Look for dvalna references
      if (content.includes('dvalna')) info.hasDvalnaInScript = true;
      // Look for key patterns
      if (content.includes('/key/')) info.hasKeyPattern = true;
      // Look for auth/token patterns
      if (content.includes('authToken') || content.includes('channelSalt')) info.hasAuthInScript = true;
    }
  }
  
  // Known domains referenced
  const knownDomains = ['epaly.fun', 'eplayer.to', 'hitsplay.fun', 'codepcplay.fun', 'topembed.pw', 
    'dvalna.ru', 'moveonjoy', 'lovecdn', 'casthill', 'lefttoplay.xyz', 'daddyliveplayer.shop', 
    'ddyplayer.cfd', 'chevy.dvalna.ru', 'kiko2.ru', 'giokko.ru'];
  info.referencedDomains = knownDomains.filter(d => html.includes(d));
  
  info.title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim();
  info.bodySize = html.length;
  
  return info;
}

async function main() {
  console.log('='.repeat(80));
  console.log('DLHD RECON PHASE 2 - Probing New Embed Domains');
  console.log('='.repeat(80));
  
  // =========================================================================
  // PROBE 1: lefttoplay.xyz (used by stream + cast folders)
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('PROBE 1: lefttoplay.xyz (stream/cast folders)');
  console.log('='.repeat(60));
  
  const lefttoplayUrls = [
    { url: 'https://lefttoplay.xyz/premiumtv/daddyhd.php?id=51', name: 'ch51 (ABC)' },
    { url: 'https://lefttoplay.xyz/premiumtv/daddyhd.php?id=44', name: 'ch44 (ESPN)' },
  ];
  
  for (const item of lefttoplayUrls) {
    console.log(`\n--- ${item.name}: ${item.url} ---`);
    const result = await fetchUrl(item.url, 'https://dlhd.link/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.body && result.status === 200) {
      const info = extractPlayerInfo(result.body);
      console.log(`  Player info:`, JSON.stringify(info, null, 2));
    }
  }
  
  // =========================================================================
  // PROBE 2: daddyliveplayer.shop (used by plus folder)
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('PROBE 2: daddyliveplayer.shop (plus folder)');
  console.log('='.repeat(60));
  
  const daddyplayerUrls = [
    { url: 'https://daddyliveplayer.shop/embed/wffwehg9yklo7k3dmabqxi70sbws5w4q', name: 'ch51 embed token' },
  ];
  
  for (const item of daddyplayerUrls) {
    console.log(`\n--- ${item.name}: ${item.url} ---`);
    const result = await fetchUrl(item.url, 'https://dlhd.link/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.body && result.status === 200) {
      const info = extractPlayerInfo(result.body);
      console.log(`  Player info:`, JSON.stringify(info, null, 2));
    }
  }
  
  // =========================================================================
  // PROBE 3: ddyplayer.cfd (used by casting folder)
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('PROBE 3: ddyplayer.cfd (casting folder)');
  console.log('='.repeat(60));
  
  const ddyplayerUrls = [
    { url: 'https://ddyplayer.cfd/api/v1/channels/player/daddylive/?name=abc&code=us&user=cdnlivetv&plan=free', name: 'ch51 API' },
    { url: 'https://ddyplayer.cfd/api/v1/channels/player/daddylive/?name=espn&code=us&user=cdnlivetv&plan=free', name: 'ESPN API' },
  ];
  
  for (const item of ddyplayerUrls) {
    console.log(`\n--- ${item.name}: ${item.url} ---`);
    const result = await fetchUrl(item.url, 'https://dlhd.link/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.body && result.status === 200) {
      const info = extractPlayerInfo(result.body);
      console.log(`  Player info:`, JSON.stringify(info, null, 2));
      // Also show raw body if small
      if (result.body.length < 2000) {
        console.log(`  Raw body (first 1500):`, result.body.substring(0, 1500));
      }
    }
  }
  
  // =========================================================================
  // PROBE 4: tv-bu1.blogspot.com (used by player folder)
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('PROBE 4: tv-bu1.blogspot.com (player folder)');
  console.log('='.repeat(60));
  
  const blogspotUrls = [
    { url: 'https://tv-bu1.blogspot.com/p/e1.html?id=51a', name: 'ch51 blogspot' },
  ];
  
  for (const item of blogspotUrls) {
    console.log(`\n--- ${item.name}: ${item.url} ---`);
    const result = await fetchUrl(item.url, 'https://dlhd.link/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.body && result.status === 200) {
      const info = extractPlayerInfo(result.body);
      console.log(`  Player info:`, JSON.stringify(info, null, 2));
    }
  }
  
  // =========================================================================
  // PROBE 5: Check if lefttoplay.xyz uses same EPlayerAuth pattern
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('PROBE 5: Deep dive into lefttoplay.xyz auth system');
  console.log('='.repeat(60));
  
  // Try the daddylive.php pattern too
  const deepUrls = [
    { url: 'https://lefttoplay.xyz/daddylive.php?live=51&vw=100vw&vh=100vh', name: 'daddylive pattern' },
    { url: 'https://lefttoplay.xyz/channel/AbcTv[USA]', name: 'channel pattern' },
  ];
  
  for (const item of deepUrls) {
    console.log(`\n--- ${item.name}: ${item.url} ---`);
    const result = await fetchUrl(item.url, 'https://dlhd.link/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.body && result.status === 200) {
      const info = extractPlayerInfo(result.body);
      console.log(`  Player info:`, JSON.stringify(info, null, 2));
    }
  }
  
  // =========================================================================
  // PROBE 6: Test M3U8 with lefttoplay.xyz as referer
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('PROBE 6: M3U8 with different referers');
  console.log('='.repeat(60));
  
  const m3u8Url = 'https://zekonew.dvalna.ru/zeko/premium51/mono.css';
  const referers = [
    'https://lefttoplay.xyz/',
    'https://epaly.fun/',
    'https://daddyliveplayer.shop/',
    'https://dlhd.link/',
  ];
  
  for (const ref of referers) {
    console.log(`\n--- M3U8 with Referer: ${ref} ---`);
    const result = await fetchUrl(m3u8Url, ref, 5000);
    const isM3U8 = result.body?.includes('#EXTM3U');
    const hasKey = result.body?.includes('URI="');
    console.log(`  Status: ${result.status} | isM3U8: ${isM3U8} | hasKey: ${hasKey} | Time: ${result.elapsed}ms`);
    if (isM3U8 && hasKey) {
      const keyMatch = result.body.match(/URI="([^"]+)"/);
      if (keyMatch) console.log(`  Key URL: ${keyMatch[1]}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2 RECON COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
