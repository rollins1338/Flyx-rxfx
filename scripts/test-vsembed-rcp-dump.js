#!/usr/bin/env node
const RPI = 'https://rpi-proxy.vynx.cc';
const KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function main() {
  const h = JSON.stringify({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html',
    'Referer': 'https://vsembed.ru/',
  });

  // Get embed page
  const r1 = await fetch(`${RPI}/fetch?url=${encodeURIComponent('https://vsembed.ru/embed/movie/550')}&headers=${encodeURIComponent(h)}`, {
    headers: { 'X-API-Key': KEY }, signal: AbortSignal.timeout(10000),
  });
  const html = await r1.text();
  const m = html.match(/src=["']((?:https?:)?\/\/[^"']+\/rcp\/([^"']+))["']/i);
  if (!m) { console.log('No RCP iframe'); return; }
  const rcpHash = m[2];
  const rcpUrl = (m[1].startsWith('//') ? 'https:' : '') + m[1];
  let rcpDomain; try { rcpDomain = new URL(rcpUrl).hostname; } catch { rcpDomain = 'cloudnestra.com'; }
  console.log('RCP domain:', rcpDomain, 'hash:', rcpHash);

  // Try fetching prorcp directly — maybe it doesn't need the Turnstile verification
  const prorcpUrl = `https://${rcpDomain}/prorcp/${rcpHash}`;
  console.log('\nTrying prorcp directly:', prorcpUrl);
  const r3 = await fetch(`${RPI}/fetch-socks5?url=${encodeURIComponent(prorcpUrl)}&headers=${encodeURIComponent(JSON.stringify({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html',
    'Referer': `https://${rcpDomain}/`,
  }))}`, {
    headers: { 'X-API-Key': KEY }, signal: AbortSignal.timeout(15000),
  });
  const prorcp = await r3.text();
  console.log('Prorcp status:', r3.status, 'length:', prorcp.length);
  console.log('Has m3u8:', prorcp.includes('.m3u8'));
  console.log('Has file:', prorcp.includes('file:'));
  console.log('Preview:', prorcp.substring(0, 500));
}

main().catch(e => console.log('Error:', e.message));
