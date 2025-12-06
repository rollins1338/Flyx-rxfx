/**
 * Test script for Videasy extractor
 * Tests extraction for Five Nights at Freddy's (2023) - TMDB ID: 507089
 * 
 * Run with: npx ts-node scripts/test-videasy.ts
 * Or: npx tsx scripts/test-videasy.ts
 */

// Polyfill fetch for Node.js if needed
if (typeof fetch === 'undefined') {
  // @ts-ignore
  global.fetch = require('node-fetch');
}

const VIDEASY_API_BASE = 'https://api.videasy.net';
const DECRYPTION_API = 'https://enc-dec.app/api';
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
};

interface VideasySource {
  file?: string;
  url?: string;
  type?: string;
  label?: string;
  quality?: string;
}

interface VideasyResponse {
  sources?: VideasySource[];
  subtitles?: Array<{ file?: string; url?: string; label?: string; lang?: string }>;
  tracks?: Array<{ file?: string; url?: string; label?: string; kind?: string }>;
}

// Test cases
const TEST_CASES = [
  {
    name: 'Five Nights at Freddy\'s (2023)',
    tmdbId: '507089',
    type: 'movie' as const,
    year: '2023',
    title: 'Five Nights at Freddy\'s',
  },
  {
    name: 'Cyberpunk: Edgerunners S1E1',
    tmdbId: '105248',
    type: 'tv' as const,
    year: '2022',
    title: 'Cyberpunk: Edgerunners',
    season: 1,
    episode: 1,
  },
];

// Sources to test
const SOURCES = [
  { name: 'Neon', endpoint: 'myflixerzupcloud' },
  { name: 'Sage', endpoint: '1movies' },
  { name: 'Cypher', endpoint: 'moviebox' },
  { name: 'Yoru', endpoint: 'cdn', movieOnly: true },
  { name: 'Breach', endpoint: 'm4uhd' },
];

async function fetchFromVideasy(
  endpoint: string,
  tmdbId: string,
  title: string,
  year: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<string | null> {
  try {
    let url = `${VIDEASY_API_BASE}/${endpoint}/sources-with-title?title=${encodeURIComponent(title)}&mediaType=${type}&year=${year}&tmdbId=${tmdbId}`;
    
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      url += `&seasonId=${season}&episodeId=${episode}`;
    }

    console.log(`  Fetching: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`  HTTP ${response.status}`);
      return null;
    }

    const text = await response.text();
    
    if (!text || text.trim() === '') {
      console.log(`  Empty response`);
      return null;
    }

    console.log(`  Got encrypted data (${text.length} chars)`);
    return text;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`  Timeout`);
    } else {
      console.log(`  Error: ${error.message}`);
    }
    return null;
  }
}

async function decryptVideasyResponse(encryptedText: string, tmdbId: string): Promise<VideasyResponse | null> {
  try {
    console.log(`  Decrypting...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${DECRYPTION_API}/dec-videasy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({
        text: encryptedText,
        id: tmdbId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`  Decryption failed: HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    
    if (!json.result) {
      console.log('  Decryption returned no result');
      return null;
    }

    let decrypted: VideasyResponse;
    if (typeof json.result === 'string') {
      try {
        decrypted = JSON.parse(json.result);
      } catch {
        console.log('  Failed to parse decrypted JSON');
        console.log('  Raw result:', json.result.substring(0, 200));
        return null;
      }
    } else {
      decrypted = json.result;
    }

    return decrypted;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('  Decryption timeout');
    } else {
      console.log(`  Decryption error: ${error.message}`);
    }
    return null;
  }
}

async function testSource(
  sourceName: string,
  endpoint: string,
  testCase: typeof TEST_CASES[0],
  movieOnly: boolean = false
): Promise<boolean> {
  console.log(`\n[${sourceName}] Testing...`);

  // Skip movie-only sources for TV
  if (movieOnly && testCase.type === 'tv') {
    console.log(`  Skipping (movie only)`);
    return false;
  }

  try {
    // Fetch encrypted data
    const encryptedData = await fetchFromVideasy(
      endpoint,
      testCase.tmdbId,
      testCase.title,
      testCase.year,
      testCase.type,
      testCase.season,
      testCase.episode
    );

    if (!encryptedData) {
      console.log(`  ✗ Failed to fetch data`);
      return false;
    }

    // Decrypt
    const decrypted = await decryptVideasyResponse(encryptedData, testCase.tmdbId);

    if (!decrypted) {
      console.log(`  ✗ Failed to decrypt`);
      return false;
    }

    // Check for stream URL (API returns 'url' not 'file')
    if (decrypted.sources && decrypted.sources.length > 0) {
      const streamUrl = decrypted.sources[0].url || decrypted.sources[0].file;
      if (streamUrl) {
        console.log(`  ✓ Stream URL: ${streamUrl.length > 80 ? streamUrl.substring(0, 80) + '...' : streamUrl}`);
        console.log(`  ✓ Quality: ${decrypted.sources[0].quality || 'auto'}`);
        
        // Check for subtitles (both 'subtitles' and 'tracks' arrays)
        const subs = decrypted.subtitles || decrypted.tracks || [];
        if (subs.length > 0) {
          console.log(`  ✓ Subtitles: ${subs.length} tracks`);
          subs.slice(0, 3).forEach(t => {
            const fileUrl = t.url || t.file || '';
            console.log(`    - ${t.label || 'Unknown'}: ${fileUrl.length > 50 ? fileUrl.substring(0, 50) + '...' : fileUrl}`);
          });
        }
        
        return true;
      }
    }

    console.log(`  ✗ No stream URL in response`);
    const responseStr = JSON.stringify(decrypted);
    console.log(`  Response:`, responseStr.length > 200 ? responseStr.substring(0, 200) + '...' : responseStr);
    return false;
  } catch (error: any) {
    console.log(`  ✗ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Videasy Extractor Test');
  console.log('='.repeat(60));

  for (const testCase of TEST_CASES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testCase.name}`);
    console.log(`TMDB ID: ${testCase.tmdbId}, Type: ${testCase.type}`);
    if (testCase.type === 'tv') {
      console.log(`Season: ${testCase.season}, Episode: ${testCase.episode}`);
    }
    console.log('='.repeat(60));

    let successCount = 0;
    
    for (const source of SOURCES) {
      const success = await testSource(
        source.name,
        source.endpoint,
        testCase,
        source.movieOnly || false
      );
      if (success) successCount++;
    }

    console.log(`\n[Summary] ${successCount}/${SOURCES.length} sources working for ${testCase.name}`);
  }
}

// Run tests
runTests().catch(console.error);
