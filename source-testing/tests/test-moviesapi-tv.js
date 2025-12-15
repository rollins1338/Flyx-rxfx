/**
 * Test MoviesAPI TV show URL formats
 */

const urls = [
  'https://moviesapi.club/tv/1396/1/1',
  'https://moviesapi.club/tv/1396-1-1',
  'https://moviesapi.club/tv/1396/season/1/episode/1',
  'https://moviesapi.club/tv/show/1396/1/1',
  'https://moviesapi.club/tv/1396?s=1&e=1',
  'https://moviesapi.club/tv/1396?season=1&episode=1',
];

async function test() {
  for (const url of urls) {
    console.log('\nTesting:', url);
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow'
      });
      console.log('  Status:', r.status);
      if (r.ok) {
        const html = await r.text();
        const hasIframe = html.includes('vidora.stream');
        console.log('  Has Vidora:', hasIframe);
        if (hasIframe) {
          const match = html.match(/vidora\.stream\/embed\/([^\"']+)/);
          if (match) console.log('  Vidora ID:', match[1]);
        }
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
}

test().catch(console.error);
