/**
 * 1movies/yflix Video Extractor Service
 * 
 * Uses enc-dec.app API for encryption/decryption
 * 
 * Flow:
 * 1. Search by title -> get content ID
 * 2. Get episodes (for TV) -> get episode ID
 * 3. Get servers -> get server link IDs
 * 4. Get embed URLs from servers
 * 
 * Note: The embed URLs point to rapidairmax.site/rapidshare.cc which require
 * browser-based extraction to get the actual m3u8 stream URL.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const ENC_DEC_API = 'https://enc-dec.app/api';
const YFLIX_BASE = 'https://yflix.to';

export interface OneMoviesResult {
  title: string;
  contentId: string;
  slug: string;
  type: 'movie' | 'tv' | 'unknown';
  servers: {
    name: string;
    embedUrl: string;
  }[];
  subtitles?: {
    file: string;
    label: string;
  }[];
}

// Encryption/Decryption helpers
async function encrypt(text: string): Promise<string> {
  const res = await fetch(`${ENC_DEC_API}/enc-movies-flix?text=${encodeURIComponent(text)}`, { headers: HEADERS });
  const data = await res.json();
  return data.result;
}

async function decrypt(text: string): Promise<any> {
  const res = await fetch(`${ENC_DEC_API}/dec-movies-flix`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  return data.result;
}

async function parseHtml(html: string): Promise<any> {
  const res = await fetch(`${ENC_DEC_API}/parse-html`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: html })
  });
  const data = await res.json();
  return data.result;
}

// Search for content
async function searchContent(query: string): Promise<{ contentId: string; slug: string; title: string } | null> {
  const searchUrl = `${YFLIX_BASE}/browser?keyword=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, { headers: HEADERS });
  const html = await res.text();
  
  const tipMatch = html.match(/data-tip="([a-zA-Z0-9_-]+)"/);
  const slugMatch = html.match(/href="\/watch\/([^"]+)"/);
  const titleMatch = html.match(/class="title">([^<]+)</);
  
  if (tipMatch && slugMatch) {
    return {
      contentId: tipMatch[1],
      slug: slugMatch[1],
      title: titleMatch ? titleMatch[1].replace(/&#039;/g, "'") : 'Unknown'
    };
  }
  return null;
}

// Get episodes for TV show
async function getEpisodes(contentId: string): Promise<any> {
  const encId = await encrypt(contentId);
  const url = `${YFLIX_BASE}/ajax/episodes/list?id=${contentId}&_=${encId}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  if (data.result) {
    return await parseHtml(data.result);
  }
  return null;
}

// Get servers for episode/movie
async function getServers(eid: string): Promise<any[]> {
  const encEid = await encrypt(eid);
  const url = `${YFLIX_BASE}/ajax/links/list?eid=${eid}&_=${encEid}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  if (data.result) {
    const parsed = await parseHtml(data.result);
    return Object.values(parsed.default || parsed);
  }
  return [];
}

// Get embed URL from server
async function getEmbed(lid: string): Promise<string | null> {
  const encLid = await encrypt(lid);
  const url = `${YFLIX_BASE}/ajax/links/view?id=${lid}&_=${encLid}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  if (data.result) {
    const decrypted = await decrypt(data.result);
    if (typeof decrypted === 'object' && decrypted.url) {
      return decrypted.url;
    }
  }
  return null;
}

// Get subtitles
async function getSubtitles(episodeId: number): Promise<{ file: string; label: string }[]> {
  const url = `${YFLIX_BASE}/ajax/episode/${episodeId}/subtitles`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    const data = await res.json();
    return data.map((s: any) => ({ file: s.file, label: s.label }));
  } catch {
    return [];
  }
}

/**
 * Extract video sources from 1movies/yflix
 */
export async function extractOneMovies(
  query: string,
  options?: { season?: number; episode?: number }
): Promise<OneMoviesResult | null> {
  // Search for content
  const content = await searchContent(query);
  if (!content) return null;
  
  const isTvShow = content.slug.startsWith('tv-');
  const isMovie = content.slug.startsWith('movie-');
  const type = isTvShow ? 'tv' : isMovie ? 'movie' : 'unknown';
  
  let eid = content.contentId;
  let episodeDbId: number | null = null;
  
  // For TV shows, get episodes
  if (isTvShow) {
    const episodes = await getEpisodes(content.contentId);
    if (episodes) {
      const seasons = Object.keys(episodes);
      const season = options?.season || parseInt(seasons[0]);
      const episodeNum = options?.episode || 1;
      
      if (episodes[season]?.[episodeNum]) {
        eid = episodes[season][episodeNum].eid;
        // Extract episode DB ID from embed URL for subtitles
      }
    }
  }
  
  // Get servers
  const servers = await getServers(eid);
  const serverResults: { name: string; embedUrl: string }[] = [];
  
  for (const server of servers) {
    const embedUrl = await getEmbed(server.lid);
    if (embedUrl) {
      serverResults.push({
        name: server.name || `Server ${server.sid}`,
        embedUrl
      });
      
      // Extract episode ID from embed URL for subtitles
      const episodeMatch = embedUrl.match(/episode%2F(\d+)%2F/);
      if (episodeMatch) {
        episodeDbId = parseInt(episodeMatch[1]);
      }
    }
  }
  
  // Get subtitles if we have episode ID
  let subtitles: { file: string; label: string }[] = [];
  if (episodeDbId) {
    subtitles = await getSubtitles(episodeDbId);
  }
  
  return {
    title: content.title,
    contentId: content.contentId,
    slug: content.slug,
    type,
    servers: serverResults,
    subtitles
  };
}

// Export for testing
export { searchContent, getEpisodes, getServers, getEmbed, getSubtitles };
