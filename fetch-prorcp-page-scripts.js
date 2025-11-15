const https = require('https');
const cheerio = require('cheerio');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    https.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': options.referer || '',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data }));
    }).on('error', reject).end();
  });
}

async function analyzePage() {
  const tmdbId = '550';
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  console.log('Fetching embed page...');
  const embedResp = await fetch(embedUrl);
  const $ = cheerio.load(embedResp.data);
  const dataHash = $('[data-hash]').first().attr('data-hash');
  
  console.log('Getting RCP URL...');
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
  const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
  
  console.log('\nFetching ProRCP page...');
  const proRcpResp = await fetch(proRcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const $$ = cheerio.load(proRcpResp.data);
  
  console.log('\n=== INLINE SCRIPTS ===\n');
  $$('script').each((i, elem) => {
    const src = $$(elem).attr('src');
    const content = $$(elem).html();
    
    if (src) {
      console.log(`Script ${i}: ${src}`);
    } else if (content && content.length > 0) {
      console.log(`\nInline Script ${i} (${content.length} chars):`);
      console.log(content.substring(0, 500));
      console.log('...\n');
    }
  });
  
  // Look for any divs with data
  console.log('\n=== DIVS WITH IDS ===\n');
  $$('div[id]').each((i, elem) => {
    const id = $$(elem).attr('id');
    const content = $$(elem).html();
    console.log(`Div #${id}: ${content.substring(0, 100)}`);
  });
}

analyzePage().catch(console.error);
