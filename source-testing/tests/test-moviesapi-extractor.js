/**
 * Test the MoviesAPI extractor logic
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function unpack(packed, base, count, words) {
  let unpacked = packed;
  let c = count;
  
  while (c--) {
    if (words[c]) {
      unpacked = unpacked.replace(new RegExp('\\b' + c.toString(base) + '\\b', 'g'), words[c]);
    }
  }
  
  return unpacked;
}

function extractFromVidora(html) {
  const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (evalStart === -1) return null;
  
  const evalEnd = html.indexOf("</script>", evalStart);
  const evalScript = html.substring(evalStart, evalEnd);
  
  const splitIdx = evalScript.lastIndexOf(".split('|')");
  if (splitIdx === -1) return null;
  
  const wordListStart = evalScript.lastIndexOf(",'", splitIdx) + 2;
  const wordStr = evalScript.substring(wordListStart, splitIdx);
  const words = wordStr.split('|');
  
  const beforeWords = evalScript.substring(0, wordListStart - 2);
  const numbersMatch = beforeWords.match(/,(\d+),(\d+)$/);
  if (!numbersMatch) return null;
  
  const base = parseInt(numbersMatch[1]);
  const count = parseInt(numbersMatch[2]);
  
  const packedStart = evalScript.indexOf("('") + 2;
  const packedEnd = evalScript.indexOf("'," + base + "," + count);
  const packed = evalScript.substring(packedStart, packedEnd);
  
  const unpacked = unpack(packed, base, count, words);
  
  const fileMatch = unpacked.match(/file:"([^"]+\.m3u8[^"]*)"/);
  if (!fileMatch) return null;
  
  const streamUrl = fileMatch[1];
  
  // Extract subtitles
  const subtitles = [];
  const trackPattern = /\{file:"([^"]+\.vtt)",label:"([^"]+)",kind:"captions"[^}]*\}/g;
  let trackMatch;
  
  while ((trackMatch = trackPattern.exec(unpacked)) !== null) {
    subtitles.push({
      label: trackMatch[2],
      url: trackMatch[1],
    });
  }
  
  return { streamUrl, subtitles };
}

async function testMoviesAPI(tmdbId, type = 'movie', season, episode) {
  console.log(`\n=== Testing MoviesAPI: ${type} ${tmdbId} ===\n`);
  
  // Step 1: Get MoviesAPI embed page
  let embedUrl;
  if (type === 'movie') {
    embedUrl = `https://moviesapi.club/movie/${tmdbId}`;
  } else {
    embedUrl = `https://moviesapi.club/tv/${tmdbId}/${season}/${episode}`;
  }
  
  console.log(`Fetching: ${embedUrl}`);
  
  const response1 = await fetch(embedUrl, { headers: HEADERS });
  console.log(`Status: ${response1.status}`);
  
  if (!response1.ok) {
    console.log('Failed to fetch MoviesAPI page');
    return;
  }
  
  const html1 = await response1.text();
  
  // Step 2: Extract Vidora iframe URL
  const iframeMatch = html1.match(/<iframe[^>]*src=["']([^"']+vidora\.stream[^"']+)["']/i);
  
  if (!iframeMatch) {
    console.log('No Vidora iframe found');
    return;
  }
  
  const vidoraUrl = iframeMatch[1];
  console.log(`Vidora URL: ${vidoraUrl}`);
  
  // Step 3: Fetch Vidora embed page
  const response2 = await fetch(vidoraUrl, {
    headers: { ...HEADERS, 'Referer': 'https://moviesapi.club/' }
  });
  
  console.log(`Vidora status: ${response2.status}`);
  
  if (!response2.ok) {
    console.log('Failed to fetch Vidora page');
    return;
  }
  
  const html2 = await response2.text();
  
  // Step 4: Extract stream data
  const extracted = extractFromVidora(html2);
  
  if (!extracted) {
    console.log('Failed to extract stream');
    return;
  }
  
  console.log('\n=== SUCCESS ===');
  console.log(`Stream URL: ${extracted.streamUrl}`);
  console.log(`Subtitles: ${extracted.subtitles.length}`);
  
  for (const sub of extracted.subtitles) {
    console.log(`  - ${sub.label}: ${sub.url}`);
  }
  
  // Test the stream URL
  console.log('\n=== Testing Stream URL ===');
  const streamResponse = await fetch(extracted.streamUrl, {
    headers: {
      'User-Agent': HEADERS['User-Agent'],
      'Referer': 'https://vidora.stream/',
      'Origin': 'https://vidora.stream'
    }
  });
  
  console.log(`Stream status: ${streamResponse.status}`);
  console.log(`Content-Type: ${streamResponse.headers.get('content-type')}`);
  
  if (streamResponse.ok) {
    const streamText = await streamResponse.text();
    console.log(`Stream length: ${streamText.length}`);
    console.log(`Is M3U8: ${streamText.includes('#EXTM3U')}`);
  }
}

async function main() {
  // Test movie (Fight Club)
  await testMoviesAPI('550', 'movie');
  
  // Test TV show (Breaking Bad S1E1)
  await testMoviesAPI('1396', 'tv', 1, 1);
}

main().catch(console.error);
