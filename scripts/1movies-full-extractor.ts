/**
 * 1movies.bz / yflix.to Full M3U8 Extractor
 * 
 * Uses the enc-dec.app API for encryption/decryption
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

async function decrypt(text: string): Promise<any> {
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

interface EmbedResult {
  url: string;
  subtitles?: string;
}

interface ExtractionResult {
  contentId: string;
  episodes: any;
  servers: any;
  embedUrl: string;
  subtitles?: string;
}

async function extractFromContentId(contentId: string): Promise<ExtractionResult | null> {
  console.log(`\n=== Extracting: ${contentId} ===\n`);
  
  // 1. Get episodes list
  console.log('1. Getting episodes list...');
  const encId = await encrypt(contentId);
  const episodesResp = await getJson(`${YFLIX_AJAX}/episodes/list?id=${contentId}&_=${encId}`);
  
  if (episodesResp.status !== 200) {
    console.log('   Error:', episodesResp.message);
    return null;
  }
  
  const episodes = await parseHtml(episodesResp.result);
  console.log('   Episodes:', JSON.stringify(episodes, null, 2));
  
  // 2. Get servers for first episode
  const firstSeason = Object.keys(episodes)[0];
  const firstEpisode = Object.keys(episodes[firstSeason])[0];
  const eid = episodes[firstSeason][firstEpisode].eid;
  
  console.log(`\n2. Getting servers (eid: ${eid})...`);
  const encEid = await encrypt(eid);
  const serversResp = await getJson(`${YFLIX_AJAX}/links/list?eid=${eid}&_=${encEid}`);
  
  if (serversResp.status !== 200) {
    console.log('   Error:', serversResp.message);
    return null;
  }
  
  const servers = await parseHtml(serversResp.result);
  console.log('   Servers:', JSON.stringify(servers, null, 2));
  
  // 3. Get embed URL from first server
  const serverGroup = Object.keys(servers)[0];
  const firstServer = Object.keys(servers[serverGroup])[0];
  const lid = servers[serverGroup][firstServer].lid;
  
  console.log(`\n3. Getting embed (lid: ${lid})...`);
  const encLid = await encrypt(lid);
  const embedResp = await getJson(`${YFLIX_AJAX}/links/view?id=${lid}&_=${encLid}`);
  
  if (embedResp.status !== 200) {
    console.log('   Error:', embedResp.message);
    return null;
  }
  
  // 4. Decrypt
  console.log('\n4. Decrypting...');
  const decrypted: EmbedResult = await decrypt(embedResp.result);
  console.log('   Decrypted:', decrypted);
  
  return {
    contentId,
    episodes,
    servers,
    embedUrl: decrypted.url,
    subtitles: decrypted.subtitles
  };
}

async function extractM3u8FromEmbed(embedUrl: string): Promise<string | null> {
  console.log(`\n=== Extracting M3U8 from: ${embedUrl} ===\n`);
  
  try {
    // Fetch the embed page
    const res = await fetch(embedUrl, { headers: HEADERS });
    const html = await res.text();
    
    console.log('Embed page length:', html.length);
    
    // Look for m3u8 URLs in the page
    const m3u8Pattern = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi;
    const m3u8Matches = html.match(m3u8Pattern);
    
    if (m3u8Matches && m3u8Matches.length > 0) {
      console.log('Found M3U8 URLs:', m3u8Matches);
      return m3u8Matches[0];
    }
    
    // Look for source URLs
    const sourcePattern = /source['":\s]+['"]?(https?:\/\/[^"'\s]+)['"]?/gi;
    const sourceMatches = html.match(sourcePattern);
    console.log('Source patterns:', sourceMatches);
    
    // Look for file URLs
    const filePattern = /file['":\s]+['"]?(https?:\/\/[^"'\s]+)['"]?/gi;
    const fileMatches = html.match(filePattern);
    console.log('File patterns:', fileMatches);
    
    // Save HTML for analysis
    const fs = await import('fs');
    fs.writeFileSync('embed-page.html', html);
    console.log('Saved embed page to embed-page.html');
    
    return null;
  } catch (error) {
    console.error('Error fetching embed:', error);
    return null;
  }
}

async function main() {
  console.log('=== 1movies/yflix Full M3U8 Extractor ===');
  
  // FNAF 2 movie ID
  const contentId = 'c4a7-KGm';
  
  try {
    // Step 1: Get embed URL
    const result = await extractFromContentId(contentId);
    
    if (!result) {
      console.log('Failed to extract embed URL');
      return;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('EMBED URL:', result.embedUrl);
    if (result.subtitles) {
      console.log('SUBTITLES:', result.subtitles);
    }
    console.log('='.repeat(50));
    
    // Step 2: Extract M3U8 from embed
    const m3u8 = await extractM3u8FromEmbed(result.embedUrl);
    
    if (m3u8) {
      console.log('\n🎯 M3U8 URL:', m3u8);
    } else {
      console.log('\nM3U8 not found directly in embed page.');
      console.log('The embed URL may require browser execution to get the stream.');
    }
    
    // Save results
    const fs = await import('fs');
    fs.writeFileSync('1movies-result.json', JSON.stringify(result, null, 2));
    console.log('\nSaved results to 1movies-result.json');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
