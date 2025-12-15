/**
 * Test Multi-Embed Sources
 * Tests SmashyStream, MultiMovies, Cloudy, XPrime, Hexa, Flixer
 */

const DECRYPTION_API = 'https://enc-dec.app/api';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Test content
const TEST_MOVIE_TMDB = '550'; // Fight Club
const TEST_TV_TMDB = '1396'; // Breaking Bad
const TEST_SEASON = 1;
const TEST_EPISODE = 1;

// Source configurations
const SOURCES = [
  {
    name: 'SmashyStream',
    buildUrl: (tmdbId, type, season, episode) => {
      if (type === 'tv') {
        return `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
      }
      return `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`;
    },
    decryptEndpoint: 'dec-vidstack',
    decryptBody: (text) => ({ text, type: 'smashy' }),
  },
  {
    name: 'MultiMovies',
    buildUrl: (tmdbId, type, season, episode) => {
      if (type === 'tv') {
        return `https://multimovies.cloud/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return `https://multimovies.cloud/embed/movie/${tmdbId}`;
    },
    decryptEndpoint: 'dec-vidstack',
    decryptBody: (text) => ({ text, type: 'multi' }),
  },
  {
    name: 'Cloudy',
    buildUrl: (tmdbId, type, season, episode) => {
      if (type === 'tv') {
        return `https://cloudy.lol/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return `https://cloudy.lol/embed/movie/${tmdbId}`;
    },
    decryptEndpoint: 'dec-vidstack',
    decryptBody: (text) => ({ text, type: 'cloudy' }),
  },
  {
    name: 'XPrime',
    buildUrl: (tmdbId, type, season, episode) => {
      if (type === 'tv') {
        return `https://xprime.tv/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return `https://xprime.tv/embed/movie/${tmdbId}`;
    },
    decryptEndpoint: 'dec-xprime',
    decryptBody: (text) => ({ text }),
  },
  {
    name: 'Hexa',
    buildUrl: (tmdbId, type, season, episode) => {
      if (type === 'tv') {
        return `https://hexa.watch/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return `https://hexa.watch/embed/movie/${tmdbId}`;
    },
    decryptEndpoint: 'dec-hexa',
    decryptBody: (text, key) => ({ text, key: key || '' }),
    needsKey: true,
  },
  {
    name: 'Flixer',
    buildUrl: (tmdbId, type, season, episode) => {
      if (type === 'tv') {
        return `https://flixer.lol/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return `https://flixer.lol/embed/movie/${tmdbId}`;
    },
    decryptEndpoint: 'dec-hexa',
    decryptBody: (text, key) => ({ text, key: key || '' }),
    needsKey: true,
  },
];

async function fetchEmbed(url) {
  try {
    console.log(`  Fetching: ${url}`);
    const response = await fetch(url, { headers: HEADERS });
    
    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`  Got ${html.length} chars`);
    return html;
  } catch (error) {
    console.log(`  ✗ Fetch error: ${error.message}`);
    return null;
  }
}

function extractEncryptedData(html, sourceName) {
  // Try various patterns
  const patterns = [
    /sources\s*[:=]\s*["']([^"']+)["']/i,
    /data-source=["']([^"']+)["']/i,
    /encrypted\s*[:=]\s*["']([^"']+)["']/i,
    /"file"\s*:\s*"([^"]+)"/i,
    /"url"\s*:\s*"([^"]+)"/i,
    /source\s*=\s*["']([^"']{50,})["']/i,
    /["']([A-Za-z0-9+/=]{100,})["']/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      console.log(`  Found encrypted data (${match[1].length} chars)`);
      return { encrypted: match[1] };
    }
  }

  // Try long string
  const longMatch = html.match(/[A-Za-z0-9+/=_-]{200,}/);
  if (longMatch) {
    console.log(`  Found long string (${longMatch[0].length} chars)`);
    return { encrypted: longMatch[0] };
  }

  // Extract key for Hexa sources
  let key = null;
  const keyMatch = html.match(/key\s*[:=]\s*["']([^"']+)["']/i);
  if (keyMatch) {
    key = keyMatch[1];
    console.log(`  Found key: ${key}`);
  }

  console.log(`  ✗ No encrypted data found`);
  console.log(`  HTML preview: ${html.substring(0, 500)}`);
  return null;
}

async function decrypt(endpoint, body) {
  try {
    console.log(`  Decrypting via ${endpoint}...`);
    
    const response = await fetch(`${DECRYPTION_API}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.log(`  ✗ Decrypt HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    
    if (!json.result) {
      console.log(`  ✗ No result in response`);
      return null;
    }

    let result = json.result;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        if (result.includes('http')) {
          result = { sources: [{ url: result }] };
        }
      }
    }

    console.log(`  ✓ Decrypted successfully`);
    return result;
  } catch (error) {
    console.log(`  ✗ Decrypt error: ${error.message}`);
    return null;
  }
}

async function testSource(source, tmdbId, type, season, episode) {
  console.log(`\n=== Testing ${source.name} (${type}) ===`);
  
  const url = source.buildUrl(tmdbId, type, season, episode);
  const html = await fetchEmbed(url);
  
  if (!html) return false;

  const extracted = extractEncryptedData(html, source.name);
  if (!extracted) return false;

  const body = source.decryptBody(extracted.encrypted, extracted.key);
  const decrypted = await decrypt(source.decryptEndpoint, body);
  
  if (!decrypted) return false;

  if (decrypted.sources && decrypted.sources.length > 0) {
    const streamUrl = decrypted.sources[0].url || decrypted.sources[0].file;
    if (streamUrl) {
      console.log(`  ✓ Stream URL: ${streamUrl.substring(0, 80)}...`);
      return true;
    }
  }

  console.log(`  ✗ No stream URL in response`);
  console.log(`  Response:`, JSON.stringify(decrypted).substring(0, 200));
  return false;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Multi-Embed Source Testing');
  console.log('='.repeat(60));

  const results = {
    movie: {},
    tv: {},
  };

  // Test movies
  console.log('\n\n### MOVIE TESTS (Fight Club) ###');
  for (const source of SOURCES) {
    results.movie[source.name] = await testSource(source, TEST_MOVIE_TMDB, 'movie');
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }

  // Test TV
  console.log('\n\n### TV TESTS (Breaking Bad S1E1) ###');
  for (const source of SOURCES) {
    results.tv[source.name] = await testSource(source, TEST_TV_TMDB, 'tv', TEST_SEASON, TEST_EPISODE);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nMovies:');
  for (const [name, success] of Object.entries(results.movie)) {
    console.log(`  ${success ? '✓' : '✗'} ${name}`);
  }
  
  console.log('\nTV Shows:');
  for (const [name, success] of Object.entries(results.tv)) {
    console.log(`  ${success ? '✓' : '✗'} ${name}`);
  }
}

main().catch(console.error);
