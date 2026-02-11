#!/usr/bin/env node
const RPI = 'https://rpi-proxy.vynx.cc';
const KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function rpi(url, referer) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  if (referer) headers['Referer'] = referer;
  const rpiUrl = `${RPI}/fetch-socks5?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
  const resp = await fetch(rpiUrl, { headers: { 'X-API-Key': KEY }, signal: AbortSignal.timeout(15000) });
  const body = await resp.text();
  const proxy = resp.headers.get('x-socks5-proxy');
  const attempts = resp.headers.get('x-socks5-attempts');
  return { ok: resp.ok, status: resp.status, body, proxy, attempts };
}

async function test(tmdbId, title) {
  console.log(`\n=== ${title} (${tmdbId}) ===`);
  const start = Date.now();

  const embed = await rpi(`https://vidsrc-embed.ru/embed/movie/${tmdbId}`);
  if (!embed.ok) { console.log(`embed FAIL ${embed.status}`); return; }
  const m = embed.body.match(/(?:src=["'])((?:https?:)?\/\/[^"']*\/rcp\/([^"']+))["']/i);
  if (!m) { console.log('No RCP iframe'); return; }
  const rcpUrl = (m[1].startsWith('//') ? 'https:' : '') + m[1];
  let rcpDomain; try { rcpDomain = new URL(rcpUrl).hostname; } catch { rcpDomain = 'cloudnestra.com'; }

  const rcp = await rpi(rcpUrl, `https://vidsrc-embed.ru/`);
  const hasTurnstile = rcp.body.includes('cf-turnstile');
  const pm = rcp.body.match(/(prorcp|srcrcp)\/([A-Za-z0-9+\/=_-]+)/i);
  console.log(`rcp: ${rcp.status} ${rcp.body.length}b turnstile=${hasTurnstile} prorcp=${!!pm} proxy=${rcp.proxy}`);
  if (!pm) { console.log('BLOCKED by Turnstile'); return; }

  const prorcp = await rpi(`https://${rcpDomain}/${pm[1]}/${pm[2]}`, `https://${rcpDomain}/`);
  const fm = prorcp.body.match(/file:\s*["']([^"']+)["']/) || prorcp.body.match(/https?:\/\/[^"'\s]+\.m3u8/);
  if (!fm) { console.log(`prorcp: ${prorcp.status} ${prorcp.body.length}b — no m3u8`); return; }
  
  const ms = Date.now() - start;
  console.log(`✅ ${ms}ms — m3u8 found`);
}

async function main() {
  for (let i = 0; i < 3; i++) {
    console.log(`\n========== RUN ${i+1} ==========`);
    await test(550, 'Fight Club');
    await test(155, 'Dark Knight');
  }
}
main().catch(console.error);
