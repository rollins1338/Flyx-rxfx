#!/usr/bin/env node
/**
 * End-to-end anime sub+dub validation via rust-fetch all-in-one binary.
 * Tests: HiAnime (MegaCloud decrypt) + AnimeKai (MegaUp decrypt)
 */

const { execFileSync } = require('child_process');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

let passed = 0, failed = 0, skipped = 0;
function ok(l) { passed++; console.log(`  ✓ ${l}`); }
function fail(l, d) { failed++; console.log(`  ✗ ${l}: ${d}`); }
function skip(l, d) { skipped++; console.log(`  ⊘ ${l}: ${d}`); }
function section(t) { console.log(`\n${'─'.repeat(60)}\n  ${t}\n${'─'.repeat(60)}`); }

function rf(url, mode = 'fetch', extraHeaders = {}) {
  const hdrs = { 'User-Agent': CHROME_UA, ...extraHeaders };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, { encoding: 'utf8', timeout: 25000, windowsHide: true }).trim();
  } catch (err) {
    if (err.stdout && err.stdout.trim().length > 0) return err.stdout.trim();
    throw new Error(err.stderr?.substring(0, 300) || err.message);
  }
}

// ── HiAnime: full sub+dub pipeline ─────────────────────

async function testHiAnime() {
  section('HiAnime — One Piece Ep1 (sub + dub → MegaCloud decrypt)');

  // 1. Search
  let searchHtml;
  try {
    searchHtml = rf('https://hianimez.to/search?keyword=one+piece');
    if (!searchHtml.includes('data-id=')) { fail('Search', 'no results'); return; }
    ok('Search OK');
  } catch (e) { fail('Search', e.message); return; }

  const animeId = searchHtml.match(/data-id="(\d+)"/)?.[1];
  if (!animeId) { fail('Anime ID', 'not found'); return; }

  // 2. Episodes
  let epHtml;
  try {
    const raw = rf(`https://hianimez.to/ajax/v2/episode/list/${animeId}`, 'fetch', {
      'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/',
    });
    epHtml = JSON.parse(raw).html;
    if (!epHtml?.includes('data-id=')) { fail('Episodes', 'empty'); return; }
    ok('Episodes loaded');
  } catch (e) { fail('Episodes', e.message); return; }

  const episodeId = epHtml.match(/data-id="(\d+)"/)?.[1];

  // 3. Servers
  let serverHtml;
  try {
    const raw = rf(`https://hianimez.to/ajax/v2/episode/servers?episodeId=${episodeId}`, 'fetch', {
      'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/',
    });
    serverHtml = JSON.parse(raw).html || '';
  } catch (e) { fail('Servers', e.message); return; }

  const hasSub = serverHtml.includes('data-type="sub"');
  const hasDub = serverHtml.includes('data-type="dub"');
  if (hasSub) ok('SUB servers present');
  else fail('SUB servers', 'missing');
  if (hasDub) ok('DUB servers present');
  else skip('DUB servers', 'not available');

  // 4. Get embed URLs for sub + dub
  for (const type of ['sub', 'dub']) {
    const match = serverHtml.match(new RegExp(`data-type="${type}"[^>]*data-id="(\\d+)"`));
    if (!match) { skip(`${type.toUpperCase()} source`, 'no server'); continue; }

    let embedUrl;
    try {
      const raw = rf(`https://hianimez.to/ajax/v2/episode/sources?id=${match[1]}`, 'fetch', {
        'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/',
      });
      embedUrl = JSON.parse(raw).link;
      if (!embedUrl) { fail(`${type.toUpperCase()} embed`, 'no link'); continue; }
      ok(`${type.toUpperCase()} embed: ${embedUrl.substring(0, 55)}...`);
    } catch (e) { fail(`${type.toUpperCase()} embed`, e.message); continue; }

    // 5. MegaCloud decrypt via rust-fetch --mode megacloud
    try {
      const result = rf(embedUrl, 'megacloud', { 'Referer': 'https://hianimez.to/' });
      const data = JSON.parse(result);
      const streamUrl = data.sources?.[0]?.file || '';
      const trackCount = (data.tracks || []).filter(t => t.kind === 'captions').length;
      if (streamUrl.includes('.m3u8')) {
        ok(`${type.toUpperCase()} STREAM: ${streamUrl.substring(0, 65)}...`);
        ok(`${type.toUpperCase()} ${trackCount} subtitle tracks, intro=${JSON.stringify(data.intro)}`);
      } else {
        fail(`${type.toUpperCase()} stream`, 'no .m3u8');
      }
    } catch (e) { fail(`${type.toUpperCase()} MegaCloud decrypt`, e.message); }
  }
}

// ── AnimeKai: MegaUp decrypt ────────────────────────────

async function testAnimeKaiMegaUp() {
  section('AnimeKai — MegaUp decrypt (Gachiakuta + Naruto)');

  const tests = [
    { name: 'Gachiakuta', url: 'https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCQ' },
    { name: 'Naruto', url: 'https://megaup22.online/e/k5OoeWapWS2JcOLzF79O5xvpCQ' },
  ];

  for (const t of tests) {
    try {
      const result = rf(t.url, 'megaup', { 'User-Agent': MEGAUP_UA });
      const data = JSON.parse(result);
      const streamUrl = data.sources?.[0]?.file || '';
      if (streamUrl.includes('.m3u8')) {
        ok(`${t.name}: ${streamUrl.substring(0, 70)}...`);
      } else {
        fail(t.name, 'no .m3u8 in result');
      }
    } catch (e) { fail(t.name, e.message); }
  }
}

// ── AnimeKai: search + watch page ───────────────────────

async function testAnimeKaiSearch() {
  section('AnimeKai — search + content discovery');

  try {
    const raw = rf('https://animekai.to/ajax/anime/search?keyword=naruto', 'fetch', {
      'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://animekai.to/',
    });
    const data = JSON.parse(raw);
    if (data.result?.html?.includes('href=')) ok('Search OK');
    else fail('Search', 'no results');
  } catch (e) { fail('Search', e.message); }

  try {
    const html = rf('https://animekai.to/watch/naruto-9r5k', 'fetch', {
      'Referer': 'https://animekai.to/',
    });
    if (html.includes('data-id=')) ok('Watch page loaded');
    else fail('Watch page', 'no data-id');
  } catch (e) { fail('Watch page', e.message); }
}

// ── Binary stats ────────────────────────────────────────

function checkBinary() {
  section('Binary stats');
  const fs = require('fs');
  const size = fs.statSync(RUST).size;
  console.log(`  Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
  if (size < 5 * 1024 * 1024) ok('Under 5MB');
  else fail('Size', `${(size/1024/1024).toFixed(1)}MB too large`);

  const start = performance.now();
  rf('https://httpbin.org/status/200');
  const ms = (performance.now() - start).toFixed(0);
  console.log(`  Cold start + fetch: ${ms}ms`);
  if (parseInt(ms) < 3000) ok(`Speed OK (${ms}ms)`);
  else fail('Speed', `${ms}ms`);
}

// ── main ────────────────────────────────────────────────

async function main() {
  console.log('rust-fetch v0.2 — All-in-one anime extraction test\n');

  checkBinary();
  await testHiAnime();
  await testAnimeKaiMegaUp();
  await testAnimeKaiSearch();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log('═'.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
