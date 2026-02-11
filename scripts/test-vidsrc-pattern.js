#!/usr/bin/env node
/**
 * Test VidSrc extraction pattern — movies vs TV, different content
 */
const RPI = 'https://rpi-proxy.vynx.cc';
const KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function test(tmdbId, title, type = 'movie', season, episode) {
  const params = new URLSearchParams({ tmdbId: String(tmdbId), type });
  if (season) params.set('season', String(season));
  if (episode) params.set('episode', String(episode));
  const url = `${RPI}/vidsrc-extract?${params}`;
  const start = Date.now();
  try {
    const resp = await fetch(url, { headers: { 'X-API-Key': KEY }, signal: AbortSignal.timeout(20000) });
    const data = await resp.json();
    const ms = Date.now() - start;
    const label = `${title} (${type}/${tmdbId}${season ? ` S${season}E${episode}` : ''})`;
    console.log(`${data.success ? '✅' : '❌'} ${ms}ms — ${label} — ${data.success ? data.source : data.error}`);
  } catch (e) {
    console.log(`❌ ${Date.now() - start}ms — ${title} — ${e.message}`);
  }
}

async function main() {
  console.log('=== Movies ===');
  await test(550, 'Fight Club');
  await test(157336, 'Interstellar');
  await test(27205, 'Inception');
  await test(238, 'The Godfather');

  console.log('\n=== TV Shows ===');
  await test(1396, 'Breaking Bad S1E1', 'tv', 1, 1);
  await test(1399, 'Game of Thrones S1E1', 'tv', 1, 1);
  await test(94605, 'Arcane S1E1', 'tv', 1, 1);
  await test(60625, 'Rick and Morty S1E1', 'tv', 1, 1);

  console.log('\n=== Also try 2embed API for TV ===');
  for (const [id, name, s, e] of [[1396, 'Breaking Bad', 1, 1], [1399, 'GoT', 1, 1], [94605, 'Arcane', 1, 1]]) {
    const start = Date.now();
    try {
      const r = await fetch(`https://v1.2embed.stream/api/m3u8/tv/${id}/${s}/${e}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://v1.2embed.stream/' },
        signal: AbortSignal.timeout(10000),
      });
      const d = await r.json();
      const ms = Date.now() - start;
      console.log(`${d.success && d.m3u8_url && !d.fallback ? '✅' : '❌'} ${ms}ms — 2embed ${name} S${s}E${e} — ${d.m3u8_url ? 'has m3u8' : d.message || 'no m3u8'}${d.fallback ? ' (fallback)' : ''}`);
    } catch (e2) {
      console.log(`❌ ${Date.now() - start}ms — 2embed ${name} — ${e2.message}`);
    }
  }
}

main();
