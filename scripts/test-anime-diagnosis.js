#!/usr/bin/env node
/**
 * Comprehensive Anime System Diagnosis
 * Tests both AnimeKai extraction and HiAnime stream playback
 */

const https = require('https');
const http = require('http');

const PROD_URL = 'https://tv.vynx.cc';
const TEST_ANIME = {
  title: 'Jujutsu Kaisen',
  malId: 40748,
  episode: 1,
};

// ============================================================================
// Test 1: AnimeKai Search API
// ============================================================================
async function testAnimeKaiSearch() {
  console.log('\n========================================');
  console.log('TEST 1: AnimeKai Search API');
  console.log('========================================\n');

  const domains = ['animekai.to', 'anikai.to'];
  
  for (const domain of domains) {
    console.log(`\nTesting domain: ${domain}`);
    console.log('─'.repeat(50));
    
    // Test 1a: Check if domain is accessible
    try {
      const pageRes = await fetch(`https://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });
      console.log(`✓ Domain accessible: ${pageRes.status} (${pageRes.headers.get('content-length')} bytes)`);
      
      // Check for Cloudflare protection
      const pageText = await pageRes.text();
      if (pageText.includes('cf-challenge') || pageText.includes('Just a moment')) {
        console.log('⚠ Cloudflare challenge detected!');
      }
      if (pageText.includes('turnstile')) {
        console.log('⚠ Turnstile CAPTCHA detected!');
      }
    } catch (err) {
      console.log(`✗ Domain not accessible: ${err.message}`);
      continue;
    }
    
    // Test 1b: Search API
    const searchUrl = `https://${domain}/ajax/search?keyword=${encodeURIComponent(TEST_ANIME.title)}`;
    console.log(`\nTesting search: ${searchUrl}`);
    
    try {
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
          'Referer': `https://${domain}/`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`Status: ${searchRes.status}`);
      console.log(`Content-Type: ${searchRes.headers.get('content-type')}`);
      
      const searchData = await searchRes.json();
      console.log(`Results: ${JSON.stringify(searchData, null, 2)}`);
      
      if (searchData.result && searchData.result.length > 0) {
        console.log(`✓ Search returned ${searchData.result.length} results`);
        const firstResult = searchData.result[0];
        console.log(`  First result: ${firstResult.title || firstResult.name}`);
        if (firstResult.syncData) {
          console.log(`  MAL ID: ${firstResult.syncData.mal_id}`);
        }
      } else {
        console.log(`✗ Search returned 0 results`);
      }
    } catch (err) {
      console.log(`✗ Search failed: ${err.message}`);
    }
  }
}

// ============================================================================
// Test 2: Production API - AnimeKai Extraction
// ============================================================================
async function testProductionAnimeKai() {
  console.log('\n========================================');
  console.log('TEST 2: Production AnimeKai Extraction');
  console.log('========================================\n');

  const apiUrl = `${PROD_URL}/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=${TEST_ANIME.malId}`;
  console.log(`Testing: ${apiUrl}\n`);

  try {
    const startTime = Date.now();
    const res = await fetch(apiUrl, {
      signal: AbortSignal.timeout(30000),
    });
    const elapsed = Date.now() - startTime;

    console.log(`Status: ${res.status}`);
    console.log(`Time: ${elapsed}ms`);

    const data = await res.json();
    console.log(`\nResponse:`);
    console.log(JSON.stringify(data, null, 2));

    if (data.sources) {
      const animeKaiSources = data.sources.filter(s => s.title?.includes('[AnimeKai]'));
      const hiAnimeSources = data.sources.filter(s => s.title?.includes('[HiAnime]'));
      
      console.log(`\n✓ Total sources: ${data.sources.length}`);
      console.log(`  AnimeKai: ${animeKaiSources.length}`);
      console.log(`  HiAnime: ${hiAnimeSources.length}`);
      
      if (animeKaiSources.length === 0) {
        console.log(`\n⚠ WARNING: No AnimeKai sources returned!`);
      }
    } else {
      console.log(`\n✗ No sources in response`);
    }
  } catch (err) {
    console.log(`✗ API call failed: ${err.message}`);
  }
}

// ============================================================================
// Test 3: HiAnime Stream Playback
// ============================================================================
async function testHiAnimeStreamPlayback() {
  console.log('\n========================================');
  console.log('TEST 3: HiAnime Stream Playback');
  console.log('========================================\n');

  // First get a HiAnime source URL
  const apiUrl = `${PROD_URL}/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=${TEST_ANIME.malId}`;
  console.log(`Getting HiAnime source from: ${apiUrl}\n`);

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();

    const hiAnimeSources = data.sources?.filter(s => s.title?.includes('[HiAnime]')) || [];
    
    if (hiAnimeSources.length === 0) {
      console.log('✗ No HiAnime sources available to test');
      return;
    }

    const testSource = hiAnimeSources[0];
    console.log(`Testing source: ${testSource.title}`);
    console.log(`URL: ${testSource.url.substring(0, 100)}...\n`);

    // Try to fetch the m3u8 playlist
    console.log('Fetching master playlist...');
    const playlistRes = await fetch(testSource.url, {
      signal: AbortSignal.timeout(15000),
    });

    console.log(`Status: ${playlistRes.status}`);
    console.log(`Content-Type: ${playlistRes.headers.get('content-type')}`);

    if (playlistRes.ok) {
      const playlistText = await playlistRes.text();
      console.log(`Playlist size: ${playlistText.length} bytes`);
      console.log(`First 500 chars:\n${playlistText.substring(0, 500)}`);

      // Try to fetch a segment
      const segmentMatch = playlistText.match(/https?:\/\/[^\s]+\.ts/);
      if (segmentMatch) {
        const segmentUrl = segmentMatch[0];
        console.log(`\nTesting segment: ${segmentUrl.substring(0, 100)}...`);

        const segmentRes = await fetch(segmentUrl, {
          signal: AbortSignal.timeout(15000),
        });

        console.log(`Segment status: ${segmentRes.status}`);
        console.log(`Segment content-type: ${segmentRes.headers.get('content-type')}`);
        console.log(`Segment size: ${segmentRes.headers.get('content-length')} bytes`);

        if (segmentRes.ok) {
          console.log(`✓ Segment fetch successful!`);
        } else {
          const errorText = await segmentRes.text();
          console.log(`✗ Segment fetch failed: ${errorText.substring(0, 200)}`);
        }
      } else {
        console.log('⚠ No segment URLs found in playlist');
      }
    } else {
      const errorText = await playlistRes.text();
      console.log(`✗ Playlist fetch failed: ${errorText.substring(0, 500)}`);
    }
  } catch (err) {
    console.log(`✗ Test failed: ${err.message}`);
  }
}

// ============================================================================
// Test 4: Check Environment & Configuration
// ============================================================================
async function testConfiguration() {
  console.log('\n========================================');
  console.log('TEST 4: Configuration Check');
  console.log('========================================\n');

  // Test Cloudflare Worker health
  const cfWorkerUrl = 'https://tv-proxy.vynx.workers.dev/hianime/health';
  console.log(`Testing CF Worker: ${cfWorkerUrl}`);
  
  try {
    const res = await fetch(cfWorkerUrl, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    console.log(`✓ CF Worker healthy: ${JSON.stringify(data)}`);
  } catch (err) {
    console.log(`✗ CF Worker error: ${err.message}`);
  }
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Anime System Comprehensive Diagnosis  ║');
  console.log('╚════════════════════════════════════════╝');

  await testAnimeKaiSearch();
  await testProductionAnimeKai();
  await testHiAnimeStreamPlayback();
  await testConfiguration();

  console.log('\n========================================');
  console.log('DIAGNOSIS COMPLETE');
  console.log('========================================\n');
}

main().catch(console.error);
