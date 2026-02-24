#!/usr/bin/env node
/**
 * Full anime coverage: HiAnime + AnimeKai × sub + dub × 5 series
 * ALL crypto is native Rust (no enc-dec.app). Everything runs in parallel.
 * 
 * rust-fetch modes used:
 *   fetch         — plain HTTP
 *   megacloud     — MegaCloud embed → decrypt → JSON
 *   megaup        — MegaUp /media/ → decrypt → JSON
 *   kai-encrypt   — AnimeKai substitution cipher encrypt
 *   kai-decrypt   — AnimeKai substitution cipher decrypt
 */

const { execFileSync } = require('child_process');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const HI = 'https://hianimez.to';
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];

let passed = 0, failed = 0, skipped = 0;

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
}

function rfSafe(url, mode = 'fetch', extra = {}) {
  try { return rf(url, mode, extra); }
  catch (err) {
    if (err.stdout?.trim()) return err.stdout.trim();
    throw err;
  }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

function kaiDecrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-decrypt'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}


// ═══════════════════════════════════════════════════════════
// HIANIME PIPELINE
// ═══════════════════════════════════════════════════════════

const HI_AJAX = { 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${HI}/` };

function hiExtract(query, episode = 1) {
  const r = { sub: null, dub: null, animeId: null, error: null };
  try {
    // Search
    const html = rfSafe(`${HI}/search?keyword=${encodeURIComponent(query)}`);
    const results = [];
    const re = /<a\s[^>]*class="dynamic-name"[^>]*>[^<]*<\/a>/gs;
    let m;
    while ((m = re.exec(html)) !== null) {
      const href = m[0].match(/href="\/([^"?]+)/)?.[1];
      const title = m[0].match(/title="([^"]*)"/)?.[1];
      if (href) {
        const numId = href.match(/-(\d+)$/)?.[1];
        if (numId) results.push({ slug: href, title: title || '', numId });
      }
    }
    if (!results.length) { r.error = 'no search results'; return r; }

    const qLow = query.toLowerCase();
    const best = results.find(x => x.title.toLowerCase() === qLow) || results[0];
    r.animeId = best.numId;

    // Episodes
    const epRaw = rfSafe(`${HI}/ajax/v2/episode/list/${best.numId}`, 'fetch', HI_AJAX);
    const epHtml = JSON.parse(epRaw).html || '';
    const eps = [];
    const epRe = /data-number="(\d+)"[^>]*data-id="(\d+)"/g;
    while ((m = epRe.exec(epHtml)) !== null) eps.push({ num: parseInt(m[1]), id: m[2] });
    const ep = eps.find(e => e.num === episode) || eps[0];
    if (!ep) { r.error = 'no episodes'; return r; }

    // Servers
    const srvRaw = rfSafe(`${HI}/ajax/v2/episode/servers?episodeId=${ep.id}`, 'fetch', HI_AJAX);
    const srvHtml = JSON.parse(srvRaw).html || '';
    const servers = [];
    const srvRe = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*>/gs;
    while ((m = srvRe.exec(srvHtml)) !== null) {
      const b = m[0];
      const dataId = b.match(/data-id="(\d+)"/)?.[1];
      const type = b.match(/data-type="(sub|dub)"/)?.[1];
      const sid = b.match(/data-server-id="(\d+)"/)?.[1];
      if (dataId && type && sid) servers.push({ dataId, type, serverId: sid });
    }

    // Sub + Dub
    for (const type of ['sub', 'dub']) {
      const srv = servers.find(s => s.type === type && s.serverId === '4') || servers.find(s => s.type === type);
      if (!srv) continue;
      try {
        const srcRaw = rfSafe(`${HI}/ajax/v2/episode/sources?id=${srv.dataId}`, 'fetch', HI_AJAX);
        const embedUrl = JSON.parse(srcRaw).link;
        if (!embedUrl) continue;
        const data = JSON.parse(rfSafe(embedUrl, 'megacloud', { 'Referer': `${HI}/` }));
        const stream = data.sources?.[0]?.file || '';
        if (stream.includes('.m3u8')) {
          const sourceId = embedUrl.split('/').pop()?.split('?')[0] || '?';
          r[type] = { stream: stream.substring(0, 70), sourceId };
        }
      } catch {}
    }
  } catch (e) { r.error = e.message?.substring(0, 100); }
  return r;
}


// ═══════════════════════════════════════════════════════════
// ANIMEKAI PIPELINE
// ═══════════════════════════════════════════════════════════

const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rfSafe(`${domain}${urlPath}`, 'fetch', { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

function kaiExtract(query, episode = 1) {
  const r = { sub: null, dub: null, contentId: null, error: null };
  try {
    // 1. Search
    const searchData = kaiFetch(`/ajax/anime/search?keyword=${encodeURIComponent(query)}`);
    if (!searchData?.result?.html) { r.error = 'no search results'; return r; }
    const searchHtml = searchData.result.html;

    // Parse results: <a href="/watch/slug">...<h6 class="title">Name</h6>
    const slugRe = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
    const results = [];
    let m;
    while ((m = slugRe.exec(searchHtml)) !== null) {
      results.push({ slug: m[1], title: m[2].trim() });
    }
    if (!results.length) { r.error = 'no results parsed'; return r; }

    // Pick best match
    const qLow = query.toLowerCase();
    const best = results.find(x => x.title.toLowerCase() === qLow) || results[0];

    // 2. Fetch watch page to get anime_id from syncData
    let contentId = null;
    for (const domain of KAI_DOMAINS) {
      try {
        const watchHtml = rfSafe(`${domain}/watch/${best.slug}`, 'fetch', { 'Referer': `${domain}/` });
        const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
        if (syncMatch) {
          const sync = JSON.parse(syncMatch[1]);
          contentId = sync.anime_id;
          break;
        }
      } catch {}
    }
    if (!contentId) { r.error = 'no content_id'; return r; }
    r.contentId = contentId;

    // 3. Get episodes (encrypt content_id natively)
    const encId = kaiEncrypt(contentId);
    const epData = kaiFetch(`/ajax/episodes/list?ani_id=${contentId}&_=${encId}`);
    if (!epData?.result) { r.error = 'no episodes'; return r; }

    // Parse episodes: <a num="1" token="xxx">
    const epRe = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"/gi;
    const episodes = {};
    while ((m = epRe.exec(epData.result)) !== null) episodes[m[1]] = m[2];
    // Also reversed attr order
    const epRe2 = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"/gi;
    while ((m = epRe2.exec(epData.result)) !== null) { if (!episodes[m[2]]) episodes[m[2]] = m[1]; }

    const token = episodes[String(episode)];
    if (!token) { r.error = `ep ${episode} not found (have: ${Object.keys(episodes).slice(0,5).join(',')})`; return r; }

    // 4. Get servers (encrypt token natively)
    const encToken = kaiEncrypt(token);
    const srvData = kaiFetch(`/ajax/links/list?token=${token}&_=${encToken}`);
    if (!srvData?.result) { r.error = 'no servers'; return r; }

    // Parse servers: <div data-id="sub|dub">...<span class="server" data-lid="xxx">
    for (const type of ['sub', 'dub']) {
      const secMatch = srvData.result.match(new RegExp(`<div[^>]*data-id="${type}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'));
      if (!secMatch) continue;
      const lidMatch = secMatch[1].match(/data-lid="([^"]+)"/);
      if (!lidMatch) continue;
      const lid = lidMatch[1];

      // 5. Get embed (encrypt lid, decrypt response)
      try {
        const encLid = kaiEncrypt(lid);
        const embedData = kaiFetch(`/ajax/links/view?id=${lid}&_=${encLid}`);
        if (!embedData?.result) continue;

        // Decrypt the embed response
        let decrypted = kaiDecrypt(embedData.result);
        // Decode }XX hex encoding
        decrypted = decrypted.replace(/\}([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

        let embedUrl = '';
        try {
          const parsed = JSON.parse(decrypted);
          embedUrl = parsed.url || '';
        } catch {
          if (decrypted.startsWith('http')) embedUrl = decrypted;
        }

        if (embedUrl && embedUrl.includes('/e/')) {
          // MegaUp embed — decrypt via rust-fetch megaup mode
          try {
            const megaupData = JSON.parse(rfSafe(embedUrl, 'megaup'));
            const stream = megaupData.sources?.[0]?.file || '';
            if (stream.includes('.m3u8')) {
              r[type] = { stream: stream.substring(0, 70), embedUrl: embedUrl.substring(0, 50) };
            }
          } catch {}
        } else if (embedUrl.includes('.m3u8')) {
          r[type] = { stream: embedUrl.substring(0, 70) };
        }
      } catch {}
    }
  } catch (e) { r.error = e.message?.substring(0, 100); }
  return r;
}


// ═══════════════════════════════════════════════════════════
// PARALLEL EXECUTION
// ═══════════════════════════════════════════════════════════

const SERIES = [
  { name: 'Black Butler',   query: 'black butler',   episode: 1 },
  { name: 'Jujutsu Kaisen', query: 'jujutsu kaisen', episode: 1 },
  { name: 'Dragon Ball Z',  query: 'dragon ball z',  episode: 1 },
  { name: 'One Piece',      query: 'one piece',      episode: 1 },
  { name: 'Bleach',         query: 'bleach',          episode: 1 },
];

async function main() {
  console.log('Full Anime Coverage Test — rust-fetch v0.3 (all native)');
  console.log(`${SERIES.length} series × 2 providers × sub+dub = ${SERIES.length * 4} max streams\n`);

  const startTime = Date.now();

  // Run ALL series × ALL providers in parallel
  const tasks = SERIES.flatMap(s => [
    { series: s.name, provider: 'HiAnime',  fn: () => hiExtract(s.query, s.episode) },
    { series: s.name, provider: 'AnimeKai', fn: () => kaiExtract(s.query, s.episode) },
  ]);

  const results = await Promise.allSettled(
    tasks.map(t => new Promise((resolve) => {
      try { resolve({ ...t, result: t.fn() }); }
      catch (e) { resolve({ ...t, result: { sub: null, dub: null, error: e.message } }); }
    }))
  );

  // Organize results
  const grid = {}; // grid[series][provider] = { sub, dub, ... }
  for (const r of results) {
    const { series, provider, result } = r.value;
    if (!grid[series]) grid[series] = {};
    grid[series][provider] = result;
  }

  // Print results
  for (const s of SERIES) {
    console.log(`\n${'━'.repeat(70)}`);
    console.log(`  ${s.name}`);
    console.log('━'.repeat(70));

    for (const prov of ['HiAnime', 'AnimeKai']) {
      const r = grid[s.name]?.[prov] || { error: 'not run' };
      const id = r.animeId || r.contentId || '?';
      console.log(`  [${prov}] ID: ${id}`);

      if (r.error) {
        console.log(`    ✗ Error: ${r.error}`);
        failed++;
      }

      for (const type of ['sub', 'dub']) {
        if (r[type]) {
          console.log(`    ✓ ${type.toUpperCase()}: ${r[type].stream}...`);
          passed++;
        } else if (!r.error) {
          console.log(`    ⊘ ${type.toUpperCase()}: not available`);
          skipped++;
        }
      }
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(70)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(70));
  console.log('  Series               HiAnime          AnimeKai');
  console.log('  ' + '─'.repeat(55));
  for (const s of SERIES) {
    const hi = grid[s.name]?.HiAnime || {};
    const kai = grid[s.name]?.AnimeKai || {};
    const hiSub = hi.sub ? '✓' : (hi.error ? '✗' : '⊘');
    const hiDub = hi.dub ? '✓' : (hi.error ? '✗' : '⊘');
    const kaiSub = kai.sub ? '✓' : (kai.error ? '✗' : '⊘');
    const kaiDub = kai.dub ? '✓' : (kai.error ? '✗' : '⊘');
    console.log(`  ${s.name.padEnd(20)} sub:${hiSub} dub:${hiDub}        sub:${kaiSub} dub:${kaiDub}`);
  }
  console.log(`\n  ${passed} passed · ${failed} failed · ${skipped} skipped · ${elapsed}s`);
  console.log('═'.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
