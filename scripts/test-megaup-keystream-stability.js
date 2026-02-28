#!/usr/bin/env node
/**
 * Quick test: Is the MegaUp keystream stable across different videos?
 * If yes, we can update it once. If no, we need enc-dec.app always.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

let TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rpi-proxy', 'animekai-tables.json'), 'utf8'));

function urlSafeBase64Decode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4), 'base64');
}
function urlSafeBase64Encode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function getCipherPosition(i) { return [0,7,11,13,15,17,19][i] ?? (20 + (i - 7)); }
function decryptAnimeKai(ct) {
  const cipher = urlSafeBase64Decode(ct);
  const off = cipher.length > 21 ? 21 : 0;
  const dLen = cipher.length - off;
  let pLen = 0;
  if (dLen > 20) pLen = 7 + (dLen - 20); else if (dLen > 19) pLen = 7;
  else if (dLen > 17) pLen = 6; else if (dLen > 15) pLen = 5;
  else if (dLen > 13) pLen = 4; else if (dLen > 11) pLen = 3;
  else if (dLen > 7) pLen = 2; else if (dLen > 0) pLen = 1;
  let p = '';
  for (let i = 0; i < pLen; i++) {
    const pos = off + getCipherPosition(i);
    if (pos >= cipher.length) break;
    const b = cipher[pos];
    const t = TABLES[i];
    p += (t && b in t) ? t[b] : String.fromCharCode(b);
  }
  return p;
}
function encryptAnimeKai(pt) {
  const enc = {};
  for (const [p, t] of Object.entries(TABLES)) { enc[p] = {}; for (const [b, c] of Object.entries(t)) enc[p][c] = parseInt(b); }
  const CB = {1:0xf2,2:0xdf,3:0x9b,4:0x9d,5:0x16,6:0xe5,8:0x67,9:0xc9,10:0xdd,12:0x9c,14:0x29,16:0x35,18:0xc8};
  const H = Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa', 'hex');
  const pLen = pt.length;
  let cLen; if (pLen<=1) cLen=1; else if (pLen<=2) cLen=8; else if (pLen<=3) cLen=12;
  else if (pLen<=4) cLen=14; else if (pLen<=5) cLen=16; else if (pLen<=6) cLen=18;
  else if (pLen<=7) cLen=20; else cLen=20+(pLen-7);
  const c = Buffer.alloc(21+cLen); H.copy(c,0);
  for (const [p,b] of Object.entries(CB)) { const i=21+parseInt(p); if(i<c.length) c[i]=b; }
  for (let i=0;i<pLen;i++) { const ch=pt[i]; const cp=getCipherPosition(i); const t=enc[i]; c[21+cp]=(t&&ch in t)?t[ch]:ch.charCodeAt(0); }
  return urlSafeBase64Encode(c);
}
function decodeHex(s) { return s.replace(/}([0-9A-Fa-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16))); }

function decryptMegaUpViaAPI(enc) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify({ text: enc, agent: MEGAUP_UA });
    const req = https.request({ hostname:'enc-dec.app', path:'/api/dec-mega', method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d),'User-Agent':MEGAUP_UA}, timeout:15000 },
      res => { const c=[]; res.on('data',ch=>c.push(ch)); res.on('end',()=>{
        try { const r=JSON.parse(Buffer.concat(c).toString()); if(r.status!==200) return reject(new Error(JSON.stringify(r)));
          resolve(typeof r.result==='string'?r.result:JSON.stringify(r.result)); } catch(e){reject(e);} }); });
    req.on('error',reject); req.on('timeout',()=>{req.destroy();reject(new Error('timeout'));}); req.write(d); req.end();
  });
}

async function fetchKai(p) {
  for (const d of ['https://animekai.to','https://anikai.to']) {
    try { const r = await fetch(`${d}${p}`, { headers:{'User-Agent':UA,'Accept':'*/*','Referer':'https://animekai.to/','X-Requested-With':'XMLHttpRequest'}, signal:AbortSignal.timeout(10000) }); if(r.ok) return await r.json(); } catch {}
  }
  return null;
}

async function getKeystreamForAnime(query, ep) {
  console.log(`\n--- Testing: "${query}" ep ${ep} ---`);
  const s = await fetchKai(`/ajax/anime/search?keyword=${encodeURIComponent(query)}`);
  if (!s?.result?.html) { console.log('  No results'); return null; }
  const m = s.result.html.match(/<a[^>]*href="\/watch\/([^"]+)"/);
  if (!m) return null;
  const wr = await fetch(`https://animekai.to/watch/${m[1]}`, { headers:{'User-Agent':UA}, signal:AbortSignal.timeout(10000) });
  const wh = await wr.text();
  const sm = wh.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  if (!sm) return null;
  const sd = JSON.parse(sm[1]);
  console.log(`  anime_id: ${sd.anime_id}`);
  
  const eData = await fetchKai(`/ajax/episodes/list?ani_id=${sd.anime_id}&_=${encryptAnimeKai(sd.anime_id)}`);
  if (!eData?.result) return null;
  const eps = {};
  let mm;
  const r1 = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
  while ((mm = r1.exec(eData.result)) !== null) eps[mm[1]] = mm[2];
  const r2 = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"[^>]*>/gi;
  while ((mm = r2.exec(eData.result)) !== null) if (!eps[mm[2]]) eps[mm[2]] = mm[1];
  if (!eps[ep]) { console.log(`  Ep ${ep} not found`); return null; }
  
  const sData = await fetchKai(`/ajax/links/list?token=${eps[ep]}&_=${encryptAnimeKai(eps[ep])}`);
  if (!sData?.result) return null;
  const sm2 = sData.result.match(/<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>/);
  if (!sm2) return null;
  
  const eData2 = await fetchKai(`/ajax/links/view?id=${sm2[1]}&_=${encryptAnimeKai(sm2[1])}`);
  if (!eData2?.result) return null;
  const dec = decodeHex(decryptAnimeKai(eData2.result));
  let ej; try { ej = JSON.parse(dec); } catch { return null; }
  
  const um = ej.url.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
  if (!um) return null;
  const mediaUrl = `https://${um[1]}/media/${um[2]}`;
  console.log(`  MegaUp host: ${um[1]}`);
  
  let mr;
  try { mr = await fetch(mediaUrl, { headers:{'User-Agent':MEGAUP_UA}, signal:AbortSignal.timeout(10000) }); } catch { return null; }
  if (!mr.ok) return null;
  const md = await mr.json();
  if (md.status !== 200 || !md.result) return null;
  
  console.log(`  Encrypted: ${md.result.length} chars`);
  const apiResult = await decryptMegaUpViaAPI(md.result);
  console.log(`  Decrypted: ${apiResult.substring(0, 80)}...`);
  
  const encBytes = Buffer.from(md.result.replace(/-/g,'+').replace(/_/g,'/'), 'base64');
  const plainBytes = Buffer.from(apiResult, 'utf8');
  const ksLen = Math.min(encBytes.length, plainBytes.length);
  const ks = Buffer.alloc(ksLen);
  for (let i = 0; i < ksLen; i++) ks[i] = encBytes[i] ^ plainBytes[i];
  return ks;
}

async function main() {
  console.log('=== MEGAUP KEYSTREAM STABILITY TEST ===');
  
  const keystreamSamples = [];
  
  const tests = [
    ['One Piece', 1],
    ['Naruto', 1],
    ['Dragon Ball Z', 1],
  ];
  
  for (const [q, e] of tests) {
    try {
      const ks = await getKeystreamForAnime(q, e);
      if (ks) keystreamSamples.push({ query: q, keystream: ks });
    } catch (err) { console.log(`  Error: ${err.message}`); }
  }
  
  if (keystreamSamples.length < 2) {
    console.log('\nNot enough samples to compare');
    if (keystreamSamples.length === 1) {
      console.log(`\nSingle keystream (${keystreamSamples[0].keystream.length} bytes):`);
      console.log(keystreamSamples[0].keystream.toString('hex'));
    }
    return;
  }
  
  console.log(`\n=== COMPARING ${keystreamSamples.length} KEYSTREAMSS ===`);
  for (let i = 0; i < keystreamSamples.length; i++) {
    for (let j = i + 1; j < keystreamSamples.length; j++) {
      const a = keystreamSamples[i], b = keystreamSamples[j];
      const len = Math.min(a.keystream.length, b.keystream.length);
      let match = 0;
      for (let k = 0; k < len; k++) if (a.keystream[k] === b.keystream[k]) match++;
      console.log(`  "${a.query}" vs "${b.query}": ${match}/${len} bytes match (${(match/len*100).toFixed(1)}%)`);
    }
  }
  
  // If keystreamSamples are identical, the keystream is stable
  const allSame = keystreamSamples.every((s, i) => {
    if (i === 0) return true;
    return s.keystream.slice(0, 100).equals(keystreamSamples[0].keystream.slice(0, 100));
  });
  
  if (allSame) {
    console.log('\n✓✓✓ KEYSTREAM IS STABLE ACROSS VIDEOS!');
    console.log('We can update the native keystream and it will work for all videos.');
    console.log(`\nNew keystream (${keystreamSamples[0].keystream.length} bytes):`);
    console.log(keystreamSamples[0].keystream.toString('hex'));
  } else {
    console.log('\n✗ KEYSTREAM VARIES PER VIDEO - must use enc-dec.app API');
  }
}

main().catch(e => console.error('Fatal:', e));
