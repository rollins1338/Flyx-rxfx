#!/usr/bin/env node
/**
 * Test if Flixer is back online and working through the CF Worker
 */

const CF_WORKER = 'https://media-proxy.vynx.workers.dev';

async function testFlixerHealth() {
  console.log('=== Flixer Health Check ===');
  try {
    const r = await fetch(`${CF_WORKER}/flixer/health`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    console.log(`Status: ${r.status}`, d);
  } catch (e) {
    console.log(`Health check failed: ${e.message}`);
  }
}

async function testFlixerExtract(tmdbId, title, type = 'movie', server = 'alpha', season, episode) {
  const params = new URLSearchParams({ tmdbId: String(tmdbId), type, server });
  if (season) params.set('season', String(season));
  if (episode) params.set('episode', String(episode));
  
  const url = `${CF_WORKER}/flixer/extract?${params}`;
  const label = `${title} (${type}/${tmdbId}${season ? ` S${season}E${episode}` : ''}) [${server}]`;
  
  const start = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
    const d = await r.json();
    const ms = Date.now() - start;
    
    if (d.success && d.sources?.length > 0) {
      console.log(`✅ ${ms}ms — ${label}`);
      for (const s of d.sources) {
        console.log(`   ${s.quality}: ${s.url?.substring(0, 100)}...`);
      }
    } else {
      console.log(`❌ ${ms}ms — ${label} — ${d.error || 'no sources'}`);
    }
  } catch (e) {
    console.log(`❌ ${Date.now() - start}ms — ${label} — ${e.message}`);
  }
}

async function main() {
  await testFlixerHealth();
  
  console.log('\n=== Movies ===');
  await testFlixerExtract(550, 'Fight Club', 'movie', 'alpha');
  await testFlixerExtract(550, 'Fight Club', 'movie', 'bravo');
  await testFlixerExtract(157336, 'Interstellar', 'movie', 'alpha');
  
  console.log('\n=== TV Shows ===');
  await testFlixerExtract(1396, 'Breaking Bad S1E1', 'tv', 'alpha', 1, 1);
  await testFlixerExtract(94605, 'Arcane S1E1', 'tv', 'alpha', 1, 1);
  
  console.log('\n=== Multiple Servers (Fight Club) ===');
  const servers = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
  await Promise.all(servers.map(s => testFlixerExtract(550, `Fight Club`, 'movie', s)));
}

main();
