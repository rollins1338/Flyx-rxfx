#!/usr/bin/env node
/**
 * Crack AnimeKai tables v15 — Complete the tables
 * 
 * We have 118 positions. Missing: 38-91 (video ID) + a few digit positions.
 * 
 * NEW APPROACH: Collect samples from the SAME anime on BOTH AnimeKai and
 * a provider that gives us the actual MegaUp URL. Since AnimeKai's embed
 * response contains the MegaUp URL, and we can partially decrypt it,
 * we just need to figure out the video ID.
 * 
 * The video ID has:
 * - 24 constant chars (same for all g0 samples) at pos 38-61
 * - 8 variable chars at pos 62-69
 * - 22 constant chars at pos 70-91
 * 
 * If we can get the actual MegaUp video ID for ANY episode that we also
 * have an AnimeKai sample for, we can determine all 46 constant chars
 * and the 8 variable chars for that episode.
 * 
 * APPROACH: Use the MegaUp embed page. When we fetch /e/VIDEOID,
 * the page title contains the video filename. We can:
 * 1. Get an AnimeKai sample for a known anime episode
 * 2. Try to find the MegaUp video ID by searching MegaUp
 * 3. Or: try to construct the video ID from known patterns
 * 
 * Actually, the SIMPLEST approach: the old video IDs had format:
 * 8_variable_chars + "WS2JcOLzF79O5xvpCQ" (18 constant chars)
 * 
 * The new IDs are 54 chars with 24+8+22 structure.
 * Maybe: NEW_PREFIX(24) + 8_variable + "WS2JcOLzF79O5xvpCQ" + NEW_SUFFIX(4)
 * Or: NEW_PREFIX(6) + OLD_PREFIX(18) + 8_variable + OLD_SUFFIX(18) + NEW_SUFFIX(4)
 * 
 * Let me check by trying to fetch MegaUp with constructed IDs.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '15',
    '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, {
      encoding: 'utf8', timeout: 25000,
      maxBuffer: 10*1024*1024, windowsHide: true
    }).trim();
  } catch(e) { return e.stdout?.trim() || ''; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

function cipherPos(i) {
  if (i === 0) return 0;
  if (i === 1) return 7;
  if (i === 2) return 11;
  if (i === 3) return 13;
  if (i === 4) return 15;
  if (i === 5) return 17;
  if (i === 6) return 19;
  return 20 + (i - 7);
}

const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];
const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01' };

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rf(`${domain}${urlPath}`, 'fetch',
        { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}
