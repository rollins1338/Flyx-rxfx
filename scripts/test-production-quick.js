#!/usr/bin/env node
/**
 * Quick test of production API after fixes
 */

const PROD_URL = 'https://tv.vynx.cc';

async function testProduction() {
  console.log('Testing production API...\n');
  
  const apiUrl = `${PROD_URL}/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=40748`;
  console.log(`URL: ${apiUrl}\n`);
  
  const startTime = Date.now();
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
  const elapsed = Date.now() - startTime;
  
  console.log(`Status: ${res.status}`);
  console.log(`Time: ${elapsed}ms\n`);
  
  const data = await res.json();
  
  const animeKaiSources = data.sources?.filter(s => s.title?.includes('[AnimeKai]')) || [];
  const hiAnimeSources = data.sources?.filter(s => s.title?.includes('[HiAnime]')) || [];
  
  console.log(`Sources:`);
  console.log(`  AnimeKai: ${animeKaiSources.length}`);
  console.log(`  HiAnime: ${hiAnimeSources.length}`);
  console.log(`  Total: ${data.sources?.length || 0}\n`);
  
  if (animeKaiSources.length > 0) {
    console.log('✓ AnimeKai WORKING!');
  } else {
    console.log('✗ AnimeKai still broken');
  }
  
  if (hiAnimeSources.length > 0) {
    console.log('✓ HiAnime extraction working');
    
    // Test stream playback
    const testUrl = hiAnimeSources[0].url;
    console.log(`\nTesting HiAnime stream: ${testUrl.substring(0, 80)}...`);
    
    const streamRes = await fetch(testUrl, { signal: AbortSignal.timeout(15000) });
    console.log(`Stream status: ${streamRes.status}`);
    
    if (streamRes.ok) {
      console.log('✓ HiAnime streams WORKING!');
    } else {
      const err = await streamRes.text();
      console.log(`✗ HiAnime streams broken: ${err.substring(0, 200)}`);
    }
  }
}

testProduction().catch(console.error);
