/**
 * Test: Can the CF Worker fetch MegaCloud CDN directly?
 * The CF Worker has Cloudflare's IP, not our residential IP.
 */

async function main() {
  console.log('=== Test CF Worker direct stream fetch ===\n');

  // First get a fresh HLS URL via local extraction
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  const HIANIME = 'hianimez.to';
  
  const epRes = await fetch(`https://${HIANIME}/ajax/v2/episode/list/18718`, { headers: { 'User-Agent': UA } });
  const epJson = await epRes.json();
  const epMatch = epJson.html.match(/<a[^>]*data-number="1"[^>]*data-id="(\d+)"[^>]*>/);
  
  const srvRes = await fetch(`https://${HIANIME}/ajax/v2/episode/servers?episodeId=${epMatch[1]}`, { headers: { 'User-Agent': UA } });
  const srvJson = await srvRes.json();
  const serverRegex = /<div[\s\S]*?class="[^"]*server-item[^"]*"[\s\S]*?>/g;
  let m, subServerId = null;
  while ((m = serverRegex.exec(srvJson.html)) !== null) {
    const block = m[0];
    if (block.match(/data-type="sub"/) && block.match(/data-server-id="4"/)) {
      subServerId = block.match(/data-id="(\d+)"/)?.[1];
      break;
    }
  }
  
  const srcRes = await fetch(`https://${HIANIME}/ajax/v2/episode/sources?id=${subServerId}`, { headers: { 'User-Agent': UA } });
  const srcJson = await srcRes.json();
  const embedUrl = srcJson.link;
  const sourceId = new URL(embedUrl).pathname.split('/').pop();
  
  // Get sources (unencrypted)
  const embedRes = await fetch(`https://megacloud.blog/embed-2/v3/e-1/${sourceId}`, {
    headers: { 'User-Agent': UA, 'Referer': `https://${HIANIME}/` },
  });
  const embedText = await embedRes.text();
  const regexes = [
    /<meta name="_gg_fb" content="[a-zA-Z0-9]+">/,
    /<!--\s+_is_th:[0-9a-zA-Z]+\s+-->/,
    /<script>window\._lk_db\s+=\s+\{[xyz]:\s+["'][a-zA-Z0-9]+["'],\s+[xyz]:\s+["'][a-zA-Z0-9]+["'],\s+[xyz]:\s+["'][a-zA-Z0-9]+["']\};<\/script>/,
    /<div\s+data-dpi="[0-9a-zA-Z]+"\s+.*><\/div>/,
    /<script nonce="[0-9a-zA-Z]+">/,
    /<script>window\._xy_ws = ['"`][0-9a-zA-Z]+['"`];<\/script>/,
  ];
  const keyRegex = /"[a-zA-Z0-9]+"/;
  const lkDbRegex = [/x:\s+"[a-zA-Z0-9]+"/, /y:\s+"[a-zA-Z0-9]+"/, /z:\s+"[a-zA-Z0-9]+"/];
  let pass = null, count = 0;
  for (let i = 0; i < regexes.length; i++) { pass = embedText.match(regexes[i]); if (pass) { count = i; break; } }
  let ck = '';
  if (count === 2) {
    const x = pass[0].match(lkDbRegex[0]), y = pass[0].match(lkDbRegex[1]), z = pass[0].match(lkDbRegex[2]);
    const p1 = x[0].match(keyRegex), p2 = y[0].match(keyRegex), p3 = z[0].match(keyRegex);
    ck = p1[0].replace(/"/g, '') + p2[0].replace(/"/g, '') + p3[0].replace(/"/g, '');
  } else if (count === 1) {
    const kt = pass[0].match(/:[a-zA-Z0-9]+ /);
    ck = kt[0].replace(/:/g, '').replace(/ /g, '');
  } else {
    const kt = pass[0].match(keyRegex);
    ck = kt[0].replace(/"/g, '');
  }
  
  const getSrcRes = await fetch(`https://megacloud.blog/embed-2/v3/e-1/getSources?id=${sourceId}&_k=${ck}`, {
    headers: { 'User-Agent': UA, 'Referer': embedUrl },
  });
  const getSrcData = await getSrcRes.json();
  const hlsUrl = getSrcData.sources[0].file;
  console.log(`Fresh HLS URL: ${hlsUrl.substring(0, 80)}...\n`);

  // Now test: ask the CF Worker to proxy this URL
  console.log('[1] CF Worker /hianime/stream (routes through RPI then direct)...');
  const cfStreamUrl = `https://media-proxy.vynx.workers.dev/hianime/stream?url=${encodeURIComponent(hlsUrl)}`;
  const cfRes = await fetch(cfStreamUrl, { signal: AbortSignal.timeout(25000) });
  const cfText = await cfRes.text();
  console.log(`   Status: ${cfRes.status}`);
  console.log(`   Content-Type: ${cfRes.headers.get('content-type')}`);
  console.log(`   X-Proxied-Via: ${cfRes.headers.get('x-proxied-via')}`);
  console.log(`   Is m3u8: ${cfText.includes('#EXTM3U')}`);
  console.log(`   Size: ${cfText.length}`);
  if (!cfText.includes('#EXTM3U')) {
    console.log(`   First 300: ${cfText.substring(0, 300)}`);
  }

  // Test 2: Direct from CF Worker (bypass RPI)
  // We can't easily test this without modifying the worker, but we can check
  // if the error response tells us what happened
  
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
