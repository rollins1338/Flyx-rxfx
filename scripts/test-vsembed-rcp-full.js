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
  const rcpUrl = (m[1].startsWith('//') ? 'https:' : '') + m[1];
  let rcpDomain; try { rcpDomain = new URL(rcpUrl).hostname; } catch { rcpDomain = 'cloudnestra.com'; }

  // Fetch RCP via SOCKS5
  const r2 = await fetch(`${RPI}/fetch-socks5?url=${encodeURIComponent(rcpUrl)}&headers=${encodeURIComponent(h)}`, {
    headers: { 'X-API-Key': KEY }, signal: AbortSignal.timeout(15000),
  });
  const rcp = await r2.text();
  console.log('RCP length:', rcp.length);

  // Search for ANY useful patterns
  const patterns = [
    { name: 'prorcp', regex: /prorcp\/([A-Za-z0-9+\/=\-_]+)/i },
    { name: 'srcrcp', regex: /srcrcp\/([A-Za-z0-9+\/=\-_]+)/i },
    { name: 'file:', regex: /file:\s*["']([^"']+)["']/i },
    { name: 'm3u8', regex: /\.m3u8/i },
    { name: 'turnstile-sitekey', regex: /sitekey['":\s]+['"]([^'"]+)['"]/i },
    { name: 'turnstile-callback', regex: /callback['":\s]+['"]?(\w+)/i },
    { name: 'ajax/post', regex: /\$\.ajax|fetch\(|XMLHttpRequest/i },
    { name: 'token', regex: /token['":\s]+['"]([^'"]+)['"]/i },
    { name: 'recaptcha', regex: /recaptcha/i },
    { name: 'script src', regex: /<script[^>]*src=["']([^"']+)["']/gi },
  ];

  for (const { name, regex } of patterns) {
    const matches = rcp.match(regex);
    if (matches) {
      console.log(`  ${name}: ${matches[0].substring(0, 120)}`);
    }
  }

  // Dump all script tags
  const scripts = [...rcp.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log(`\n${scripts.length} inline scripts:`);
  for (let i = 0; i < scripts.length; i++) {
    const content = scripts[i][1].trim();
    if (content.length > 0) {
      console.log(`  Script ${i} (${content.length} chars): ${content.substring(0, 200)}`);
    }
  }

  // Check if there's a form or POST action
  const forms = [...rcp.matchAll(/<form[^>]*action=["']([^"']+)["'][^>]*>/gi)];
  forms.forEach(f => console.log('  Form action:', f[1]));
}

main().catch(e => console.log('Error:', e.message));
