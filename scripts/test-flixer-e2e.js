#!/usr/bin/env node
/**
 * End-to-end test: Flixer as primary provider via CF Worker
 * Tests the same flow the frontend uses
 */

const CF_WORKER = 'https://media-proxy.vynx.workers.dev';

async function testExtract(tmdbId, title, type = 'movie', season, episode) {
  const params = new URLSearchParams({ tmdbId: String(tmdbId), type, server: 'alpha' });
  if (season) params.set('season', String(season));
  if (episode) params.set('episode', String(episode));
  
  const start = Date.now();
  try {
    const r = await fetch(`${CF_WORKER}/flixer/extract?${params}`, { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    const ms = Date.now() - start;
    const label = `${title} (${type}/${tmdbId}${season ? ` S${season}E${episode}` : ''})`;
    
    if (d.success && d.sources?.length) {
      // Verify the m3u8 is actually playable via proxy
      const m3u8Url = d.sources[0].url;
      const proxyUrl = `${CF_WORKER}/animekai?url=${encodeURIComponent(m3u8Url)}`;
      const m3u8Resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      
      if (m3u8Resp.ok) {
        const body = await m3u8Resp.text();
        const hasSegments = body.includes('#EXTINF') || body.includes('#EXT-X-STREAM-INF');
        console.log(`✅ ${ms}ms — ${label} — ${d.sources.length} source(s), m3u8 ${hasSegments ? 'valid' : 'empty'} (${body.length} bytes)`);
      } else {
        console.log(`⚠️ ${ms}ms — ${label} — extracted but m3u8 proxy returned ${m3u8Resp.status}`);
      }
    } else {
      console.log(`❌ ${ms}ms — ${label} — ${d.error || 'no sources'}`);
    }
  } catch (e) {
    console.log(`❌ ${Date.now() - start}ms — ${title} — ${e.message}`);
  }
}

async function main() {
  console.log('Flixer E2E Test — CF Worker extraction + proxy playback\n');
  
  // Movies
  await testExtract(550, 'Fight Club');
  await testExtract(157336, 'Interstellar');
  await testExtract(27205, 'Inception');
  await testExtract(680, 'Pulp Fiction');
  await testExtract(238, 'The Godfather');
  
  console.log('');
  
  // TV
  await testExtract(1396, 'Breaking Bad S1E1', 'tv', 1, 1);
  await testExtract(1399, 'Game of Thrones S1E1', 'tv', 1, 1);
  await testExtract(94605, 'Arcane S1E1', 'tv', 1, 1);
  await testExtract(60625, 'Rick and Morty S1E1', 'tv', 1, 1);
  await testExtract(76479, 'The Boys S1E1', 'tv', 1, 1);
}

main();
