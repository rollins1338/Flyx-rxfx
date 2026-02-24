#!/usr/bin/env node
/**
 * Check what servers HiAnime has for a given episode.
 * We need to find if MegaUp appears as a server on HiAnime.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const HI = 'https://hianimez.to';
const HI_AJAX = { 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${HI}/` };

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
}

// Search for bleach
const html = rf(`${HI}/search?keyword=bleach`);
const re = /<a\s[^>]*class="dynamic-name"[^>]*>[^<]*<\/a>/gs;
let m;
while ((m = re.exec(html)) !== null) {
  const href = m[0].match(/href="\/([^"?]+)/)?.[1];
  const title = m[0].match(/title="([^"]*)"/)?.[1];
  const numId = href?.match(/-(\d+)$/)?.[1];
  if (numId) {
    console.log(`${title} → ${href} (id: ${numId})`);
    
    // Get episodes
    const epRaw = rf(`${HI}/ajax/v2/episode/list/${numId}`, 'fetch', HI_AJAX);
    const epHtml = JSON.parse(epRaw).html || '';
    const epRe = /data-number="(\d+)"[^>]*data-id="(\d+)"/g;
    let em;
    const eps = [];
    while ((em = epRe.exec(epHtml)) !== null) eps.push({ num: parseInt(em[1]), id: em[2] });
    
    if (eps.length > 0) {
      const ep = eps[0];
      console.log(`\nEpisode ${ep.num} (id: ${ep.id})`);
      
      // Get ALL servers
      const srvRaw = rf(`${HI}/ajax/v2/episode/servers?episodeId=${ep.id}`, 'fetch', HI_AJAX);
      const srvHtml = JSON.parse(srvRaw).html || '';
      
      // Parse server names too
      console.log('\nRaw server HTML (first 3000 chars):');
      console.log(srvHtml.substring(0, 3000));
      
      const servers = [];
      const srvRe = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*>/gs;
      while ((em = srvRe.exec(srvHtml)) !== null) {
        const b = em[0];
        const dataId = b.match(/data-id="(\d+)"/)?.[1];
        const type = b.match(/data-type="(sub|dub)"/)?.[1];
        const sid = b.match(/data-server-id="(\d+)"/)?.[1];
        if (dataId && type && sid) servers.push({ dataId, type, serverId: sid });
      }
      
      console.log('\nParsed servers:');
      for (const s of servers) {
        console.log(`  type=${s.type} serverId=${s.serverId} dataId=${s.dataId}`);
        
        // Get the embed URL for each server
        try {
          const srcRaw = rf(`${HI}/ajax/v2/episode/sources?id=${s.dataId}`, 'fetch', HI_AJAX);
          const srcData = JSON.parse(srcRaw);
          console.log(`    → link: ${srcData.link?.substring(0, 80)}`);
        } catch (e) {
          console.log(`    → error: ${e.message?.substring(0, 60)}`);
        }
      }
    }
    
    break; // Just check first result
  }
}
