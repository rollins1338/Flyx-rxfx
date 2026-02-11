#!/usr/bin/env node
/**
 * Test Flixer stream playback — verify the m3u8 URLs actually work
 * Tests both direct and proxied access
 */

const CF_WORKER = 'https://media-proxy.vynx.workers.dev';

async function testFlixerPlayback(tmdbId, title, type = 'movie', season, episode) {
  const params = new URLSearchParams({ tmdbId: String(tmdbId), type, server: 'alpha' });
  if (season) params.set('season', String(season));
  if (episode) params.set('episode', String(episode));
  
  console.log(`\n=== ${title} ===`);
  
  // Step 1: Extract
  const start = Date.now();
  const r = await fetch(`${CF_WORKER}/flixer/extract?${params}`, { signal: AbortSignal.timeout(20000) });
  const d = await r.json();
  if (!d.success || !d.sources?.length) {
    console.log(`❌ Extract failed: ${d.error}`);
    return;
  }
  console.log(`✅ Extract: ${Date.now() - start}ms — ${d.sources[0].url.substring(0, 80)}...`);
  
  const m3u8Url = d.sources[0].url;
  
  // Step 2: Try direct fetch of m3u8
  console.log('\nDirect fetch:');
  try {
    const dr = await fetch(m3u8Url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://flixer.sh/' },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`  Status: ${dr.status} ${dr.headers.get('content-type')}`);
    if (dr.ok) {
      const body = await dr.text();
      console.log(`  Length: ${body.length}`);
      console.log(`  First 200: ${body.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
  
  // Step 3: Try via /animekai proxy route (residential IP)
  console.log('\nVia /animekai proxy:');
  try {
    const proxiedUrl = `${CF_WORKER}/animekai?url=${encodeURIComponent(m3u8Url)}`;
    const pr = await fetch(proxiedUrl, { signal: AbortSignal.timeout(15000) });
    console.log(`  Status: ${pr.status} ${pr.headers.get('content-type')}`);
    if (pr.ok) {
      const body = await pr.text();
      console.log(`  Length: ${body.length}`);
      console.log(`  First 200: ${body.substring(0, 200)}`);
    } else {
      const body = await pr.text();
      console.log(`  Error: ${body.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
  
  // Step 4: Try via /stream proxy route
  console.log('\nVia /stream proxy:');
  try {
    const proxiedUrl = `${CF_WORKER}/stream?url=${encodeURIComponent(m3u8Url)}&source=flixer&referer=${encodeURIComponent('https://flixer.sh/')}`;
    const sr = await fetch(proxiedUrl, { signal: AbortSignal.timeout(15000) });
    console.log(`  Status: ${sr.status} ${sr.headers.get('content-type')}`);
    if (sr.ok) {
      const body = await sr.text();
      console.log(`  Length: ${body.length}`);
      console.log(`  First 200: ${body.substring(0, 200)}`);
    } else {
      const body = await sr.text();
      console.log(`  Error: ${body.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
}

async function main() {
  await testFlixerPlayback(550, 'Fight Club');
  await testFlixerPlayback(1396, 'Breaking Bad S1E1', 'tv', 1, 1);
}

main().catch(console.error);
