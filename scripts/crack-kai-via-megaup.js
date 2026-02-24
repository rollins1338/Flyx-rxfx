#!/usr/bin/env node
/**
 * Crack AnimeKai decrypt tables by figuring out MegaUp video IDs.
 * 
 * Approach: For each AnimeKai episode, we get the encrypted embed response.
 * The plaintext contains a MegaUp video ID. We need to figure out what that ID is.
 * 
 * Key insight: MegaUp video IDs follow a pattern. If we can figure out the ID
 * for even ONE sample, we can start building tables. Then use those partial tables
 * to decrypt more samples, building more tables iteratively.
 * 
 * Strategy:
 * 1. Get encrypted samples from AnimeKai
 * 2. For each sample, try to find the MegaUp video ID by:
 *    a. Checking if the anime has a known MegaUp page
 *    b. Using the partial tables we already have
 *    c. Brute-forcing the remaining unknown positions
 * 3. Once we have full plaintext, build complete tables
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
}

function rfSafe(url, mode = 'fetch', extra = {}) {
  try { return rf(url, mode, extra); }
  catch (err) { if (err.stdout?.trim()) return err.stdout.trim(); throw err; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'], {
    encoding: 'utf8', timeout: 5000, windowsHide: true
  }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function b64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

function ptLen(dl) {
  if (dl > 20) return 7 + (dl - 20);
  if (dl > 19) return 7; if (dl > 17) return 6; if (dl > 15) return 5;
  if (dl > 13) return 4; if (dl > 11) return 3; if (dl > 7) return 2;
  if (dl > 0) return 1; return 0;
}

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rfSafe(`${domain}${urlPath}`, 'fetch', { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

function fetchUrl(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': UA, ...hdrs }, timeout: 15000,
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  CRACK ANIMEKAI TABLES VIA MEGAUP VERIFICATION       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Step 1: Get a fresh encrypted sample and try to figure out the video ID
  console.log('Getting fresh AnimeKai sample for bleach ep1 sub...\n');
  
  const searchData = kaiFetch('/ajax/anime/search?keyword=bleach');
  const slug = searchData.result.html.match(/href="\/watch\/([^"]+)"/)?.[1];
  console.log('Slug:', slug);
  
  let contentId = null;
  for (const domain of KAI_DOMAINS) {
    try {
      const watchHtml = rfSafe(`${domain}/watch/${slug}`, 'fetch', { 'Referer': `${domain}/` });
      const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
      if (syncMatch) {
        contentId = JSON.parse(syncMatch[1]).anime_id;
        break;
      }
    } catch {}
  }
  console.log('Content ID:', contentId);

  const encId = kaiEncrypt(contentId);
  const epData = kaiFetch(`/ajax/episodes/list?ani_id=${contentId}&_=${encId}`);
  
  // Get first episode token
  const tokenMatch = epData.result.match(/num="1"[^>]*token="([^"]+)"/);
  const token = tokenMatch?.[1] || epData.result.match(/token="([^"]+)"/)?.[1];
  console.log('Token:', token?.substring(0, 20) + '...');

  const encToken = kaiEncrypt(token);
  const srvData = kaiFetch(`/ajax/links/list?token=${token}&_=${encToken}`);
  
  // Get ALL lids with their server names
  console.log('\nServer list HTML (first 2000 chars):');
  console.log(srvData.result.substring(0, 2000));
  
  // Parse all servers with their names
  const serverBlocks = srvData.result.match(/<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>([^<]*)<\/span>/g) || [];
  console.log('\nServers found:');
  for (const block of serverBlocks) {
    const lid = block.match(/data-lid="([^"]+)"/)?.[1];
    const name = block.match(/>([^<]*)<\/span>/)?.[1];
    console.log(`  ${name} → lid: ${lid}`);
    
    // Get the encrypted embed for this server
    try {
      const encLid = kaiEncrypt(lid);
      const viewResp = kaiFetch(`/ajax/links/view?id=${lid}&_=${encLid}`);
      if (viewResp?.result) {
        const raw = b64Decode(viewResp.result);
        const cd = raw.slice(21);
        const pl = ptLen(cd.length);
        console.log(`    encrypted: ${viewResp.result.substring(0, 40)}... (ptLen=${pl}, dataLen=${cd.length})`);
        
        // Check if this is a MegaUp server (name contains "MegaUp" or similar)
        if (name.toLowerCase().includes('mega')) {
          console.log(`    *** THIS IS A MEGAUP SERVER ***`);
        }
      }
    } catch (e) {
      console.log(`    error: ${e.message?.substring(0, 60)}`);
    }
  }
  
  // Also try parsing with different regex patterns
  const lidMatches = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)];
  console.log(`\nAll lids: ${lidMatches.length}`);
  for (const lm of lidMatches) {
    console.log(`  ${lm[1]}`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
