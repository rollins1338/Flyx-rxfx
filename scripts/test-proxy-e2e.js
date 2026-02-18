#!/usr/bin/env node
/**
 * End-to-End Proxy Test for ALL Providers
 * 
 * Tests the FULL chain: Extraction → Proxy URL → m3u8 fetch → Segment fetch
 * 
 * For each provider:
 *   1. Call /api/stream/extract to get proxied m3u8 URL
 *   2. Fetch the proxied m3u8 through the CF Worker
 *   3. Parse the m3u8 to find segment URLs
 *   4. Fetch the first segment to verify it's actual video data
 * 
 * Usage: node scripts/test-proxy-e2e.js
 */

const CF_PROXY_BASE = 'https://media-proxy.vynx.workers.dev';

// Test content - Fight Club (movie, TMDB 550)
const TEST_MOVIE = { tmdbId: '550', type: 'movie', title: 'Fight Club' };
// Test TV - Breaking Bad S1E1
const TEST_TV = { tmdbId: '1396', type: 'tv', season: 1, episode: 1, title: 'Breaking Bad S1E1' };

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Origin': 'https://tv.vynx.cc',
  'Referer': 'https://tv.vynx.cc/',
};

// Colors for terminal output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(color, prefix, msg) {
  console.log(`${color}[${prefix}]${RESET} ${msg}`);
}


/**
 * Step 1: Extract stream URL from a provider via the local Next.js API
 * We call the CF Worker's proxy routes directly since we're testing the proxy chain
 */
async function extractViaLocalAPI(provider, content) {
  const params = new URLSearchParams({
    tmdbId: content.tmdbId,
    type: content.type,
    provider: provider,
  });
  if (content.season) params.set('season', content.season.toString());
  if (content.episode) params.set('episode', content.episode.toString());

  const url = `http://localhost:3000/api/stream/extract?${params}`;
  log(CYAN, provider.toUpperCase(), `Extracting: ${content.title} via ${url.substring(0, 100)}...`);

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(60000),
    });

    const data = await resp.json();

    if (!resp.ok || !data.success) {
      log(RED, provider.toUpperCase(), `Extraction FAILED: ${data.error || data.details || resp.status}`);
      return null;
    }

    log(GREEN, provider.toUpperCase(), `Extraction OK: ${data.sources?.length || 0} source(s), provider=${data.provider}`);

    // Return first source
    const source = data.sources?.[0];
    if (!source) {
      log(RED, provider.toUpperCase(), 'No sources in response');
      return null;
    }

    log(CYAN, provider.toUpperCase(), `Source: "${source.title}" status=${source.status}`);
    log(CYAN, provider.toUpperCase(), `Proxied URL: ${source.url?.substring(0, 120)}...`);
    log(CYAN, provider.toUpperCase(), `Direct URL: ${source.directUrl?.substring(0, 120)}...`);

    return source;
  } catch (err) {
    log(RED, provider.toUpperCase(), `Extraction ERROR: ${err.message}`);
    return null;
  }
}

/**
 * Step 2: Fetch the proxied m3u8 playlist through the CF Worker
 */
async function fetchProxiedM3u8(provider, proxiedUrl) {
  log(CYAN, provider.toUpperCase(), `Fetching proxied m3u8...`);

  try {
    const resp = await fetch(proxiedUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });

    const contentType = resp.headers.get('content-type') || '';
    const text = await resp.text();

    if (!resp.ok) {
      log(RED, provider.toUpperCase(), `m3u8 fetch FAILED: HTTP ${resp.status}`);
      log(RED, provider.toUpperCase(), `Response: ${text.substring(0, 300)}`);
      
      // Check for common errors
      if (text.includes('Domain not allowed')) {
        log(RED, provider.toUpperCase(), '>>> DOMAIN NOT IN RPI ALLOWLIST <<<');
      }
      if (text.includes('Access denied') || text.includes('403')) {
        log(RED, provider.toUpperCase(), '>>> BLOCKED BY CDN (datacenter IP?) <<<');
      }
      if (text.includes('Attention Required') || text.includes('cf-browser-verification')) {
        log(RED, provider.toUpperCase(), '>>> CLOUDFLARE CHALLENGE PAGE <<<');
      }
      return null;
    }

    // Check if it's actually an m3u8
    if (!text.includes('#EXTM3U') && !text.includes('#EXT-X-')) {
      log(RED, provider.toUpperCase(), `NOT an m3u8! Content-Type: ${contentType}`);
      log(RED, provider.toUpperCase(), `Body: ${text.substring(0, 500)}`);
      return null;
    }

    const lines = text.split('\n').filter(l => l.trim());
    const segmentLines = lines.filter(l => !l.startsWith('#'));
    const isMultiVariant = text.includes('#EXT-X-STREAM-INF');

    log(GREEN, provider.toUpperCase(), `m3u8 OK: ${lines.length} lines, ${segmentLines.length} URLs, multiVariant=${isMultiVariant}`);
    
    // Check if URLs are properly rewritten to go through proxy
    const firstUrl = segmentLines[0] || '';
    if (firstUrl.includes('media-proxy.vynx.workers.dev') || firstUrl.includes('/animekai?') || firstUrl.includes('/stream?') || firstUrl.includes('/vidsrc/')) {
      log(GREEN, provider.toUpperCase(), `URLs properly rewritten through proxy`);
    } else if (firstUrl.startsWith('http')) {
      log(YELLOW, provider.toUpperCase(), `URLs are DIRECT (not proxied): ${firstUrl.substring(0, 100)}`);
    }

    return { text, segmentLines, isMultiVariant };
  } catch (err) {
    log(RED, provider.toUpperCase(), `m3u8 fetch ERROR: ${err.message}`);
    return null;
  }
}

/**
 * Step 2b: If multi-variant, fetch the first variant playlist
 */
async function fetchVariantPlaylist(provider, m3u8Text, segmentLines) {
  // segmentLines[0] should be the first variant URL (already proxied)
  const variantUrl = segmentLines[0];
  if (!variantUrl) {
    log(RED, provider.toUpperCase(), 'No variant URL found');
    return null;
  }

  log(CYAN, provider.toUpperCase(), `Fetching variant playlist: ${variantUrl.substring(0, 120)}...`);

  try {
    const resp = await fetch(variantUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30000),
    });

    const text = await resp.text();

    if (!resp.ok) {
      log(RED, provider.toUpperCase(), `Variant fetch FAILED: HTTP ${resp.status}`);
      log(RED, provider.toUpperCase(), `Response: ${text.substring(0, 300)}`);
      return null;
    }

    if (!text.includes('#EXT-X-') && !text.includes('#EXTINF')) {
      log(RED, provider.toUpperCase(), `Variant is NOT a valid playlist`);
      log(RED, provider.toUpperCase(), `Body: ${text.substring(0, 300)}`);
      return null;
    }

    const lines = text.split('\n').filter(l => l.trim());
    const segs = lines.filter(l => !l.startsWith('#'));

    log(GREEN, provider.toUpperCase(), `Variant OK: ${segs.length} segments`);
    return { text, segmentLines: segs };
  } catch (err) {
    log(RED, provider.toUpperCase(), `Variant fetch ERROR: ${err.message}`);
    return null;
  }
}

/**
 * Step 3: Fetch the first video segment to verify it's actual video data
 */
async function fetchFirstSegment(provider, segmentUrl) {
  log(CYAN, provider.toUpperCase(), `Fetching first segment: ${segmentUrl.substring(0, 120)}...`);

  try {
    const resp = await fetch(segmentUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      log(RED, provider.toUpperCase(), `Segment fetch FAILED: HTTP ${resp.status}`);
      log(RED, provider.toUpperCase(), `Response: ${text.substring(0, 300)}`);
      
      if (text.includes('Domain not allowed')) {
        log(RED, provider.toUpperCase(), '>>> SEGMENT DOMAIN NOT IN RPI ALLOWLIST <<<');
      }
      if (text.includes('Attention Required') || text.includes('blocked')) {
        log(RED, provider.toUpperCase(), '>>> SEGMENT BLOCKED BY CDN <<<');
      }
      return false;
    }

    const contentType = resp.headers.get('content-type') || '';
    const contentLength = resp.headers.get('content-length') || '0';
    const proxiedVia = resp.headers.get('x-proxied-via') || resp.headers.get('x-proxied-by') || 'unknown';

    // Read first few bytes to check if it's video data
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 8));

    const isMpegTs = bytes[0] === 0x47; // MPEG-TS sync byte
    const isFmp4 = bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x00; // fMP4 box
    const isVideo = isMpegTs || isFmp4;

    if (isVideo) {
      log(GREEN, provider.toUpperCase(), `✅ SEGMENT OK: ${isMpegTs ? 'MPEG-TS' : 'fMP4'}, ${buffer.byteLength} bytes, via=${proxiedVia}`);
      return true;
    } else {
      // Check if it's an error page
      const text = new TextDecoder().decode(buffer.slice(0, Math.min(500, buffer.byteLength)));
      log(RED, provider.toUpperCase(), `❌ SEGMENT NOT VIDEO: Content-Type=${contentType}, size=${buffer.byteLength}`);
      log(RED, provider.toUpperCase(), `First bytes: [${Array.from(bytes.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
      if (text.includes('html') || text.includes('error') || text.includes('blocked')) {
        log(RED, provider.toUpperCase(), `Body looks like error page: ${text.substring(0, 200)}`);
      }
      return false;
    }
  } catch (err) {
    log(RED, provider.toUpperCase(), `Segment fetch ERROR: ${err.message}`);
    return false;
  }
}


/**
 * Test a single provider end-to-end
 */
async function testProvider(provider, content) {
  console.log(`\n${'='.repeat(70)}`);
  log(BOLD, 'TEST', `${provider.toUpperCase()} — ${content.title}`);
  console.log('='.repeat(70));

  const startTime = Date.now();

  // Step 1: Extract
  const source = await extractViaLocalAPI(provider, content);
  if (!source || !source.url) {
    log(RED, 'RESULT', `${provider.toUpperCase()} ❌ FAILED at extraction`);
    return { provider, success: false, stage: 'extraction', time: Date.now() - startTime };
  }

  // Step 2: Fetch m3u8
  const m3u8 = await fetchProxiedM3u8(provider, source.url);
  if (!m3u8) {
    log(RED, 'RESULT', `${provider.toUpperCase()} ❌ FAILED at m3u8 fetch`);
    return { provider, success: false, stage: 'm3u8', time: Date.now() - startTime };
  }

  let segmentUrls = m3u8.segmentLines;

  // Step 2b: If multi-variant, fetch first variant
  if (m3u8.isMultiVariant) {
    const variant = await fetchVariantPlaylist(provider, m3u8.text, m3u8.segmentLines);
    if (!variant) {
      log(RED, 'RESULT', `${provider.toUpperCase()} ❌ FAILED at variant playlist fetch`);
      return { provider, success: false, stage: 'variant', time: Date.now() - startTime };
    }
    segmentUrls = variant.segmentLines;
  }

  // Step 3: Fetch first segment
  if (segmentUrls.length === 0) {
    log(RED, 'RESULT', `${provider.toUpperCase()} ❌ No segment URLs in playlist`);
    return { provider, success: false, stage: 'no_segments', time: Date.now() - startTime };
  }

  const segmentOk = await fetchFirstSegment(provider, segmentUrls[0]);
  const elapsed = Date.now() - startTime;

  if (segmentOk) {
    log(GREEN, 'RESULT', `${provider.toUpperCase()} ✅ FULL CHAIN WORKS (${elapsed}ms)`);
    return { provider, success: true, stage: 'complete', time: elapsed };
  } else {
    log(RED, 'RESULT', `${provider.toUpperCase()} ❌ FAILED at segment fetch`);
    return { provider, success: false, stage: 'segment', time: elapsed };
  }
}

/**
 * Test direct proxy routes (bypass extraction, test proxy infra directly)
 */
async function testDirectProxy() {
  console.log(`\n${'='.repeat(70)}`);
  log(BOLD, 'TEST', 'DIRECT PROXY INFRASTRUCTURE TESTS');
  console.log('='.repeat(70));

  // Test 1: CF Worker health
  log(CYAN, 'INFRA', 'Testing CF Worker health...');
  try {
    const resp = await fetch(`${CF_PROXY_BASE}/health`, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    log(GREEN, 'INFRA', `CF Worker: ${data.status}, uptime=${data.uptime}`);
  } catch (err) {
    log(RED, 'INFRA', `CF Worker health FAILED: ${err.message}`);
  }

  // Test 2: /animekai health
  log(CYAN, 'INFRA', 'Testing /animekai health...');
  try {
    const resp = await fetch(`${CF_PROXY_BASE}/animekai/health`, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    log(GREEN, 'INFRA', `AnimeKai proxy: ${data.status}, RPI configured=${data.rpiProxy?.configured}`);
  } catch (err) {
    log(RED, 'INFRA', `/animekai health FAILED: ${err.message}`);
  }

  // Test 3: /vidsrc health
  log(CYAN, 'INFRA', 'Testing /vidsrc health...');
  try {
    const resp = await fetch(`${CF_PROXY_BASE}/vidsrc/health`, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    log(GREEN, 'INFRA', `VidSrc proxy: status=${data.status || JSON.stringify(data).substring(0, 100)}`);
  } catch (err) {
    log(RED, 'INFRA', `/vidsrc health FAILED: ${err.message}`);
  }

  // Test 4: /flixer health
  log(CYAN, 'INFRA', 'Testing /flixer health...');
  try {
    const resp = await fetch(`${CF_PROXY_BASE}/flixer/health`, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    log(GREEN, 'INFRA', `Flixer proxy: status=${data.status || JSON.stringify(data).substring(0, 100)}`);
  } catch (err) {
    log(RED, 'INFRA', `/flixer health FAILED: ${err.message}`);
  }

  // Test 5: RPI proxy health
  log(CYAN, 'INFRA', 'Testing RPI proxy...');
  try {
    const resp = await fetch('https://rpi-proxy.vynx.cc/health', { signal: AbortSignal.timeout(10000) });
    const text = await resp.text();
    log(GREEN, 'INFRA', `RPI proxy: ${resp.status} - ${text.substring(0, 100)}`);
  } catch (err) {
    log(RED, 'INFRA', `RPI proxy FAILED: ${err.message}`);
  }
}

/**
 * Test direct CDN access (to understand what's blocked)
 */
async function testDirectCDNAccess() {
  console.log(`\n${'='.repeat(70)}`);
  log(BOLD, 'TEST', 'DIRECT CDN ACCESS TESTS (from this machine)');
  console.log('='.repeat(70));

  // Test: Can we reach vidlink.pro API?
  log(CYAN, 'CDN', 'Testing vidlink.pro API access...');
  try {
    const resp = await fetch('https://vidlink.pro/api/mercury?tmdbId=0&type=movie', {
      headers: { 'User-Agent': HEADERS['User-Agent'], 'Referer': 'https://vidlink.pro/' },
      signal: AbortSignal.timeout(10000),
    });
    log(resp.ok ? GREEN : RED, 'CDN', `vidlink.pro API: ${resp.status} (${(await resp.text()).substring(0, 80)})`);
  } catch (err) {
    log(RED, 'CDN', `vidlink.pro API: ${err.message}`);
  }

  // Test: Can we reach storm.vodvidl.site? (VidLink CDN)
  log(CYAN, 'CDN', 'Testing storm.vodvidl.site access (VidLink CDN)...');
  try {
    const resp = await fetch('https://storm.vodvidl.site/', {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(10000),
    });
    const text = await resp.text();
    const isBlocked = text.includes('Attention Required') || text.includes('blocked') || text.includes('cf-browser-verification');
    log(isBlocked ? RED : GREEN, 'CDN', `storm.vodvidl.site: ${resp.status} ${isBlocked ? '(BLOCKED - Cloudflare challenge)' : '(accessible)'}`);
  } catch (err) {
    log(RED, 'CDN', `storm.vodvidl.site: ${err.message}`);
  }

  // Test: Can we reach flixer.sh?
  log(CYAN, 'CDN', 'Testing flixer.sh access...');
  try {
    const resp = await fetch('https://flixer.sh/', {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(10000),
    });
    log(resp.ok ? GREEN : YELLOW, 'CDN', `flixer.sh: ${resp.status}`);
  } catch (err) {
    log(RED, 'CDN', `flixer.sh: ${err.message}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`${BOLD}${'═'.repeat(70)}${RESET}`);
  console.log(`${BOLD}  END-TO-END PROXY TEST — ALL PROVIDERS${RESET}`);
  console.log(`${BOLD}  Testing: Extraction → Proxy → m3u8 → Segment${RESET}`);
  console.log(`${BOLD}${'═'.repeat(70)}${RESET}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`CF Proxy: ${CF_PROXY_BASE}`);

  // Phase 1: Infrastructure health checks
  await testDirectProxy();

  // Phase 2: Direct CDN access tests
  await testDirectCDNAccess();

  // Phase 3: Full provider tests
  const results = [];

  // Test Flixer (PRIMARY)
  results.push(await testProvider('flixer', TEST_MOVIE));

  // Test VidLink (SECONDARY)
  results.push(await testProvider('vidlink', TEST_MOVIE));

  // Test VidSrc (TERTIARY)
  results.push(await testProvider('vidsrc', TEST_MOVIE));

  // Summary
  console.log(`\n${'═'.repeat(70)}`);
  log(BOLD, 'SUMMARY', 'Provider Test Results');
  console.log('═'.repeat(70));

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const stage = r.success ? 'FULL CHAIN OK' : `FAILED at ${r.stage}`;
    log(r.success ? GREEN : RED, r.provider.toUpperCase().padEnd(10), `${icon} ${stage} (${r.time}ms)`);
  }

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`\n${passed === total ? GREEN : RED}${passed}/${total} providers working${RESET}`);

  if (passed < total) {
    console.log(`\n${RED}${BOLD}⚠️  SOME PROVIDERS ARE BROKEN — DO NOT DEPLOY${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}✅ ALL PROVIDERS WORKING — SAFE TO DEPLOY${RESET}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
