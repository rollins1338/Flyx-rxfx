/**
 * Test script for 1movies/yflix extractor
 * Tests the dec-rapid integration
 */

const ENC_DEC_API = 'https://enc-dec.app/api';
const YFLIX_BASE = 'https://yflix.to';
const YFLIX_AJAX = `${YFLIX_BASE}/ajax`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
};

async function encrypt(text: string): Promise<string> {
  const res = await fetch(`${ENC_DEC_API}/enc-movies-flix?text=${encodeURIComponent(text)}`, { headers: HEADERS });
  const data = await res.json();
  return data.result || '';
}

async function decryptYflix(text: string): Promise<any> {
  const res = await fetch(`${ENC_DEC_API}/dec-movies-flix`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  return data.result;
}

async function parseHtml(html: string): Promise<any> {
  const res = await fetch(`${ENC_DEC_API}/parse-html`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: html }),
  });
  const data = await res.json();
  return data.result;
}

async function decryptRapidPageData(pageData: string): Promise<any> {
  console.log(`\nDecrypting PAGE_DATA via dec-rapid (${pageData.length} chars)...`);
  
  // dec-rapid requires: text, agent, and optionally cookie
  const res = await fetch(`${ENC_DEC_API}/dec-rapid`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: pageData,
      agent: HEADERS['User-Agent'],
      cookie: '',
    }),
  });
  
  const data = await res.json();
  console.log('dec-rapid response status:', data.status);
  console.log('dec-rapid response:', JSON.stringify(data, null, 2));
  
  return data;
}

async function searchYflix(query: string): Promise<any> {
  const searchUrl = `${YFLIX_BASE}/browser?keyword=${encodeURIComponent(query)}`;
  console.log(`Searching: ${searchUrl}`);
  
  const res = await fetch(searchUrl, {
    headers: { ...HEADERS, 'Referer': YFLIX_BASE },
  });
  
  const html = await res.text();
  
  const tipMatch = html.match(/data-tip="([a-zA-Z0-9_-]+)"/);
  const slugMatch = html.match(/href="\/watch\/([^"]+)"/);
  const titleMatch = html.match(/class="title">([^<]+)</);
  
  if (tipMatch && slugMatch) {
    return {
      contentId: tipMatch[1],
      slug: slugMatch[1],
      title: titleMatch ? titleMatch[1] : 'Unknown',
      isMovie: slugMatch[1].startsWith('movie-'),
    };
  }
  
  return null;
}

async function getServers(eid: string): Promise<any[]> {
  const encEid = await encrypt(eid);
  const url = `${YFLIX_AJAX}/links/list?eid=${eid}&_=${encEid}`;
  console.log(`Getting servers: ${url}`);
  
  const res = await fetch(url, {
    headers: { ...HEADERS, 'Referer': YFLIX_BASE },
  });
  
  const data = await res.json();
  if (data.status !== 200 || !data.result) return [];
  
  const parsed = await parseHtml(data.result);
  if (!parsed) return [];
  
  const servers: any[] = [];
  for (const group of Object.values(parsed)) {
    if (typeof group === 'object' && group !== null) {
      for (const server of Object.values(group as Record<string, any>)) {
        if (server && server.lid) {
          servers.push(server);
        }
      }
    }
  }
  
  return servers;
}

async function getEmbedUrl(lid: string): Promise<any> {
  const encLid = await encrypt(lid);
  const url = `${YFLIX_AJAX}/links/view?id=${lid}&_=${encLid}`;
  console.log(`Getting embed: ${url}`);
  
  const res = await fetch(url, {
    headers: { ...HEADERS, 'Referer': YFLIX_BASE },
  });
  
  const data = await res.json();
  if (data.status !== 200 || !data.result) return null;
  
  const decrypted = await decryptYflix(data.result);
  return decrypted;
}

async function extractPageData(embedUrl: string): Promise<string | null> {
  console.log(`Fetching embed page: ${embedUrl}`);
  
  const res = await fetch(embedUrl, {
    headers: { ...HEADERS, 'Referer': YFLIX_BASE },
  });
  
  const html = await res.text();
  console.log(`Embed page length: ${html.length}`);
  
  // Look for PAGE_DATA
  const pageDataMatch = html.match(/__?PAGE_DATA\s*=\s*["']([^"']+)["']/);
  if (pageDataMatch && pageDataMatch[1]) {
    console.log(`Found PAGE_DATA: ${pageDataMatch[1].substring(0, 80)}...`);
    return pageDataMatch[1];
  }
  
  // Alternative pattern
  const dataPageMatch = html.match(/data-page=["']([^"']+)["']/);
  if (dataPageMatch && dataPageMatch[1]) {
    console.log(`Found data-page: ${dataPageMatch[1].substring(0, 80)}...`);
    return dataPageMatch[1];
  }
  
  // Save HTML for debugging
  const fs = await import('fs');
  fs.writeFileSync('debug-1movies-embed.html', html);
  console.log('Saved embed HTML to debug-1movies-embed.html');
  
  return null;
}

async function testMovie(title: string) {
  console.log('='.repeat(60));
  console.log(`Testing: ${title}`);
  console.log('='.repeat(60));
  
  // Search
  const result = await searchYflix(title);
  if (!result) {
    console.log('❌ Not found');
    return;
  }
  
  console.log(`✓ Found: ${result.title} (${result.contentId})`);
  console.log(`  Type: ${result.isMovie ? 'Movie' : 'TV Show'}`);
  
  // Get servers
  const servers = await getServers(result.contentId);
  console.log(`\nServers (${servers.length}):`);
  servers.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (lid: ${s.lid})`));
  
  if (servers.length === 0) {
    console.log('❌ No servers');
    return;
  }
  
  // Try first server
  const server = servers[0];
  console.log(`\nTrying server: ${server.name}`);
  
  const embed = await getEmbedUrl(server.lid);
  if (!embed || !embed.url) {
    console.log('❌ No embed URL');
    return;
  }
  
  console.log(`Embed URL: ${embed.url}`);
  
  // Check if rapidshare
  if (!embed.url.includes('rapidshare') && !embed.url.includes('rapidairmax')) {
    console.log('⚠️ Not a rapidshare embed, skipping dec-rapid');
    return;
  }
  
  // Extract PAGE_DATA
  const pageData = await extractPageData(embed.url);
  if (!pageData) {
    console.log('❌ No PAGE_DATA found');
    return;
  }
  
  // Decrypt via dec-rapid
  const decrypted = await decryptRapidPageData(pageData);
  
  if (decrypted.status === 200 && decrypted.result) {
    console.log('\n✅ SUCCESS!');
    if (decrypted.result.sources && decrypted.result.sources.length > 0) {
      console.log(`M3U8 URL: ${decrypted.result.sources[0].file}`);
    }
    if (decrypted.result.tracks) {
      console.log(`Tracks: ${decrypted.result.tracks.length}`);
    }
  } else {
    console.log('\n❌ Decryption failed');
  }
}

async function main() {
  // Test with a popular movie
  await testMovie('Fight Club');
  
  console.log('\n\n');
  
  // Test with another movie
  await testMovie('The Matrix');
}

main().catch(console.error);
