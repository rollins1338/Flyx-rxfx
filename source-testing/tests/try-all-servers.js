/**
 * Try all AnimeKai servers to find one that works without MegaUp
 */

const ENC_DEC_API = 'https://enc-dec.app';
const KAI_AJAX = 'https://animekai.to/ajax';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function encrypt(text) {
  const response = await fetch(`${ENC_DEC_API}/api/enc-kai?text=${encodeURIComponent(text)}`, { headers: HEADERS });
  if (!response.ok) throw new Error(`Encrypt failed: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function decrypt(text) {
  const response = await fetch(`${ENC_DEC_API}/api/dec-kai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...HEADERS },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Decrypt failed: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function parseHtml(html) {
  const response = await fetch(`${ENC_DEC_API}/api/parse-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...HEADERS },
    body: JSON.stringify({ text: html }),
  });
  if (!response.ok) throw new Error(`Parse failed: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function main() {
  console.log('Testing all AnimeKai servers for One Piece Episode 646...\n');
  
  // Get anime from database (One Piece MAL ID = 21)
  const searchResponse = await fetch(`${ENC_DEC_API}/db/kai/find?mal_id=21`, { headers: HEADERS });
  const searchData = await searchResponse.json();
  const anime = Array.isArray(searchData) ? searchData[0] : searchData;
  
  console.log('Anime:', anime.info.title_en);
  
  // Get episode token for episode 646
  const episodeToken = anime.episodes['1']['646'].token;
  console.log('Episode token:', episodeToken);
  
  // Get servers
  const encToken = await encrypt(episodeToken);
  const serversUrl = `${KAI_AJAX}/links/list?token=${episodeToken}&_=${encToken}`;
  const serversResponse = await fetch(serversUrl, { headers: HEADERS });
  const serversData = await serversResponse.json();
  const servers = await parseHtml(serversData.result);
  
  console.log('\nAvailable servers:');
  console.log('- Sub:', servers.sub ? Object.keys(servers.sub).map(k => servers.sub[k].name) : 'none');
  console.log('- Softsub:', servers.softsub ? Object.keys(servers.softsub).map(k => servers.softsub[k].name) : 'none');
  console.log('- Dub:', servers.dub ? Object.keys(servers.dub).map(k => servers.dub[k].name) : 'none');
  
  // Try each server
  const allServers = [];
  for (const type of ['sub', 'softsub', 'dub']) {
    if (servers[type]) {
      for (const [key, server] of Object.entries(servers[type])) {
        allServers.push({ type, key, ...server });
      }
    }
  }
  
  console.log(`\nTrying ${allServers.length} servers...\n`);
  
  for (const server of allServers) {
    console.log(`\n--- ${server.name} (${server.type}) ---`);
    console.log('LID:', server.lid);
    
    try {
      const encLid = await encrypt(server.lid);
      const embedUrl = `${KAI_AJAX}/links/view?id=${server.lid}&_=${encLid}`;
      const embedResponse = await fetch(embedUrl, { headers: HEADERS });
      const embedData = await embedResponse.json();
      
      if (!embedData.result) {
        console.log('No result');
        continue;
      }
      
      const decrypted = await decrypt(embedData.result);
      console.log('Decrypted:', JSON.stringify(decrypted).substring(0, 200));
      
      const streamData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
      const streamUrl = streamData.url || streamData.file;
      
      console.log('Stream URL:', streamUrl);
      
      // Check if it's a direct m3u8 or needs further decryption
      if (streamUrl.includes('.m3u8')) {
        console.log('✓ DIRECT M3U8 FOUND!');
      } else if (streamUrl.includes('/e/')) {
        console.log('⚠ Embed URL - needs decryption');
        
        // Check which host
        if (streamUrl.includes('megaup')) {
          console.log('  Host: MegaUp');
        } else if (streamUrl.includes('rapid')) {
          console.log('  Host: RapidShare');
        } else {
          console.log('  Host: Unknown -', new URL(streamUrl).hostname);
        }
      }
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

main().catch(console.error);
