#!/usr/bin/env node
/**
 * Quick test to find which CDN domains actually resolve for prorcp m3u8 URLs
 */

const domains = [
  'cloudnestra.com', 'cloudnestra.net',
  'shadowlandschronicles.com', 'shadowlandschronicles.net', 'shadowlandschronicles.org',
  'embedsito.com',
  'neonhorizonworkshops.com',
  'orchidpixelgardens.com',
  'wanderlynest.com',
];

// From the GoT prorcp page output
const urlTemplate = 'https://tmstr5.{domain}/pl/H4sIAAAAAAAAAw3MW3KDIBQA0C0hokn6VxvRsQWjyMXwJ9DU8TU2daJx9c0CziGHMHTEC7Fxx6Pxbx6.ed_YdwSFNxIcwjeoB150Q2j2iORUoqprKUytgLStxJn5.nm';

async function main() {
  console.log('Testing CDN domain resolution for prorcp m3u8 URLs:\n');
  
  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const url = urlTemplate.replace('{domain}', domain);
      const start = Date.now();
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cloudnestra.com/' },
          signal: AbortSignal.timeout(8000),
          redirect: 'manual',
        });
        const ms = Date.now() - start;
        const ct = resp.headers.get('content-type') || '';
        return { domain, status: resp.status, ct, ms, ok: resp.status < 400 };
      } catch (e) {
        return { domain, error: e.message, ms: Date.now() - start };
      }
    })
  );

  for (const r of results) {
    const v = r.value || r.reason;
    if (v.ok) {
      console.log(`✅ tmstr5.${v.domain} — ${v.status} ${v.ct} (${v.ms}ms)`);
    } else if (v.error) {
      console.log(`❌ tmstr5.${v.domain} — ${v.error} (${v.ms}ms)`);
    } else {
      console.log(`❌ tmstr5.${v.domain} — HTTP ${v.status} (${v.ms}ms)`);
    }
  }
}

main();
