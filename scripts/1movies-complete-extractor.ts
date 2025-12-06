/**
 * Complete 1movies/yflix extractor
 * Uses enc-dec.app API for encryption/decryption
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const API = 'https://enc-dec.app/api';
const BASE_URL = 'https://yflix.to';

// Encryption/Decryption via enc-dec.app
async function encrypt(text: string): Promise<string> {
  const res = await fetch(`${API}/enc-movies-flix?text=${encodeURIComponent(text)}`, { headers: HEADERS });
  const data = await res.json();
  return data.result;
}

async function decrypt(text: string): Promise<any> {
  const res = await fetch(`${API}/dec-movies-flix`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  return data.result;
}

async function parseHtml(html: string): Promise<any> {
  const res = await fetch(`${API}/parse-html`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: html })
  });
  const data = await res.json();
  return data.result;
}

// Search for content and get content ID
async function searchContent(query: string): Promise<{ contentId: string; slug: string; title: string } | null> {
  // Search via browser page
  const searchUrl = `${BASE_URL}/browser?keyword=${encodeURIComponent(query)}`;
  console.log('Searching:', searchUrl);
  
  const res = await fetch(searchUrl, { headers: HEADERS });
  const html = await res.text();
  
  // Find content ID from data-tip attribute
  const tipMatch = html.match(/data-tip="([a-zA-Z0-9_-]+)"/);
  const slugMatch = html.match(/href="\/watch\/([^"]+)"/);
  const titleMatch = html.match(/class="title">([^<]+)</);
  
  if (tipMatch && slugMatch) {
    return {
      contentId: tipMatch[1],
      slug: slugMatch[1],
      title: titleMatch ? titleMatch[1] : 'Unknown'
    };
  }
  
  return null;
}

// Get episodes for TV show
async function getEpisodes(contentId: string): Promise<any> {
  const encId = await encrypt(contentId);
  const url = `${BASE_URL}/ajax/episodes/list?id=${contentId}&_=${encId}`;
  
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  if (data.result) {
    return await parseHtml(data.result);
  }
  return null;
}

// Get servers for an episode/movie
async function getServers(eid: string): Promise<any[]> {
  const encEid = await encrypt(eid);
  const url = `${BASE_URL}/ajax/links/list?eid=${eid}&_=${encEid}`;
  
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  if (data.result) {
    const parsed = await parseHtml(data.result);
    return Object.values(parsed.default || parsed);
  }
  return [];
}

// Get embed URL from server
async function getEmbed(lid: string): Promise<{ url: string; subtitles?: string } | null> {
  const encLid = await encrypt(lid);
  const url = `${BASE_URL}/ajax/links/view?id=${lid}&_=${encLid}`;
  
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  if (data.result) {
    const decrypted = await decrypt(data.result);
    if (typeof decrypted === 'object' && decrypted.url) {
      return { url: decrypted.url };
    }
  }
  return null;
}

// Main extraction function
async function extract(query: string, options?: { season?: number; episode?: number }) {
  console.log('='.repeat(60));
  console.log(`1movies/yflix Extractor`);
  console.log(`Query: ${query}`);
  console.log('='.repeat(60));
  
  // Step 1: Search for content
  console.log('\n[1] Searching for content...');
  const content = await searchContent(query);
  
  if (!content) {
    console.log('❌ Content not found');
    return null;
  }
  
  console.log(`✓ Found: ${content.title}`);
  console.log(`  Content ID: ${content.contentId}`);
  console.log(`  Slug: ${content.slug}`);
  
  // Determine if it's a TV show or movie based on slug prefix
  const isTvShow = content.slug.startsWith('tv-');
  const isMovie = content.slug.startsWith('movie-');
  console.log(`  Type: ${isTvShow ? 'TV Show' : isMovie ? 'Movie' : 'Unknown (treating as movie)'}`);
  
  let eid = content.contentId;
  
  // Step 2: For TV shows, get episodes
  if (isTvShow && !isMovie) {
    console.log('\n[2] Getting episodes...');
    const episodes = await getEpisodes(content.contentId);
    
    if (episodes) {
      const seasons = Object.keys(episodes);
      console.log(`  Seasons: ${seasons.join(', ')}`);
      
      const season = options?.season || parseInt(seasons[0]);
      const episodeNum = options?.episode || 1;
      
      if (episodes[season] && episodes[season][episodeNum]) {
        eid = episodes[season][episodeNum].eid;
        console.log(`  Selected: S${season}E${episodeNum} (EID: ${eid})`);
      } else {
        console.log(`  ❌ Episode S${season}E${episodeNum} not found`);
        return null;
      }
    }
  }
  
  // Step 3: Get servers
  console.log('\n[3] Getting servers...');
  const servers = await getServers(eid);
  
  if (servers.length === 0) {
    console.log('❌ No servers found');
    return null;
  }
  
  console.log(`  Found ${servers.length} server(s):`);
  servers.forEach((s: any, i) => console.log(`    ${i + 1}. ${s.name || `Server ${s.sid}`}`));
  
  // Step 4: Get embeds from all servers
  console.log('\n[4] Getting embed URLs...');
  const results: { server: string; embed: string }[] = [];
  
  for (const server of servers) {
    const embed = await getEmbed(server.lid);
    if (embed) {
      results.push({
        server: server.name || `Server ${server.sid}`,
        embed: embed.url
      });
      console.log(`  ✓ ${server.name || `Server ${server.sid}`}: ${embed.url.substring(0, 60)}...`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  
  for (const r of results) {
    console.log(`\n${r.server}:`);
    console.log(`  ${r.embed}`);
  }
  
  return results;
}

// Test
async function main() {
  // Test with Cyberpunk Edgerunners (TV)
  await extract('cyberpunk edgerunners', { season: 1, episode: 1 });
  
  console.log('\n\n');
  
  // Test with FNAF (Movie)
  await extract('five nights at freddys');
}

main().catch(console.error);
