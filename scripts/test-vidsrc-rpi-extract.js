#!/usr/bin/env node
/**
 * Test the new /vidsrc-extract endpoint on the RPI
 * This endpoint does the full chain locally: embed → RCP → prorcp → m3u8
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function testExtract(tmdbId, title, type = 'movie', season, episode) {
  const params = new URLSearchParams({ tmdbId: String(tmdbId), type });
  if (season) params.set('season', String(season));
  if (episode) params.set('episode', String(episode));

  const url = `${RPI_URL}/vidsrc-extract?${params.toString()}`;
  console.log(`\n=== ${title} (${type}/${tmdbId}${season ? ` S${season}E${episode}` : ''}) ===`);
  console.log(`→ ${url}`);

  const start = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { 'X-API-Key': RPI_KEY },
      signal: AbortSignal.timeout(30000),
    });
    const data = await resp.json();
    const elapsed = Date.now() - start;

    if (data.success) {
      console.log(`✅ ${elapsed}ms — ${data.source}`);
      console.log(`   m3u8: ${data.m3u8_url.substring(0, 120)}...`);
      console.log(`   RPI internal: ${data.duration_ms}ms`);
    } else {
      console.log(`❌ ${elapsed}ms — ${data.error}`);
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${elapsed}ms — ${e.message}`);
  }
}

async function main() {
  console.log('Testing RPI /vidsrc-extract endpoint\n');

  // Movies
  await testExtract(550, 'Fight Club');
  await testExtract(157336, 'Interstellar');
  await testExtract(680, 'Pulp Fiction');

  // TV
  await testExtract(1396, 'Breaking Bad S1E1', 'tv', 1, 1);

  console.log('\n=== Done ===');
}

main().catch(console.error);
