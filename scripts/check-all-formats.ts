/**
 * Check what format each content is using
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchWithHeaders(url: string, referer?: string) {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  if (referer) {
    headers['Referer'] = referer;
    headers['Origin'] = new URL(referer).origin;
  }
  return fetch(url, { headers });
}

async function getContent(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number) {
  const embedUrl = type === 'tv' && season && episode
    ? `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  const embedRes = await fetchWithHeaders(embedUrl);
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) return null;
  
  const rcpRes = await fetchWithHeaders('https://cloudnestra.com/rcp/' + rcpMatch[1], embedUrl);
  const rcpHtml = await rcpRes.text();
  
  if (rcpHtml.includes('turnstile')) return { error: 'TURNSTILE' };
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  const srcrcpMatch = rcpHtml.match(/\/srcrcp\/([A-Za-z0-9+\/=_:-]+)/i);
  
  const endpointType = prorcpMatch ? 'prorcp' : 'srcrcp';
  const endpointHash = prorcpMatch ? prorcpMatch[1] : srcrcpMatch?.[1];
  
  if (!endpointHash) return null;
  
  const prorcpRes = await fetchWithHeaders(`https://cloudnestra.com/${endpointType}/${endpointHash}`, 'https://cloudnestra.com/');
  const prorcpHtml = await prorcpRes.text();
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) return null;
  
  return { divId: divMatch[1], content: divMatch[2] };
}

function detectFormat(content: string): string {
  if (content.startsWith('eqqmp://')) return 'ROT3';
  if (content.startsWith('==') || content.startsWith('=')) return 'REVERSED_BASE64';
  if (content.includes(':') && /^[0-9a-f:]+$/i.test(content.substring(0, 50))) return 'HEX_WITH_COLONS';
  if (/^[0-9a-f]+$/i.test(content.substring(0, 100))) return 'PURE_HEX';
  if (/^[A-Za-z0-9+\/=_-]+$/.test(content.substring(0, 100))) return 'BASE64_LIKE';
  return 'UNKNOWN';
}

const testCases = [
  { name: 'FNAF 2', tmdbId: '1228246', type: 'movie' as const },
  { name: 'Fight Club', tmdbId: '550', type: 'movie' as const },
  { name: 'The Matrix', tmdbId: '603', type: 'movie' as const },
  { name: 'Breaking Bad S01E01', tmdbId: '1396', type: 'tv' as const, season: 1, episode: 1 },
  { name: 'The Office S01E01', tmdbId: '2316', type: 'tv' as const, season: 1, episode: 1 },
];

async function main() {
  console.log('='.repeat(70));
  console.log('FORMAT DETECTION FOR ALL CONTENT');
  console.log('='.repeat(70));
  
  for (const test of testCases) {
    console.log(`\n[${test.name}]`);
    
    const result = await getContent(test.tmdbId, test.type, test.season, test.episode);
    
    if (!result) {
      console.log('  ERROR: Could not fetch content');
      continue;
    }
    
    if ('error' in result) {
      console.log(`  ERROR: ${result.error}`);
      continue;
    }
    
    const format = detectFormat(result.content);
    console.log(`  Div ID: ${result.divId}`);
    console.log(`  Content length: ${result.content.length}`);
    console.log(`  Format: ${format}`);
    console.log(`  Preview: ${result.content.substring(0, 60)}...`);
    
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
