#!/usr/bin/env node
const RPI = 'https://rpi-proxy.vynx.cc';
const KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function main() {
  const h = JSON.stringify({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  });

  // Step 1: Get embed page via residential IP
  console.log('Step 1: Fetching vsembed.ru embed page...');
  const r1 = await fetch(`${RPI}/fetch?url=${encodeURIComponent('https://vsembed.ru/embed/movie/550')}&headers=${encodeURIComponent(h)}`, {
    headers: { 'X-API-Key': KEY },
    signal: AbortSignal.timeout(10000),
  });
  const html = await r1.text();
  console.log(`  Status: ${r1.status}, Length: ${html.length}`);

  // Find RCP iframe
  const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']*\/rcp\/([^"']+))["']/i)
    || html.match(/src=["']((?:https?:)?\/\/[^"']+\/rcp\/([^"']+))["']/i);

  if (!iframeMatch) {
    console.log('  No RCP iframe found');
    const iframes = [...html.matchAll(/iframe[^>]*src=["']([^"']+)["']/gi)];
    iframes.forEach(m => console.log('  iframe:', m[1].substring(0, 100)));
    console.log('  Page preview:', html.substring(0, 500));
    return;
  }

  const rcpFullUrl = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
  const rcpHash = iframeMatch[2];
  let rcpDomain = 'cloudnestra.com';
  try { rcpDomain = new URL(rcpFullUrl).hostname; } catch {}
  console.log(`  RCP: ${rcpDomain} hash: ${rcpHash.substring(0, 40)}...`);

  // Step 2: Fetch RCP via SOCKS5
  const rcpUrl = `https://${rcpDomain}/rcp/${rcpHash}`;
  const rcpHeaders = JSON.stringify({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://vsembed.ru/',
    'Origin': 'https://vsembed.ru',
  });

  console.log('\nStep 2: Fetching RCP via SOCKS5...');
  const r2 = await fetch(`${RPI}/fetch-socks5?url=${encodeURIComponent(rcpUrl)}&headers=${encodeURIComponent(rcpHeaders)}`, {
    headers: { 'X-API-Key': KEY },
    signal: AbortSignal.timeout(15000),
  });
  const rcpHtml = await r2.text();
  console.log(`  Status: ${r2.status}, Length: ${rcpHtml.length}`);
  console.log(`  Proxy: ${r2.headers.get('x-socks5-proxy')}, Attempts: ${r2.headers.get('x-socks5-attempts')}`);
  console.log(`  Has cf-turnstile: ${rcpHtml.includes('cf-turnstile')}`);
  console.log(`  Has challenges.cloudflare: ${rcpHtml.includes('challenges.cloudflare.com')}`);
  console.log(`  Has prorcp: ${rcpHtml.includes('prorcp')}`);
  console.log(`  Has srcrcp: ${rcpHtml.includes('srcrcp')}`);
  console.log(`  Preview: ${rcpHtml.substring(0, 600)}`);
}

main().catch(e => console.log('Error:', e.message));
