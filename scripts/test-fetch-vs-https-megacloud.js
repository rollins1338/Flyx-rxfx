/**
 * Quick test: fetch() vs https.request() for MegaCloud CDN
 * Proves that fetch() bypasses Cloudflare TLS fingerprinting
 */
const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

// First extract a fresh HLS URL
async function getHlsUrl() {
  const HIANIME = 'hianimez.to';
  // Get episode 1 of Solo Leveling
  const epRes = await fetch(`https://${HIANIME}/ajax/v2/episode/list/18718`, {
    headers: { 'User-Agent': UA },
  });
  const epJson = await epRes.json();
  const epMatch = epJson.html.match(/<a[^>]*data-number="1"[^>]*data-id="(\d+)"[^>]*>/);
  
  const srvRes = await fetch(`https://${HIANIME}/ajax/v2/episode/servers?episodeId=${epMatch[1]}`, {
    headers: { 'User-Agent': UA },
  });
  const srvJson = await srvRes.json();
  const srvMatch = srvJson.html.match(/data-type="sub"[\s\S]*?data-server-id="4"[\s\S]*?data-id="(\d+)"/);
  if (!srvMatch) {
    // Try reverse order
    const srvMatch2 = srvJson.html.match(/data-id="(\d+)"[\s\S]*?data-type="sub"[\s\S]*?data-server-id="4"/);
    if (!srvMatch2) throw new Error('No sub server found');
  }
  
  // Get server list properly
  const serverRegex = /<div[\s\S]*?class="[^"]*server-item[^"]*"[\s\S]*?>/g;
  let m, subServerId = null;
  while ((m = serverRegex.exec(srvJson.html)) !== null) {
    const block = m[0];
    const type = block.match(/data-type="(sub|dub)"/)?.[1];
    const sid = block.match(/data-server-id="(\d+)"/)?.[1];
    const did = block.match(/data-id="(\d+)"/)?.[1];
    if (type === 'sub' && sid === '4') { subServerId = did; break; }
  }
  
  const srcRes = await fetch(`https://${HIANIME}/ajax/v2/episode/sources?id=${subServerId}`, {
    headers: { 'User-Agent': UA },
  });
  const srcJson = await srcRes.json();
  const embedUrl = srcJson.link;
  const sourceId = new URL(embedUrl).pathname.split('/').pop();
  
  // Get client key (simplified)
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
  // Sources are unencrypted in this case
  return getSrcData.sources[0].file;
}

async function main() {
  console.log('=== fetch() vs https.request() for MegaCloud CDN ===\n');
  
  const hlsUrl = await getHlsUrl();
  console.log(`HLS URL: ${hlsUrl.substring(0, 80)}...\n`);
  
  // Test 1: fetch()
  console.log('[1] fetch() ...');
  const fetchRes = await fetch(hlsUrl, { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
  console.log(`   Status: ${fetchRes.status}`);
  const fetchText = await fetchRes.text();
  console.log(`   Is m3u8: ${fetchText.includes('#EXTM3U')}`);
  console.log(`   Size: ${fetchText.length}`);
  
  // Test 2: https.request()
  console.log('\n[2] https.request() ...');
  await new Promise((resolve) => {
    const url = new URL(hlsUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Is m3u8: ${data.includes('#EXTM3U')}`);
        console.log(`   Size: ${data.length}`);
        resolve();
      });
    });
    req.on('error', (e) => { console.log(`   Error: ${e.message}`); resolve(); });
    req.end();
  });
  
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
