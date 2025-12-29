/**
 * FCTV33 API Testing - Test discovered endpoints
 */

const BASE_URLS = [
  'https://www.fctv33.site',
  'https://fctv33.site',
  'https://api.fctv33.site',
  'https://statics2.tcgfs39a2.xyz',
];

const ENDPOINTS = [
  '/api/stream/detail',
  '/api/league/player/total/list',
  '/api/match/list',
  '/api/match/detail',
  '/api/schedule',
  '/api/events',
  '/api/live',
  '/api/streams',
  '/api/football',
  '/api/basketball',
  '/api/sports',
  '/api/categories',
  '/api/home',
  '/api/index',
  '/api/data',
];

async function testEndpoint(url: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Referer': 'https://www.fctv33.site/',
        'Origin': 'https://www.fctv33.site',
      },
    });

    clearTimeout(timeout);

    const text = await response.text();
    const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
    const isHtml = text.includes('<!DOCTYPE') || text.includes('<html');
    
    // Only show interesting results
    if (isJson || (response.status === 200 && !isHtml && text.length < 50000)) {
      console.log(`✅ ${url}`);
      console.log(`   Status: ${response.status}, Size: ${text.length}, JSON: ${isJson}`);
      if (isJson) {
        try {
          const json = JSON.parse(text);
          console.log(`   Keys: ${Object.keys(json).join(', ')}`);
          console.log(`   Preview: ${text.substring(0, 500)}`);
        } catch {
          console.log(`   Preview: ${text.substring(0, 300)}`);
        }
      }
      console.log();
    }
  } catch (error: any) {
    // Silently ignore errors
  }
}

async function fetchMainPageAndExtractData(): Promise<void> {
  console.log('📄 Fetching main page to extract embedded data...');
  
  const response = await fetch('https://www.fctv33.site/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  
  const html = await response.text();
  
  // Look for embedded JSON data
  const jsonPatterns = [
    /__NEXT_DATA__\s*=\s*({[^<]+})/,
    /__NUXT__\s*=\s*({[^<]+})/,
    /window\.__INITIAL_STATE__\s*=\s*({[^<]+})/,
    /window\.initialData\s*=\s*({[^<]+})/,
    /window\.pageData\s*=\s*({[^<]+})/,
    /data-page="([^"]+)"/,
  ];
  
  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match) {
      console.log(`Found embedded data with pattern: ${pattern.source.substring(0, 30)}...`);
      try {
        const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const json = JSON.parse(decoded);
        console.log(`Keys: ${Object.keys(json).join(', ')}`);
        console.log(`Preview: ${JSON.stringify(json).substring(0, 1000)}`);
      } catch (e) {
        console.log(`Raw: ${match[1].substring(0, 500)}`);
      }
      console.log();
    }
  }
  
  // Look for API URLs in the HTML
  const apiUrlPattern = /["'](https?:\/\/[^"']*api[^"']*)["']/gi;
  const apiUrls: string[] = [];
  let match;
  while ((match = apiUrlPattern.exec(html)) !== null) {
    apiUrls.push(match[1]);
  }
  
  if (apiUrls.length > 0) {
    console.log(`Found ${apiUrls.length} API URLs in HTML:`);
    for (const url of [...new Set(apiUrls)]) {
      console.log(`  - ${url}`);
    }
    console.log();
  }
  
  // Look for data attributes
  const dataAttrPattern = /data-([a-z-]+)="([^"]+)"/gi;
  const dataAttrs: Record<string, string[]> = {};
  while ((match = dataAttrPattern.exec(html)) !== null) {
    const key = match[1];
    const value = match[2];
    if (!dataAttrs[key]) dataAttrs[key] = [];
    if (!dataAttrs[key].includes(value) && value.length > 10) {
      dataAttrs[key].push(value);
    }
  }
  
  const interestingAttrs = Object.entries(dataAttrs).filter(([k, v]) => 
    v.length > 0 && (k.includes('url') || k.includes('api') || k.includes('src') || k.includes('id'))
  );
  
  if (interestingAttrs.length > 0) {
    console.log('Interesting data attributes:');
    for (const [key, values] of interestingAttrs) {
      console.log(`  ${key}: ${values.slice(0, 3).join(', ')}`);
    }
    console.log();
  }
}

async function testWithDifferentParams(): Promise<void> {
  console.log('🧪 Testing endpoints with different parameters...');
  
  const testUrls = [
    'https://www.fctv33.site/api/stream/detail?id=1',
    'https://www.fctv33.site/api/stream/detail?matchId=1',
    'https://www.fctv33.site/api/match/list?sport=football',
    'https://www.fctv33.site/api/match/list?category=football',
    'https://www.fctv33.site/api/match/list?type=live',
    'https://www.fctv33.site/api/schedule?date=today',
    'https://www.fctv33.site/api/home',
    'https://www.fctv33.site/api/index',
  ];
  
  for (const url of testUrls) {
    await testEndpoint(url);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('FCTV33 API TESTING');
  console.log('='.repeat(80));
  console.log();

  // First, analyze the main page
  await fetchMainPageAndExtractData();

  // Test all endpoint combinations
  console.log('🌐 Testing API endpoints...');
  console.log();
  
  for (const base of BASE_URLS) {
    for (const endpoint of ENDPOINTS) {
      await testEndpoint(base + endpoint);
    }
  }

  // Test with parameters
  await testWithDifferentParams();

  console.log('='.repeat(80));
  console.log('DONE');
  console.log('='.repeat(80));
}

main().catch(console.error);
