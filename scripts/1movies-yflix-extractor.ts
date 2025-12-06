/**
 * 1movies/yflix extractor - Check ALL servers and extract m3u8
 */

const puppeteer = require('puppeteer');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Connection': 'keep-alive'
};

const API = 'https://enc-dec.app/api';
const YFLIX_AJAX = 'https://yflix.to/ajax';

interface Server {
  sid: string;
  lid: string;
  name: string;
}

interface ParsedServers {
  default: { [index: string]: Server };
}

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

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS });
  return res.json();
}

async function extractM3u8FromEmbed(embedUrl: string): Promise<string | null> {
  console.log(`\n  Launching VISIBLE browser for: ${embedUrl}`);
  
  // Use puppeteer-extra with stealth plugin
  const puppeteerExtra = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteerExtra.use(StealthPlugin());
  
  const browser = await puppeteerExtra.launch({
    headless: false, // VISIBLE to pass Cloudflare
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized'
    ]
  });
  
  let m3u8Url: string | null = null;
  const allRequests: string[] = [];
  
  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Intercept ALL requests
    page.on('request', (req: any) => {
      allRequests.push(req.url());
    });
    
    page.on('response', async (res: any) => {
      const url = res.url();
      const contentType = res.headers()['content-type'] || '';
      
      // Check for m3u8 or video content - look for rrr.rapidshare.cc pattern
      if (url.includes('.m3u8') || url.includes('list.m3u8') || url.includes('master') || 
          url.includes('rrr.rapid') || url.includes('/pmjz/') || url.includes('/v5/') ||
          url.includes('.mp4') || url.includes('.ts') ||
          contentType.includes('mpegurl') || contentType.includes('video')) {
        console.log(`  🎯 VIDEO: ${url}`);
        if (url.includes('.m3u8') || url.includes('list.m3u8') || contentType.includes('mpegurl')) {
          m3u8Url = url;
        }
      }
      
      // Check response body for m3u8 URLs
      try {
        if (contentType.includes('javascript') || contentType.includes('json') || contentType.includes('html')) {
          const text = await res.text();
          
          // Look for rrr.rapidshare.cc pattern specifically
          const rrrMatch = text.match(/https?:\/\/rrr\.rapid[^\s"']+list\.m3u8[^\s"']*/);
          if (rrrMatch) {
            console.log(`  🎯 RRR M3U8: ${rrrMatch[0]}`);
            m3u8Url = rrrMatch[0];
          }
          
          const m3u8Match = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
          if (m3u8Match && !m3u8Url) {
            console.log(`  🎯 M3U8 IN RESPONSE: ${m3u8Match[0]}`);
            m3u8Url = m3u8Match[0];
          }
          
          // Also look for file/source patterns
          const fileMatch = text.match(/"file"\s*:\s*"([^"]+)"/);
          if (fileMatch) {
            console.log(`  🎯 FILE IN RESPONSE: ${fileMatch[1]}`);
            if (!m3u8Url) m3u8Url = fileMatch[1];
          }
          const sourceMatch = text.match(/"sources"\s*:\s*\[([^\]]+)\]/);
          if (sourceMatch) {
            console.log(`  🎯 SOURCES IN RESPONSE: ${sourceMatch[0].substring(0, 200)}`);
          }
        }
      } catch {}
    });
    
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait longer for Cloudflare challenge and video to load
    console.log('  Waiting for Cloudflare challenge and video...');
    await new Promise(r => setTimeout(r, 20000));
    
    // Check page source
    const pageContent = await page.content();
    const m3u8InPage = pageContent.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
    if (m3u8InPage) {
      console.log(`  🎯 M3U8 IN PAGE: ${m3u8InPage[0]}`);
      m3u8Url = m3u8Url || m3u8InPage[0];
    }
    
    // Look for jwplayer setup
    const jwSetup = await page.evaluate(() => {
      // @ts-ignore
      if (typeof jwplayer !== 'undefined') {
        try {
          // @ts-ignore
          const player = jwplayer();
          const playlist = player.getPlaylist();
          return playlist;
        } catch { return null; }
      }
      return null;
    });
    if (jwSetup) {
      console.log(`  🎯 JWPLAYER PLAYLIST:`, JSON.stringify(jwSetup));
    }
    
    // Log interesting requests
    const interesting = allRequests.filter(u => 
      u.includes('stream') || u.includes('video') || u.includes('source') || 
      u.includes('api') || u.includes('ajax') || u.includes('.m3u8') || u.includes('file')
    );
    if (interesting.length > 0) {
      console.log(`  Interesting requests:`);
      interesting.slice(0, 15).forEach(u => console.log(`    - ${u.substring(0, 120)}`));
    }
    
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  } finally {
    await browser.close();
  }
  
  return m3u8Url;
}

async function checkAllServers(contentId: string, isMovie: boolean = false) {
  console.log('=== yflix/1movies - Check ALL Servers ===\n');
  console.log(`Content ID: ${contentId}`);
  console.log(`Type: ${isMovie ? 'Movie' : 'TV Show'}\n`);

  let eid = contentId;
  
  // For TV shows, get first episode
  if (!isMovie) {
    const encId = await encrypt(contentId);
    const episodesResp = await getJson(`${YFLIX_AJAX}/episodes/list?id=${contentId}&_=${encId}`);
    const episodes = await parseHtml(episodesResp.result);
    const firstSeason = Object.keys(episodes)[0];
    const firstEp = Object.keys(episodes[firstSeason])[0];
    eid = episodes[firstSeason][firstEp].eid;
    console.log(`Using Episode: S${firstSeason}E${firstEp} (EID: ${eid})\n`);
  }

  // Get all servers
  const encEid = await encrypt(eid);
  const serversResp = await getJson(`${YFLIX_AJAX}/links/list?eid=${eid}&_=${encEid}`);
  const servers: ParsedServers = await parseHtml(serversResp.result);
  
  console.log('Available Servers:');
  const serverList = Object.values(servers.default);
  serverList.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (sid=${s.sid}, lid=${s.lid})`));
  
  const results: { server: string; embedUrl: string; m3u8: string | null }[] = [];

  // Check each server
  for (const server of serverList) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Checking: ${server.name} (sid=${server.sid})`);
    console.log('='.repeat(50));
    
    try {
      const encLid = await encrypt(server.lid);
      const embedResp = await getJson(`${YFLIX_AJAX}/links/view?id=${server.lid}&_=${encLid}`);
      const decrypted = await decrypt(embedResp.result);
      
      console.log(`  Decrypted:`, decrypted);
      
      // Parse the decrypted data - it might be object or string
      let embedUrl = '';
      if (typeof decrypted === 'object' && decrypted.url) {
        embedUrl = decrypted.url;
      } else if (typeof decrypted === 'string') {
        try {
          const parsed = JSON.parse(decrypted.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
          embedUrl = parsed.url;
        } catch {
          const match = decrypted.match(/url:\s*['"]([^'"]+)['"]/);
          embedUrl = match ? match[1] : decrypted;
        }
      }
      
      console.log(`  Embed URL: ${embedUrl}`);
      
      // Try to extract m3u8 from embed
      const m3u8 = await extractM3u8FromEmbed(embedUrl);
      
      results.push({
        server: server.name,
        embedUrl,
        m3u8
      });
      
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
      results.push({ server: server.name, embedUrl: 'ERROR', m3u8: null });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY - All Servers');
  console.log('='.repeat(60));
  
  for (const r of results) {
    console.log(`\n${r.server}:`);
    console.log(`  Embed: ${r.embedUrl}`);
    console.log(`  M3U8: ${r.m3u8 || 'NOT FOUND'}`);
  }
  
  const found = results.filter(r => r.m3u8);
  if (found.length > 0) {
    console.log('\n✅ WORKING SOURCES:');
    found.forEach(r => console.log(`  ${r.server}: ${r.m3u8}`));
  } else {
    console.log('\n❌ No m3u8 found from any server');
  }

  return results;
}

// Cyberpunk Edgerunners
const CYBERPUNK_ID = 'd4K68KU';

async function main() {
  await checkAllServers(CYBERPUNK_ID, false);
}

main().catch(console.error);
