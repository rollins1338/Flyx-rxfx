/**
 * DLHD Full Recon - February 2026
 * 
 * Probes all known DLHD player domains and folder patterns to understand
 * the current auth system for all 6 players.
 * 
 * From daddyhd.com/api.php, the 6 folder patterns are:
 *   stream, cast, watch, plus, casting, player
 * 
 * Known player/embed domains (historical):
 *   - epaly.fun (current primary, Feb 2026)
 *   - eplayer.to (original domain)
 *   - hitsplay.fun (slow but reliable)
 *   - codepcplay.fun (was fast, Jan 2026)
 *   - topembed.pw (channel-specific mappings)
 *   - dlhd.link (main site)
 *   - daddylive.me / thedaddy.to (older domains)
 */

const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchUrl(url, referer = 'https://dlhd.link/', timeout = 10000) {
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
      resolve({
        status: 0,
        error: e.message,
        elapsed: Date.now() - start,
        url,
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        error: 'TIMEOUT',
        elapsed: Date.now() - start,
        url,
      });
    });
  });
}

function extractPlayerInfo(html) {
  const info = {};
  
  // Check for EPlayerAuth.init()
  const epaMatch = html.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
  if (epaMatch) {
    info.hasEPlayerAuth = true;
    const initStr = epaMatch[1];
    
    const fields = ['authToken', 'channelKey', 'channelSalt', 'country', 'timestamp'];
    for (const field of fields) {
      const m = initStr.match(new RegExp(`${field}\\s*:\\s*["']([^"']+)["']`));
      if (m) info[field] = field === 'channelSalt' ? m[1].substring(0, 20) + '...' : m[1].substring(0, 60);
      const mNum = initStr.match(new RegExp(`${field}\\s*:\\s*(\\d+)`));
      if (mNum && !m) info[field] = mNum[1];
    }
  }
  
  // Check for JWT tokens
  const jwtMatch = html.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwtMatch) {
    info.hasJWT = true;
    info.jwtPreview = jwtMatch[0].substring(0, 50) + '...';
    // Decode JWT payload
    try {
      const payload = JSON.parse(Buffer.from(jwtMatch[0].split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
      info.jwtPayload = { sub: payload.sub, country: payload.country, exp: payload.exp, iat: payload.iat };
    } catch {}
  }
  
  // Check for iframe embeds
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
  if (iframeMatch) {
    info.iframes = iframeMatch.map(m => {
      const srcMatch = m.match(/src=["']([^"']+)["']/);
      return srcMatch ? srcMatch[1] : null;
    }).filter(Boolean);
  }
  
  // Check for source/video tags
  const sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["']/gi);
  if (sourceMatch) {
    info.sources = sourceMatch.map(m => {
      const srcMatch = m.match(/src=["']([^"']+)["']/);
      return srcMatch ? srcMatch[1] : null;
    }).filter(Boolean);
  }
  
  // Check for m3u8 URLs
  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
  if (m3u8Match) info.m3u8Urls = m3u8Match;
  
  // Check for mono.css (DLHD's M3U8 disguise)
  const monoMatch = html.match(/https?:\/\/[^\s"']+mono\.css[^\s"']*/g);
  if (monoMatch) info.monoCssUrls = monoMatch;
  
  // Check for dvalna.ru references
  const dvalnaMatch = html.match(/dvalna\.ru/g);
  if (dvalnaMatch) info.hasDvalnaRef = true;
  
  // Check for script sources
  const scriptMatch = html.match(/<script[^>]+src=["']([^"']+)["']/gi);
  if (scriptMatch) {
    info.scripts = scriptMatch.map(m => {
      const srcMatch = m.match(/src=["']([^"']+)["']/);
      return srcMatch ? srcMatch[1] : null;
    }).filter(Boolean).slice(0, 5); // Limit to 5
  }
  
  // Check for known player domains in the HTML
  const knownDomains = ['epaly.fun', 'eplayer.to', 'hitsplay.fun', 'codepcplay.fun', 'topembed.pw', 'dvalna.ru', 'moveonjoy', 'lovecdn', 'casthill'];
  info.referencedDomains = knownDomains.filter(d => html.includes(d));
  
  // Check page title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) info.title = titleMatch[1].trim();
  
  // Body size
  info.bodySize = html.length;
  
  return info;
}

async function main() {
  const testChannel = '51'; // ABC USA - commonly available
  const testChannel2 = '44'; // ESPN - popular sports
  
  console.log('='.repeat(80));
  console.log('DLHD FULL RECON - February 2026');
  console.log('='.repeat(80));
  console.log(`Test channels: ${testChannel} (ABC), ${testChannel2} (ESPN)`);
  console.log('');
  
  // =========================================================================
  // PHASE 1: Probe the 6 DLHD folder patterns on dlhd.link
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 1: DLHD Main Site - 6 Folder Patterns');
  console.log('='.repeat(80));
  
  const folders = ['stream', 'cast', 'watch', 'plus', 'casting', 'player'];
  
  for (const folder of folders) {
    const url = `https://dlhd.link/${folder}/stream-${testChannel}.php`;
    console.log(`\n--- ${folder.toUpperCase()} folder: ${url} ---`);
    const result = await fetchUrl(url);
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.redirectUrl) console.log(`  Redirect: ${result.redirectUrl}`);
    if (result.body) {
      const info = extractPlayerInfo(result.body);
      if (Object.keys(info).length > 1) {
        console.log(`  Player info:`, JSON.stringify(info, null, 2).split('\n').map(l => '    ' + l).join('\n'));
      }
    }
  }
  
  // =========================================================================
  // PHASE 2: Probe known player/embed domains
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2: Known Player/Embed Domains');
  console.log('='.repeat(80));
  
  const playerDomains = [
    // premiumtv/daddyhd.php pattern (EPlayerAuth)
    { url: `https://epaly.fun/premiumtv/daddyhd.php?id=${testChannel}`, name: 'epaly.fun (premiumtv)' },
    { url: `https://www.eplayer.to/premiumtv/daddyhd.php?id=${testChannel}`, name: 'eplayer.to (premiumtv)' },
    { url: `https://hitsplay.fun/premiumtv/daddyhd.php?id=${testChannel}`, name: 'hitsplay.fun (premiumtv)' },
    { url: `https://codepcplay.fun/premiumtv/daddyhd.php?id=${testChannel}`, name: 'codepcplay.fun (premiumtv)' },
    
    // daddylive.php pattern (older)
    { url: `https://www.eplayer.to/daddylive.php?live=${testChannel}&vw=100vw&vh=100vh`, name: 'eplayer.to (daddylive)' },
    { url: `https://epaly.fun/daddylive.php?live=${testChannel}&vw=100vw&vh=100vh`, name: 'epaly.fun (daddylive)' },
    
    // topembed.pw pattern
    { url: `https://topembed.pw/channel/AbcTv[USA]`, name: 'topembed.pw (channel)' },
    { url: `https://epaly.fun/channel/AbcTv[USA]`, name: 'epaly.fun (channel)' },
  ];
  
  for (const pd of playerDomains) {
    console.log(`\n--- ${pd.name} ---`);
    console.log(`  URL: ${pd.url}`);
    const result = await fetchUrl(pd.url, 'https://dlhd.link/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.redirectUrl) console.log(`  Redirect: ${result.redirectUrl}`);
    if (result.body && result.status === 200) {
      const info = extractPlayerInfo(result.body);
      console.log(`  Player info:`, JSON.stringify(info, null, 2).split('\n').map(l => '    ' + l).join('\n'));
    }
  }
  
  // =========================================================================
  // PHASE 3: Probe CDN/stream infrastructure
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 3: CDN/Stream Infrastructure');
  console.log('='.repeat(80));
  
  // Test server_lookup endpoint
  const serverLookupUrls = [
    `https://chevy.dvalna.ru/server_lookup?channel_id=premium${testChannel}`,
    `https://chevy.dvalna.ru/server_lookup?channel_id=premium${testChannel2}`,
  ];
  
  for (const url of serverLookupUrls) {
    console.log(`\n--- Server Lookup: ${url} ---`);
    const result = await fetchUrl(url, 'https://epaly.fun/');
    console.log(`  Status: ${result.status} | Size: ${result.body?.length || 0} | Time: ${result.elapsed}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (result.body && result.status === 200) {
      try {
        const data = JSON.parse(result.body);
        console.log(`  Response:`, JSON.stringify(data));
      } catch {
        console.log(`  Body: ${result.body.substring(0, 200)}`);
      }
    }
  }
  
  // Test M3U8 endpoints on different servers
  const servers = ['ddy6', 'zeko', 'wind', 'nfs', 'dokko1', 'wiki'];
  const domains = ['dvalna.ru'];
  
  console.log(`\n--- M3U8 Availability (channel ${testChannel}) ---`);
  for (const server of servers) {
    for (const domain of domains) {
      const m3u8Url = `https://${server}new.${domain}/${server}/premium${testChannel}/mono.css`;
      const result = await fetchUrl(m3u8Url, 'https://epaly.fun/', 5000);
      const isM3U8 = result.body?.includes('#EXTM3U') || result.body?.includes('#EXT-X-');
      const hasKey = result.body?.includes('URI="');
      console.log(`  ${server}.${domain}: status=${result.status} isM3U8=${isM3U8} hasKey=${hasKey} time=${result.elapsed}ms`);
      if (isM3U8 && hasKey) {
        // Extract key URL pattern
        const keyMatch = result.body.match(/URI="([^"]+)"/);
        if (keyMatch) console.log(`    Key URL pattern: ${keyMatch[1].substring(0, 80)}`);
        // Count segments
        const segCount = (result.body.match(/#EXTINF/g) || []).length;
        console.log(`    Segments: ${segCount}`);
      }
    }
  }
  
  // =========================================================================
  // PHASE 4: Test with channel 44 (ESPN) for comparison
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log(`PHASE 4: Channel ${testChannel2} (ESPN) - Cross-check`);
  console.log('='.repeat(80));
  
  const espnResult = await fetchUrl(`https://epaly.fun/premiumtv/daddyhd.php?id=${testChannel2}`, 'https://dlhd.link/');
  console.log(`\nepaly.fun (ESPN): status=${espnResult.status} size=${espnResult.body?.length || 0} time=${espnResult.elapsed}ms`);
  if (espnResult.body && espnResult.status === 200) {
    const info = extractPlayerInfo(espnResult.body);
    console.log(`  Player info:`, JSON.stringify(info, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  }
  
  // =========================================================================
  // PHASE 5: Check for new/unknown domains
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 5: Checking for New/Unknown Domains');
  console.log('='.repeat(80));
  
  // Check if dlhd.link main page reveals any new embed domains
  const mainPage = await fetchUrl('https://dlhd.link/', 'https://www.google.com/');
  if (mainPage.body) {
    // Look for any .fun, .to, .pw domains
    const domainMatches = mainPage.body.match(/https?:\/\/[a-z0-9.-]+\.(fun|to|pw|cfd|xyz|cc|net|live)[^\s"'<>]*/gi);
    if (domainMatches) {
      const uniqueDomains = [...new Set(domainMatches.map(u => {
        try { return new URL(u).hostname; } catch { return null; }
      }).filter(Boolean))];
      console.log(`\nDomains found on dlhd.link main page:`);
      uniqueDomains.forEach(d => console.log(`  - ${d}`));
    }
  }
  
  // Check the watch page for channel 51 to see what embed it uses
  const watchPage = await fetchUrl(`https://dlhd.link/watch/stream-${testChannel}.php`, 'https://dlhd.link/');
  console.log(`\nWatch page (ch${testChannel}): status=${watchPage.status} size=${watchPage.body?.length || 0}`);
  if (watchPage.body) {
    const info = extractPlayerInfo(watchPage.body);
    console.log(`  Player info:`, JSON.stringify(info, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('RECON COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
