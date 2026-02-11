#!/usr/bin/env node
/**
 * Debug Marty Supreme (tmdbId=1317288) — failing to load
 */

const CF_WORKER = 'https://media-proxy.vynx.workers.dev';

async function testProvider(tmdbId, provider, label) {
  const params = new URLSearchParams({ tmdbId: String(tmdbId), type: 'movie' });
  if (provider === 'flixer') params.set('server', 'alpha');
  
  const url = provider === 'flixer' 
    ? `${CF_WORKER}/flixer/extract?${params}`
    : `${CF_WORKER}/vidsrc/extract?tmdbId=${tmdbId}&type=movie`;
  
  const start = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    const ms = Date.now() - start;
    
    if (provider === 'flixer') {
      if (d.success && d.sources?.length) {
        console.log(`✅ ${ms}ms — ${label} — ${d.sources.length} source(s): ${d.sources[0].url?.substring(0, 80)}...`);
      } else {
        console.log(`❌ ${ms}ms — ${label} — ${d.error || JSON.stringify(d).substring(0, 200)}`);
      }
    } else {
      if (d.success && d.m3u8_url) {
        console.log(`✅ ${ms}ms — ${label} — ${d.m3u8_url?.substring(0, 80)}...`);
      } else {
        console.log(`❌ ${ms}ms — ${label} — ${d.error || JSON.stringify(d).substring(0, 200)}`);
      }
    }
  } catch (e) {
    console.log(`❌ ${Date.now() - start}ms — ${label} — ${e.message}`);
  }
}

async function testVideasy(tmdbId) {
  // Videasy goes through the Next.js API route, but we can test the CF worker directly
  // Actually Videasy runs server-side in Next.js, not through CF worker
  // Let's test the extract API directly
  const start = Date.now();
  try {
    const r = await fetch(`https://tv.vynx.cc/api/stream/extract?tmdbId=${tmdbId}&type=movie&provider=videasy`, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const d = await r.json();
    const ms = Date.now() - start;
    if (d.success && d.sources?.length) {
      console.log(`✅ ${ms}ms — Videasy — ${d.sources.length} source(s)`);
    } else {
      console.log(`❌ ${ms}ms — Videasy — ${d.error || d.details || JSON.stringify(d).substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`❌ ${Date.now() - start}ms — Videasy — ${e.message}`);
  }
}

async function main() {
  const tmdbId = 1317288;
  console.log(`Testing Marty Supreme (tmdbId=${tmdbId})\n`);
  
  // Test Flixer (all servers)
  const servers = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
  console.log('=== Flixer ===');
  for (const s of servers) {
    const params = new URLSearchParams({ tmdbId: String(tmdbId), type: 'movie', server: s });
    const start = Date.now();
    try {
      const r = await fetch(`${CF_WORKER}/flixer/extract?${params}`, { signal: AbortSignal.timeout(15000) });
      const d = await r.json();
      const ms = Date.now() - start;
      if (d.success && d.sources?.length) {
        console.log(`  ✅ ${ms}ms — ${s}: ${d.sources[0].url?.substring(0, 80)}...`);
      } else {
        console.log(`  ❌ ${ms}ms — ${s}: ${d.error || 'no sources'}`);
      }
    } catch (e) {
      console.log(`  ❌ ${Date.now() - start}ms — ${s}: ${e.message}`);
    }
  }
  
  console.log('\n=== VidSrc ===');
  await testProvider(tmdbId, 'vidsrc', 'VidSrc');
  
  console.log('\n=== Videasy (via production API) ===');
  await testVideasy(tmdbId);
  
  // Also test a known working movie for comparison
  console.log('\n=== Control: Fight Club (550) via Flixer ===');
  await testProvider(550, 'flixer', 'Flixer alpha');
}

main();
