/**
 * Test the full AnimeKai extraction flow
 * Tests: TMDB 37854 (One Piece), Season 16, Episode 646
 */

const ENC_DEC_API = 'https://enc-dec.app';
const KAI_AJAX = 'https://animekai.to/ajax';
const ARM_API = 'https://arm.haglund.dev/api/v2/ids';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function encrypt(text) {
  const response = await fetch(`${ENC_DEC_API}/api/enc-kai?text=${encodeURIComponent(text)}`, { headers: HEADERS });
  const data = await response.json();
  return data.result || null;
}

async function decrypt(text) {
  const response = await fetch(`${ENC_DEC_API}/api/dec-kai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...HEADERS },
    body: JSON.stringify({ text }),
  });
  const data = await response.json();
  return data.result || null;
}

async function parseHtml(html) {
  const response = await fetch(`${ENC_DEC_API}/api/parse-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...HEADERS },
    body: JSON.stringify({ text: html }),
  });
  const data = await response.json();
  return data.result || null;
}

async function decryptMegaUpEmbed(embedUrl) {
  console.log(`\n=== Decrypting MegaUp embed ===`);
  console.log(`Embed URL: ${embedUrl}`);
  
  const urlMatch = embedUrl.match(/^(https?:\/\/[^/]+)\/e\/([^/?#]+)/);
  if (!urlMatch) {
    console.log('Invalid MegaUp embed URL format');
    return null;
  }
  
  const [, baseUrl, videoId] = urlMatch;
  console.log(`Base URL: ${baseUrl}, Video ID: ${videoId}`);
  
  // Step 1: Fetch /media/{videoId}
  const mediaUrl = `${baseUrl}/media/${videoId}`;
  console.log(`Fetching: ${mediaUrl}`);
  
  const mediaResponse = await fetch(mediaUrl, {
    headers: { ...HEADERS, 'Referer': embedUrl },
  });
  
  if (!mediaResponse.ok) {
    console.log(`Media request failed: ${mediaResponse.status}`);
    return null;
  }
  
  const mediaData = await mediaResponse.json();
  if (!mediaData.result) {
    console.log('No result in media response');
    return null;
  }
  
  console.log(`Got encrypted data (${mediaData.result.length} chars)`);
  
  // Step 2: Decrypt with enc-dec.app
  const decryptResponse = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...HEADERS },
    body: JSON.stringify({ text: mediaData.result, agent: HEADERS['User-Agent'] }),
  });
  
  const decryptData = await decryptResponse.json();
  
  if (decryptData.result) {
    const streamData = typeof decryptData.result === 'string' 
      ? JSON.parse(decryptData.result) 
      : decryptData.result;
    
    const streamUrl = streamData.sources?.[0]?.file || streamData.file;
    console.log(`✓ Got stream URL: ${streamUrl?.substring(0, 80)}...`);
    return streamUrl;
  }
  
  console.log('Decryption failed');
  return null;
}

async function main() {
  const tmdbId = '37854';
  const episode = 646;
  const title = 'One Piece'; // Fallback title
  
  console.log(`\n========================================`);
  console.log(`Testing AnimeKai extraction`);
  console.log(`TMDB ID: ${tmdbId}, Episode: ${episode}`);
  console.log(`========================================\n`);
  
  // Step 1: Search AnimeKai by title
  console.log('Step 1: Searching AnimeKai database by title...');
  const searchResponse = await fetch(`${ENC_DEC_API}/db/kai/search?query=${encodeURIComponent(title)}`, { headers: HEADERS });
  const searchData = await searchResponse.json();
  const result = Array.isArray(searchData) ? searchData[0] : searchData;
  
  if (!result?.info?.kai_id) {
    console.log('Anime not found in database');
    return;
  }
  
  const contentId = result.info.kai_id;
  console.log(`Found: ${result.info.title_en} (kai_id: ${contentId})`);
  
  // Step 3: Get episodes
  console.log('\nStep 3: Getting episodes...');
  let episodes = result.episodes;
  
  if (!episodes) {
    const encId = await encrypt(contentId);
    const epResponse = await fetch(`${KAI_AJAX}/episodes/list?ani_id=${contentId}&_=${encId}`, { headers: HEADERS });
    const epData = await epResponse.json();
    episodes = await parseHtml(epData.result);
  }
  
  // Find episode token
  const episodeKey = String(episode);
  let episodeToken = null;
  
  // Check season "1" first
  if (episodes["1"]?.[episodeKey]?.token) {
    episodeToken = episodes["1"][episodeKey].token;
  } else if (episodes[episodeKey]?.token) {
    episodeToken = episodes[episodeKey].token;
  }
  
  if (!episodeToken) {
    console.log(`Episode ${episode} not found`);
    console.log('Available episodes:', Object.keys(episodes["1"] || episodes));
    return;
  }
  
  console.log(`Found episode ${episode} token: ${episodeToken.substring(0, 30)}...`);
  
  // Step 4: Get servers
  console.log('\nStep 4: Getting servers...');
  const encToken = await encrypt(episodeToken);
  const serverResponse = await fetch(`${KAI_AJAX}/links/list?token=${episodeToken}&_=${encToken}`, { headers: HEADERS });
  const serverData = await serverResponse.json();
  const servers = await parseHtml(serverData.result);
  
  console.log('Sub servers:', servers.sub ? Object.keys(servers.sub) : 'none');
  console.log('Dub servers:', servers.dub ? Object.keys(servers.dub) : 'none');
  
  // Step 5: Get stream from first server
  console.log('\nStep 5: Getting stream from first server...');
  const firstServer = servers.sub?.["1"] || servers.dub?.["1"];
  
  if (!firstServer?.lid) {
    console.log('No server found');
    return;
  }
  
  console.log(`Server: ${firstServer.name}, lid: ${firstServer.lid.substring(0, 30)}...`);
  
  const encLid = await encrypt(firstServer.lid);
  const embedResponse = await fetch(`${KAI_AJAX}/links/view?id=${firstServer.lid}&_=${encLid}`, { headers: HEADERS });
  const embedData = await embedResponse.json();
  
  const decrypted = await decrypt(embedData.result);
  const streamData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
  
  console.log(`Embed URL: ${streamData.url}`);
  
  // Step 6: Decrypt MegaUp embed
  if (streamData.url.includes('megaup') && streamData.url.includes('/e/')) {
    const hlsUrl = await decryptMegaUpEmbed(streamData.url);
    
    if (hlsUrl) {
      console.log('\n========================================');
      console.log('✓✓✓ EXTRACTION SUCCESSFUL! ✓✓✓');
      console.log('========================================');
      console.log(`\nFinal HLS URL: ${hlsUrl}`);
    } else {
      console.log('\n✗ Failed to decrypt MegaUp embed');
    }
  } else {
    console.log(`\nDirect stream URL: ${streamData.url}`);
  }
}

main().catch(console.error);
