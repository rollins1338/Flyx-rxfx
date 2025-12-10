/**
 * Test script for 1movies extractor via videasy API
 */

const VIDEASY_API_BASE = 'https://api.videasy.net';
const DECRYPTION_API = 'https://enc-dec.app/api';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
};

async function fetchFrom1Movies(
  tmdbId: string,
  title: string,
  year: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<string | null> {
  let url = `${VIDEASY_API_BASE}/1movies/sources-with-title?title=${encodeURIComponent(title)}&mediaType=${type}&year=${year}&tmdbId=${tmdbId}`;
  
  if (type === 'tv' && season !== undefined && episode !== undefined) {
    url += `&seasonId=${season}&episodeId=${episode}`;
  }

  console.log(`Fetching: ${url}`);

  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    console.log(`HTTP ${response.status}`);
    return null;
  }

  const text = await response.text();
  console.log(`Got encrypted response (${text.length} chars)`);
  return text;
}

async function decryptVideasyResponse(encryptedText: string, tmdbId: string): Promise<any> {
  console.log(`Decrypting via dec-videasy...`);

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
  });

  if (!response.ok) {
    console.log(`Decryption failed: HTTP ${response.status}`);
    return null;
  }

  const json = await response.json();
  console.log('Decryption response:', JSON.stringify(json, null, 2));
  
  if (!json.result) {
    console.log('No result in response');
    return null;
  }

  // Parse if string
  if (typeof json.result === 'string') {
    try {
      return JSON.parse(json.result);
    } catch {
      console.log('Failed to parse result as JSON');
      return null;
    }
  }

  return json.result;
}

async function testMovie(title: string, year: string, tmdbId: string) {
  console.log('='.repeat(60));
  console.log(`Testing Movie: ${title} (${year})`);
  console.log(`TMDB ID: ${tmdbId}`);
  console.log('='.repeat(60));

  const encrypted = await fetchFrom1Movies(tmdbId, title, year, 'movie');
  if (!encrypted) {
    console.log('❌ Failed to fetch');
    return;
  }

  const decrypted = await decryptVideasyResponse(encrypted, tmdbId);
  if (!decrypted) {
    console.log('❌ Failed to decrypt');
    return;
  }

  console.log('\n✅ SUCCESS!');
  if (decrypted.sources && decrypted.sources.length > 0) {
    const url = decrypted.sources[0].url || decrypted.sources[0].file;
    console.log(`M3U8 URL: ${url}`);
  }
  if (decrypted.tracks) {
    console.log(`Tracks: ${decrypted.tracks.length}`);
  }
}

async function testTvShow(title: string, year: string, tmdbId: string, season: number, episode: number) {
  console.log('='.repeat(60));
  console.log(`Testing TV: ${title} (${year}) S${season}E${episode}`);
  console.log(`TMDB ID: ${tmdbId}`);
  console.log('='.repeat(60));

  const encrypted = await fetchFrom1Movies(tmdbId, title, year, 'tv', season, episode);
  if (!encrypted) {
    console.log('❌ Failed to fetch');
    return;
  }

  const decrypted = await decryptVideasyResponse(encrypted, tmdbId);
  if (!decrypted) {
    console.log('❌ Failed to decrypt');
    return;
  }

  console.log('\n✅ SUCCESS!');
  if (decrypted.sources && decrypted.sources.length > 0) {
    const url = decrypted.sources[0].url || decrypted.sources[0].file;
    console.log(`M3U8 URL: ${url}`);
  }
  if (decrypted.tracks) {
    console.log(`Tracks: ${decrypted.tracks.length}`);
  }
}

async function main() {
  // Test with Fight Club (movie)
  await testMovie('Fight Club', '1999', '550');
  
  console.log('\n\n');
  
  // Test with Cyberpunk Edgerunners (TV)
  await testTvShow('Cyberpunk: Edgerunners', '2022', '105248', 1, 1);
  
  console.log('\n\n');
  
  // Test with Breaking Bad (TV)
  await testTvShow('Breaking Bad', '2008', '1396', 1, 1);
}

main().catch(console.error);
