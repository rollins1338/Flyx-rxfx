#!/usr/bin/env node
/**
 * Test the PRODUCTION AnimeKai flow:
 * 1. AnimeKai search → episodes → servers → encrypted embed (local)
 * 2. Send encrypted embed to RPI /animekai/extract (production path)
 * 3. RPI decrypts AnimeKai, fetches MegaUp, decrypts via enc-dec.app, returns stream URL
 * 4. Verify stream URL works
 * 
 * Also tests the LOCAL fallback path (enc-dec.app directly from this machine)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const RPI_BASE = 'https://rpi-proxy.vynx.cc';
const CF_WORKER = 'https://media-proxy.vynx.workers.dev';

let TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rpi-proxy', 'animekai-tables.json'), 'utf8'));

// --- Crypto helpers (same as before) ---
function urlSafeBase64Decode(str) { return Buffer.from(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4),'base64'); }
function urlSafeBase64Encode(buf) { return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function getCipherPosition(i) { return [0,7,11,13,15,17,19][i]??(20+(i-7)); }
function decryptAnimeKai(ct) {
  const c=urlSafeBase64Decode(ct),off=c.length>21?21:0,dLen=c.length-off;
  let pLen=0; if(dLen>20)pLen=7+(dLen-20);else if(dLen>19)pLen=7;else if(dLen>17)pLen=6;
  else if(dLen>15)pLen=5;else if(dLen>13)pLen=4;else if(dLen>11)pLen=3;else if(dLen>7)pLen=2;else if(dLen>0)pLen=1;
  let p=''; for(let i=0;i<pLen;i++){const pos=off+getCipherPosition(i);if(pos>=c.length)break;const b=c[pos];const t=TABLES[i];p+=(t&&b in t)?t[b]:String.fromCharCode(b);}return p;
}
function encryptAnimeKai(pt) {
  const enc={}; for(const[p,t]of Object.entries(TABLES)){enc[p]={};for(const[b,c]of Object.entries(t))enc[p][c]=parseInt(b);}
  const CB={1:0xf2,2:0xdf,3:0x9b,4:0x9d,5:0x16,6:0xe5,8:0x67,9:0xc9,10:0xdd,12:0x9c,14:0x29,16:0x35,18:0xc8};
  const H=Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa','hex');
  const pLen=pt.length;let cLen;if(pLen<=1)cLen=1;else if(pLen<=2)cLen=8;else if(pLen<=3)cLen=12;
  else if(pLen<=4)cLen=14;else if(pLen<=5)cLen=16;else if(pLen<=6)cLen=18;else if(pLen<=7)cLen=20;else cLen=20+(pLen-7);
  const c=Buffer.alloc(21+cLen);H.copy(c,0);for(const[p,b]of Object.entries(CB)){const i=21+parseInt(p);if(i<c.length)c[i]=b;}
  for(let i=0;i<pLen;i++){const ch=pt[i];const cp=getCipherPosition(i);const t=enc[i];c[21+cp]=(t&&ch in t)?t[ch]:ch.charCodeAt(0);}
  return urlSafeBase64Encode(c);
}
function decodeHex(s) { return s.replace(/}([0-9A-Fa-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16))); }

async function fetchKai(p) {
  for (const d of ['https://animekai.to','https://anikai.to']) {
    try { const r=await fetch(`${d}${p}`,{headers:{'User-Agent':UA,'Accept':'*/*','Referer':'https://animekai.to/','X-Requested-With':'XMLHttpRequest'},signal:AbortSignal.timeout(10000)});if(r.ok)return await r.json();} catch{}
  }
  return null;
}

async function main() {
  console.log('=== ANIMEKAI PRODUCTION FLOW TEST ===\n');
  
  const query = process.argv[2] || 'One Piece';
  const ep = parseInt(process.argv[3] || '1');
  console.log(`Search: "${query}", Episode: ${ep}\n`);

  // Get encrypted embed
  console.log('[1] Getting encrypted embed from AnimeKai...');
  const s = await fetchKai(`/ajax/anime/search?keyword=${encodeURIComponent(query)}`);
  if (!s?.result?.html) { console.log('  ✗ No results'); return; }
  const m = s.result.html.match(/<a[^>]*href="\/watch\/([^"]+)"/);
  if (!m) { console.log('  ✗ No anime link'); return; }
  
  const wr = await fetch(`https://animekai.to/watch/${m[1]}`, { headers:{'User-Agent':UA}, signal:AbortSignal.timeout(10000) });
  const wh = await wr.text();
  const sm = wh.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  if (!sm) { console.log('  ✗ No syncData'); return; }
  const sd = JSON.parse(sm[1]);
  
  const eData = await fetchKai(`/ajax/episodes/list?ani_id=${sd.anime_id}&_=${encryptAnimeKai(sd.anime_id)}`);
  if (!eData?.result) { console.log('  ✗ No episodes'); return; }
  const eps = {};
  let mm;
  const r1 = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
  while ((mm = r1.exec(eData.result)) !== null) eps[mm[1]] = mm[2];
  const r2 = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"[^>]*>/gi;
  while ((mm = r2.exec(eData.result)) !== null) if (!eps[mm[2]]) eps[mm[2]] = mm[1];
  if (!eps[ep]) { console.log(`  ✗ Ep ${ep} not found`); return; }
  
  const sData = await fetchKai(`/ajax/links/list?token=${eps[ep]}&_=${encryptAnimeKai(eps[ep])}`);
  if (!sData?.result) { console.log('  ✗ No servers'); return; }
  const sm2 = sData.result.match(/<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>/);
  if (!sm2) { console.log('  ✗ No server lid'); return; }
  
  const eData2 = await fetchKai(`/ajax/links/view?id=${sm2[1]}&_=${encryptAnimeKai(sm2[1])}`);
  if (!eData2?.result) { console.log('  ✗ No embed'); return; }
  
  const encryptedEmbed = eData2.result;
  console.log(`  ✓ Got encrypted embed (${encryptedEmbed.length} chars)`);
  
  // Verify local decrypt works
  const dec = decodeHex(decryptAnimeKai(encryptedEmbed));
  let ej; try { ej = JSON.parse(dec); } catch { console.log('  ✗ Local decrypt failed'); return; }
  console.log(`  Local decrypt → embed URL: ${ej.url}`);

  // ============================================================
  // TEST 1: RPI /animekai/extract endpoint (production path)
  // ============================================================
  console.log('\n[2] Testing RPI /animekai/extract (PRODUCTION PATH)...');
  const rpiExtractUrl = `${RPI_BASE}/animekai/extract?embed=${encodeURIComponent(encryptedEmbed)}&key=${RPI_KEY}`;
  try {
    const rpiRes = await fetch(rpiExtractUrl, { signal: AbortSignal.timeout(25000) });
    console.log(`  RPI status: ${rpiRes.status}`);
    const rpiData = await rpiRes.json();
    
    if (rpiData.success && rpiData.streamUrl) {
      console.log(`  ✓✓✓ RPI EXTRACTION WORKS!`);
      console.log(`  Stream URL: ${rpiData.streamUrl.substring(0, 100)}`);
      if (rpiData.skip) console.log(`  Skip data: ${JSON.stringify(rpiData.skip)}`);
      
      // Verify stream
      console.log('\n  Verifying stream...');
      const streamRes = await fetch(rpiData.streamUrl, { headers:{'User-Agent':MEGAUP_UA}, signal:AbortSignal.timeout(10000) });
      console.log(`  Stream status: ${streamRes.status}`);
      if (streamRes.ok) {
        const text = await streamRes.text();
        if (text.includes('#EXTM3U')) console.log(`  ✓✓✓ VALID M3U8! Size: ${text.length}`);
        else console.log(`  Content: ${text.substring(0, 100)}`);
      }
    } else {
      console.log(`  ✗ RPI extraction failed:`, rpiData);
    }
  } catch (e) { console.log(`  ✗ RPI error: ${e.message}`); }

  // ============================================================
  // TEST 2: CF Worker /animekai/extract (production path via CF)
  // ============================================================
  console.log('\n[3] Testing CF Worker /animekai/extract...');
  const cfExtractUrl = `${CF_WORKER}/animekai/extract?embed=${encodeURIComponent(encryptedEmbed)}`;
  try {
    const cfRes = await fetch(cfExtractUrl, { signal: AbortSignal.timeout(30000) });
    console.log(`  CF Worker status: ${cfRes.status}`);
    const cfData = await cfRes.json();
    
    if (cfData.success && cfData.streamUrl) {
      console.log(`  ✓✓✓ CF WORKER EXTRACTION WORKS!`);
      console.log(`  Stream URL: ${cfData.streamUrl.substring(0, 100)}`);
    } else {
      console.log(`  ✗ CF Worker extraction failed:`, cfData);
    }
  } catch (e) { console.log(`  ✗ CF Worker error: ${e.message}`); }

  console.log('\n=== DONE ===');
}

main().catch(e => console.error('Fatal:', e));
