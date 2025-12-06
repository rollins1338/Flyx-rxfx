/**
 * 1movies.bz extractor using TMDB ID mapping
 * Flow: TMDB ID -> ajax search -> get content ID -> get servers -> get m3u8
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Requested-With': 'XMLHttpRequest',
};

const BASE_URL = 'https://1movies.bz';
const API = 'https://enc-dec.app/api';

async function encrypt(text: string): Promise<string> {
  const res = await fetch(`${API}/enc-movies-flix?text=${encodeURIComponent(text)}`, {
    headers: { 'User-Agent': HEADERS['User-Agent'] }
  });
  const data = await res.json();
  return data.result;
}

async function decrypt(text: string): Promise<any> {
  const res = await fetch(`${API}/dec-movies-flix`, {
    method: 'POST',
    headers: { 'User-Agent': HEADERS['User-Agent'], 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  return data.result;
}

async function parseHtml(html: string): Promise<any> {
  const res = await fetch(`${API}/parse-html`, {
    method: 'POST',
    headers: { 'User-Agent': HEADERS['User-Agent'], 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: html })
  });
  const data = await res.json();
  return data.result;
}

async function searchByTmdbId(tmdbId: number, type: 'movie' | 'tv'): Promise<any> {
  console.log(`\nSearching 1movies.bz for TMDB ${type} ID: ${tmdbId}`);
  
  // The search URL is /filter?keyword=
  // First try searching by TMDB ID directly
  const searchUrl = `${BASE_URL}/filter?keyword=${tmdbId}&type=${type === 'movie' ? '1' : '2'}`;
  
  console.log('Search URL:', searchUrl);
  
  const res = await fetch(searchUrl, {
    headers: {
      ...HEADERS,
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': BASE_URL
    }
  });
  
  const html = await res.text();
  console.log('Search page length:', html.length);
  
  // Look for movie/show links in the results
  const slugMatches = html.match(/href="\/watch\/([^"]+)"/g);
  if (slugMatches) {
    console.log('Found slugs:', slugMatches.slice(0, 5));
  }
  
  return { html, slugMatches };
}

async function getContentIdFromSlug(slug: string): Promise<string | null> {
  // Fetch the page to get the content ID
  const url = `${BASE_URL}/watch/${slug}`;
  console.log(`\nFetching page: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': BASE_URL
    }
  });
  
  const html = await res.text();
  
  // Look for content ID in the page
  const idMatch = html.match(/data-id="([^"]+)"/);
  if (idMatch) {
    console.log('Found content ID:', idMatch[1]);
    return idMatch[1];
  }
  
  // Try other patterns
  const patterns = [
    /content-id="([^"]+)"/,
    /data-content="([^"]+)"/,
    /"id"\s*:\s*"([^"]+)"/,
    /\/ajax\/[^/]+\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      console.log(`Found ID with pattern ${pattern}:`, match[1]);
      return match[1];
    }
  }
  
  // Save HTML for debugging
  const fs = await import('fs');
  fs.writeFileSync('1movies-page-debug.html', html);
  console.log('Saved page to 1movies-page-debug.html');
  
  return null;
}

async function getServers(contentId: string, isMovie: boolean = true): Promise<any[]> {
  console.log(`\nGetting servers for content ID: ${contentId}`);
  
  const encId = await encrypt(contentId);
  console.log('Encrypted ID:', encId);
  
  let eid = contentId;
  
  // For TV shows, need to get episodes first
  if (!isMovie) {
    const episodesUrl = `${BASE_URL}/ajax/episodes/list?id=${contentId}&_=${encId}`;
    console.log('Fetching episodes:', episodesUrl);
    
    const episodesRes = await fetch(episodesUrl, {
      headers: { ...HEADERS, 'Referer': BASE_URL }
    });
    const episodesData = await episodesRes.json();
    console.log('Episodes response:', JSON.stringify(episodesData).substring(0, 300));
    
    if (episodesData.result) {
      const episodes = await parseHtml(episodesData.result);
      console.log('Parsed episodes:', JSON.stringify(episodes).substring(0, 300));
      
      // Get first episode
      const firstSeason = Object.keys(episodes)[0];
      const firstEp = Object.keys(episodes[firstSeason])[0];
      eid = episodes[firstSeason][firstEp].eid;
      console.log(`Using episode S${firstSeason}E${firstEp}, EID: ${eid}`);
    }
  }
  
  // Get servers
  const encEid = await encrypt(eid);
  const serversUrl = `${BASE_URL}/ajax/links/list?eid=${eid}&_=${encEid}`;
  console.log('Fetching servers:', serversUrl);
  
  const serversRes = await fetch(serversUrl, {
    headers: { ...HEADERS, 'Referer': BASE_URL }
  });
  const serversData = await serversRes.json();
  console.log('Servers response:', JSON.stringify(serversData).substring(0, 300));
  
  if (serversData.result) {
    const servers = await parseHtml(serversData.result);
    console.log('Parsed servers:', JSON.stringify(servers, null, 2));
    return Object.values(servers.default || servers);
  }
  
  return [];
}

async function getEmbedUrl(lid: string): Promise<string | null> {
  console.log(`\nGetting embed for LID: ${lid}`);
  
  const encLid = await encrypt(lid);
  const embedUrl = `${BASE_URL}/ajax/links/view?id=${lid}&_=${encLid}`;
  
  const res = await fetch(embedUrl, {
    headers: { ...HEADERS, 'Referer': BASE_URL }
  });
  const data = await res.json();
  console.log('Embed response (encrypted):', data.result?.substring(0, 100));
  
  if (data.result) {
    const decrypted = await decrypt(data.result);
    console.log('Decrypted:', decrypted);
    
    if (typeof decrypted === 'object' && decrypted.url) {
      return decrypted.url;
    }
    if (typeof decrypted === 'string') {
      const match = decrypted.match(/url:\s*['"]([^'"]+)['"]/);
      return match ? match[1] : decrypted;
    }
  }
  
  return null;
}

async function extractByTmdbId(tmdbId: number, type: 'movie' | 'tv' = 'movie') {
  console.log('='.repeat(60));
  console.log(`1movies.bz Extractor - TMDB ${type.toUpperCase()} ID: ${tmdbId}`);
  console.log('='.repeat(60));
  
  // Step 1: Search for the content
  const searchResult = await searchByTmdbId(tmdbId, type);
  
  if (!searchResult.slugMatches || searchResult.slugMatches.length === 0) {
    console.log('No search results found');
    return null;
  }
  
  // Extract first slug
  const firstMatch = searchResult.slugMatches[0];
  const slugMatch = firstMatch.match(/href="\/watch\/([^"]+)"/);
  let slug: string | null = slugMatch ? slugMatch[1] : null;
  
  if (!slug) {
    console.log('Could not find slug from search');
    return null;
  }
  
  console.log('Found slug:', slug);
  
  // Step 2: Get content ID from the page
  const contentId = await getContentIdFromSlug(slug);
  if (!contentId) {
    console.log('Could not find content ID');
    return null;
  }
  
  // Step 3: Get servers
  const servers = await getServers(contentId, type === 'movie');
  if (servers.length === 0) {
    console.log('No servers found');
    return null;
  }
  
  // Step 4: Get embed URLs from all servers
  const results: { server: string; embedUrl: string }[] = [];
  
  for (const server of servers) {
    const embedUrl = await getEmbedUrl(server.lid);
    if (embedUrl) {
      results.push({
        server: server.name || `Server ${server.sid}`,
        embedUrl
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`\n${r.server}:`);
    console.log(`  ${r.embedUrl}`);
  });
  
  return results;
}

// Test with FNAF (TMDB movie ID: 507089)
// Test with Cyberpunk Edgerunners (TMDB TV ID: 105248)
const FNAF_TMDB_ID = 507089;
const CYBERPUNK_TMDB_ID = 105248;

async function main() {
  // Test movie
  console.log('\n\n========== TESTING MOVIE ==========\n');
  await extractByTmdbId(FNAF_TMDB_ID, 'movie');
  
  // Test TV show
  console.log('\n\n========== TESTING TV SHOW ==========\n');
  await extractByTmdbId(CYBERPUNK_TMDB_ID, 'tv');
}

main().catch(console.error);
