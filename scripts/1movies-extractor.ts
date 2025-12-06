/**
 * 1movies.bz / yflix.to M3U8 Extractor
 * 
 * Uses the enc-dec.app API for encryption/decryption
 * 1movies and yflix are the same site with different domains
 */

const ENC_DEC_API = 'https://enc-dec.app/api';
const YFLIX_AJAX = 'https://yflix.to/ajax';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Connection': 'keep-alive'
};

async function encrypt(text: string): Promise<string> {
  const res = await fetch(`${ENC_DEC_API}/enc-movies-flix?text=${encodeURIComponent(text)}`);
  const data = await res.json();
  return data.result;
}

async function decrypt(text: string): Promise<string> {
  const res = await fetch(`${ENC_DEC_API}/dec-movies-flix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  return data.result;
}

async function parseHtml(html: string): Promise<any> {
  const res = await fetch(`${ENC_DEC_API}/parse-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: html })
  });
  const data = await res.json();
  return data.result;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS });
  return res.json();
}

async function extractMovie(contentId: string) {
  console.log(`\n=== Extracting Movie: ${contentId} ===\n`);
  
  // 1. Get episodes list
  console.log('1. Getting episodes list...');
  const encId = await encrypt(contentId);
  console.log('   Encrypted ID:', encId);
  
  const episodesResp = await getJson(`${YFLIX_AJAX}/episodes/list?id=${contentId}&_=${encId}`);
  console.log('   Episodes response status:', episodesResp.status);
  
  if (episodesResp.status !== 200) {
    console.log('   Error:', episodesResp.message);
    return null;
  }
  
  const episodes = await parseHtml(episodesResp.result);
  console.log('   Parsed episodes:', JSON.stringify(episodes, null, 2));
  
  // 2. Get first episode's servers
  const firstSeason = Object.keys(episodes)[0];
  const firstEpisode = Object.keys(episodes[firstSeason])[0];
  const eid = episodes[firstSeason][firstEpisode].eid;
  
  console.log(`\n2. Getting servers for episode ${firstEpisode} (eid: ${eid})...`);
  const encEid = await encrypt(eid);
  
  const serversResp = await getJson(`${YFLIX_AJAX}/links/list?eid=${eid}&_=${encEid}`);
  console.log('   Servers response status:', serversResp.status);
  
  if (serversResp.status !== 200) {
    console.log('   Error:', serversResp.message);
    return null;
  }
  
  const servers = await parseHtml(serversResp.result);
  console.log('   Parsed servers:', JSON.stringify(servers, null, 2));
  
  // 3. Get embed URL from first server
  const serverGroup = Object.keys(servers)[0];
  const firstServer = Object.keys(servers[serverGroup])[0];
  const lid = servers[serverGroup][firstServer].lid;
  
  console.log(`\n3. Getting embed for server ${firstServer} (lid: ${lid})...`);
  const encLid = await encrypt(lid);
  
  const embedResp = await getJson(`${YFLIX_AJAX}/links/view?id=${lid}&_=${encLid}`);
  console.log('   Embed response status:', embedResp.status);
  
  if (embedResp.status !== 200) {
    console.log('   Error:', embedResp.message);
    return null;
  }
  
  // 4. Decrypt the embed URL
  console.log('\n4. Decrypting embed data...');
  const decrypted = await decrypt(embedResp.result);
  
  console.log('\n' + '='.repeat(50));
  console.log('DECRYPTED DATA:');
  console.log('='.repeat(50));
  console.log(decrypted);
  
  return decrypted;
}

// Test with FNAF 2 (1movies ID: c4a7-KGm)
// Or use Cyberpunk Edgerunners (yflix ID: d4K68KU)
async function main() {
  console.log('=== 1movies/yflix M3U8 Extractor ===');
  
  // Test with the FNAF 2 movie ID from 1movies
  const fnaf2Id = 'c4a7-KGm';
  
  try {
    const result = await extractMovie(fnaf2Id);
    
    if (result) {
      // Save result
      const fs = await import('fs');
      fs.writeFileSync('1movies-extracted.txt', result);
      console.log('\nSaved to 1movies-extracted.txt');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
