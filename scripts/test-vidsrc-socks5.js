#!/usr/bin/env node
/**
 * Test VidSrc extraction via SOCKS5 proxy - step by step
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function fetchViaSocks5(url, referer) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (referer) {
    headers['Referer'] = referer;
    try { headers['Origin'] = new URL(referer).origin; } catch {}
  }

  const rpiUrl = `${RPI_URL}/fetch-socks5?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
  const resp = await fetch(rpiUrl, {
    headers: { 'X-API-Key': RPI_KEY },
    signal: AbortSignal.timeout(20000),
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body, proxy: resp.headers.get('x-socks5-proxy'), attempts: resp.headers.get('x-socks5-attempts') };
}

async function testMovie(tmdbId, title) {
  console.log(`\n=== Testing: ${title} (TMDB ${tmdbId}) ===`);
  const start = Date.now();

  // Step 1: Fetch embed page
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  console.log(`Step 1: Fetching ${embedUrl}`);
  const embedResp = await fetchViaSocks5(embedUrl);
  console.log(`  Status: ${embedResp.status}, Length: ${embedResp.body.length}, Proxy: ${embedResp.proxy}, Attempts: ${embedResp.attempts}`);

  if (!embedResp.ok) {
    console.log(`  FAILED: ${embedResp.body.substring(0, 200)}`);
    return;
  }

  // Step 2: Extract RCP iframe
  const iframeMatch = embedResp.body.match(/<iframe[^>]*src=["']([^"']*\/rcp\/([^"']+))["']/i)
    || embedResp.body.match(/src=["']((?:https?:)?\/\/[^"']+\/rcp\/([^"']+))["']/i);

  if (!iframeMatch) {
    console.log('  No RCP iframe found');
    // Check what iframes exist
    const iframes = [...embedResp.body.matchAll(/iframe[^>]*src=["']([^"']+)["']/gi)];
    iframes.forEach(m => console.log(`  iframe: ${m[1].substring(0, 100)}`));
    return;
  }

  const rcpFullUrl = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
  const rcpHash = iframeMatch[2];
  let rcpDomain = 'cloudnestra.com';
  try { rcpDomain = new URL(rcpFullUrl).hostname; } catch {}
  console.log(`Step 2: Found RCP on ${rcpDomain} (hash: ${rcpHash.substring(0, 40)}...)`);

  // Step 3: Fetch RCP page
  const rcpUrl = `https://${rcpDomain}/rcp/${rcpHash}`;
  console.log(`Step 3: Fetching RCP page`);
  const rcpResp = await fetchViaSocks5(rcpUrl, `https://vidsrc-embed.ru/`);
  console.log(`  Status: ${rcpResp.status}, Length: ${rcpResp.body.length}, Proxy: ${rcpResp.proxy}`);

  if (!rcpResp.ok) {
    console.log(`  FAILED: ${rcpResp.body.substring(0, 200)}`);
    return;
  }

  if (rcpResp.body.includes('cf-turnstile') || rcpResp.body.includes('challenges.cloudflare.com')) {
    console.log('  ⚠️ TURNSTILE DETECTED');
  }

  // Step 4: Extract prorcp/srcrcp
  const patterns = [
    { regex: /src:\s*['"]\/prorcp\/([^'"]+)['"]/i, type: 'prorcp' },
    { regex: /src:\s*['"]\/srcrcp\/([^'"]+)['"]/i, type: 'srcrcp' },
    { regex: /['"]\/prorcp\/([A-Za-z0-9+\/=\-_]+)['"]/i, type: 'prorcp' },
    { regex: /['"]\/srcrcp\/([A-Za-z0-9+\/=\-_]+)['"]/i, type: 'srcrcp' },
    { regex: /prorcp\/([A-Za-z0-9+\/=\-_]+)/i, type: 'prorcp' },
    { regex: /srcrcp\/([A-Za-z0-9+\/=\-_]+)/i, type: 'srcrcp' },
  ];

  let endpointPath = null, endpointType = 'prorcp';
  for (const { regex, type } of patterns) {
    const m = rcpResp.body.match(regex);
    if (m) { endpointPath = m[1]; endpointType = type; break; }
  }

  if (!endpointPath) {
    console.log('  No prorcp/srcrcp found in RCP page');
    console.log('  Page preview:', rcpResp.body.substring(0, 500));
    return;
  }
  console.log(`Step 4: Found ${endpointType} (${endpointPath.substring(0, 40)}...)`);

  // Step 5: Fetch prorcp page
  const prorcpUrl = `https://${rcpDomain}/${endpointType}/${endpointPath}`;
  console.log(`Step 5: Fetching ${endpointType} page`);
  const prorcpResp = await fetchViaSocks5(prorcpUrl, `https://${rcpDomain}/`);
  console.log(`  Status: ${prorcpResp.status}, Length: ${prorcpResp.body.length}, Proxy: ${prorcpResp.proxy}`);

  if (!prorcpResp.ok) {
    console.log(`  FAILED: ${prorcpResp.body.substring(0, 200)}`);
    return;
  }

  // Step 6: Extract m3u8 URL
  const filePatterns = [
    /file:\s*["']([^"']+)["']/,
    /file\s*=\s*["']([^"']+)["']/,
    /"file"\s*:\s*"([^"]+)"/,
    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/,
    /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
  ];

  let fileUrl = null;
  for (const pat of filePatterns) {
    const m = prorcpResp.body.match(pat);
    if (m?.[1]) { fileUrl = m[1]; break; }
  }
  if (!fileUrl) {
    const m3u8Match = prorcpResp.body.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
    if (m3u8Match) fileUrl = m3u8Match[0];
  }

  if (!fileUrl) {
    console.log('  No file URL found');
    console.log('  Page preview:', prorcpResp.body.substring(0, 500));
    return;
  }

  const elapsed = Date.now() - start;
  console.log(`\n✅ SUCCESS in ${elapsed}ms`);
  
  // Parse alternatives
  const alts = fileUrl.split(' or ');
  console.log(`  ${alts.length} URL alternatives`);
  
  const cdnDomains = ['cloudnestra.com', 'cloudnestra.net', 'shadowlandschronicles.com', 'embedsito.com'];
  for (const alt of alts.slice(0, 3)) {
    if (alt.includes('{v')) {
      const resolved = alt.replace(/\{v\d+\}/g, cdnDomains[0]);
      console.log(`  → ${resolved.substring(0, 120)}...`);
    } else if (alt.includes('.m3u8')) {
      console.log(`  → ${alt.substring(0, 120)}...`);
    }
  }
}

async function main() {
  console.log('Testing VidSrc extraction via SOCKS5 proxy pool\n');
  
  await testMovie(550, 'Fight Club');
  await testMovie(157336, 'Interstellar');
  await testMovie(680, 'Pulp Fiction');
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
