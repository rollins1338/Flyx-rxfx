#!/usr/bin/env node
/**
 * Probe MegaUp to understand its API and find video IDs.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '15', '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
  } catch (err) {
    if (err.stdout?.trim()) return err.stdout.trim();
    return `ERROR: ${err.message?.substring(0, 100)}`;
  }
}

// Try various MegaUp endpoints
const urls = [
  'https://megaup22.online/',
  'https://megaup22.online/e/test',
  'https://megaup22.online/media/test',
];

for (const url of urls) {
  console.log(`\n=== ${url} ===`);
  const resp = rf(url, 'fetch', { 'Referer': 'https://animekai.to/' });
  console.log(resp.substring(0, 500));
}

// Now try the megaup mode with a known embed URL pattern
// From the old working system, MegaUp embed URLs look like:
// https://megaup22.online/e/SOME_ID
// The megaup mode in rust-fetch fetches /media/ID and decrypts

// Let's try to find a valid MegaUp video ID by checking if we can
// access the embed page. We know from our samples that the video IDs
// are 54 chars long. But maybe we can find shorter test IDs.

// Actually, let's try to use the megaup mode directly with a test URL
console.log('\n=== Testing megaup mode ===');
try {
  const result = rf('https://megaup22.online/e/test123', 'megaup');
  console.log('megaup result:', result.substring(0, 300));
} catch (e) {
  console.log('megaup error:', e.message?.substring(0, 200));
}
