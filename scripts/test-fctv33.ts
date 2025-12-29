/**
 * FCTV33 Reverse Engineering Test Suite
 * 
 * Run with: npx ts-node scripts/test-fctv33.ts
 * Or: bun run scripts/test-fctv33.ts
 */

const BASE_URL = 'https://www.fctv33.site';
const POSSIBLE_API_DOMAINS = [
  'https://api.fctv33.site',
  'https://fctv33.site',
  'https://www.fctv33.site',
  'https://stream.fctv33.site',
  'https://embed.fctv33.site',
  'https://player.fctv33.site',
  'https://live.fctv33.site',
];

const SPORTS = ['football', 'basketball', 'tennis', 'motorsport', 'rugby', 'cricket', 'hockey', 'baseball'];

const COMMON_ENDPOINTS = [
  '/api/schedule',
  '/api/events',
  '/api/streams',
  '/api/matches',
  '/api/live',
  '/api/v1/schedule',
  '/api/v1/events',
  '/api/v1/streams',
  '/schedule',
  '/events',
  '/streams',
  '/matches',
  '/live',
  '/data/schedule.json',
  '/data/events.json',
  '/json/schedule',
  '/json/events',
  '/feed',
  '/feed/schedule',
  '/graphql',
];

interface TestResult {
  url: string;
  status: number;
  contentType: string | null;
  size: number;
  isJson: boolean;
  isHtml: boolean;
  preview: string;
  error?: string;
}

async function testEndpoint(url: string): Promise<TestResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Referer': BASE_URL,
        'Origin': BASE_URL,
      },
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type');
    const text = await response.text();
    const isJson = contentType?.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[');
    const isHtml = contentType?.includes('html') || text.trim().startsWith('<!') || text.trim().startsWith('<html');

    return {
      url,
      status: response.status,
      contentType,
      size: text.length,
      isJson,
      isHtml,
      preview: text.substring(0, 500),
    };
  } catch (error: any) {
    return {
      url,
      status: 0,
      contentType: null,
      size: 0,
      isJson: false,
      isHtml: false,
      preview: '',
      error: error.message,
    };
  }
}

async function findJavaScriptFiles(html: string, baseUrl: string): Promise<string[]> {
  const jsFiles: string[] = [];
  
  // Find script src attributes
  const scriptRegex = /src=["']([^"']*\.js[^"']*)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    let src = match[1];
    if (src.startsWith('//')) {
      src = 'https:' + src;
    } else if (src.startsWith('/')) {
      src = baseUrl + src;
    } else if (!src.startsWith('http')) {
      src = baseUrl + '/' + src;
    }
    jsFiles.push(src);
  }
  
  return jsFiles;
}

async function analyzeJavaScript(jsUrl: string): Promise<{ url: string; apis: string[]; endpoints: string[] }> {
  try {
    const response = await fetch(jsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const code = await response.text();
    
    const apis: string[] = [];
    const endpoints: string[] = [];
    
    // Find API URLs
    const urlPatterns = [
      /["'](https?:\/\/[^"'\s]+api[^"'\s]*)["']/gi,
      /["'](https?:\/\/[^"'\s]+\/v\d+[^"'\s]*)["']/gi,
      /["'](\/api\/[^"'\s]*)["']/gi,
      /["'](https?:\/\/[^"'\s]+\.json[^"'\s]*)["']/gi,
      /fetch\s*\(\s*["']([^"']+)["']/gi,
      /axios\.[a-z]+\s*\(\s*["']([^"']+)["']/gi,
      /["'](https?:\/\/[^"'\s]*stream[^"'\s]*)["']/gi,
      /["'](https?:\/\/[^"'\s]*embed[^"'\s]*)["']/gi,
      /["'](https?:\/\/[^"'\s]*player[^"'\s]*)["']/gi,
      /["'](https?:\/\/[^"'\s]*m3u8[^"'\s]*)["']/gi,
    ];
    
    for (const pattern of urlPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const url = match[1];
        if (url.includes('api') || url.includes('/v1') || url.includes('/v2')) {
          apis.push(url);
        } else {
          endpoints.push(url);
        }
      }
    }
    
    return { url: jsUrl, apis: [...new Set(apis)], endpoints: [...new Set(endpoints)] };
  } catch (error) {
    return { url: jsUrl, apis: [], endpoints: [] };
  }
}

async function testSportPage(sport: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  const urls = [
    `${BASE_URL}/${sport}`,
    `${BASE_URL}/live/${sport}`,
    `${BASE_URL}/category/${sport}`,
    `${BASE_URL}/sports/${sport}`,
  ];
  
  for (const url of urls) {
    results.push(await testEndpoint(url));
  }
  
  return results;
}

async function main() {
  console.log('='.repeat(80));
  console.log('FCTV33 REVERSE ENGINEERING TEST SUITE');
  console.log('='.repeat(80));
  console.log();

  // Test 1: Main page analysis
  console.log('📄 TEST 1: Analyzing main page...');
  const mainPage = await testEndpoint(BASE_URL);
  console.log(`  Status: ${mainPage.status}`);
  console.log(`  Size: ${mainPage.size} bytes`);
  console.log(`  Is HTML: ${mainPage.isHtml}`);
  console.log();

  // Test 2: Find JavaScript files
  console.log('📜 TEST 2: Finding JavaScript files...');
  const jsFiles = await findJavaScriptFiles(mainPage.preview + (mainPage.size > 500 ? '...' : ''), BASE_URL);
  console.log(`  Found ${jsFiles.length} JS files`);
  for (const js of jsFiles.slice(0, 10)) {
    console.log(`    - ${js}`);
  }
  console.log();

  // Test 3: Analyze JavaScript for API endpoints
  console.log('🔍 TEST 3: Analyzing JavaScript for API endpoints...');
  const allApis: string[] = [];
  const allEndpoints: string[] = [];
  
  for (const jsUrl of jsFiles.slice(0, 5)) {
    console.log(`  Analyzing: ${jsUrl}`);
    const analysis = await analyzeJavaScript(jsUrl);
    allApis.push(...analysis.apis);
    allEndpoints.push(...analysis.endpoints);
  }
  
  console.log(`  Found ${allApis.length} API URLs:`);
  for (const api of [...new Set(allApis)].slice(0, 20)) {
    console.log(`    - ${api}`);
  }
  console.log(`  Found ${allEndpoints.length} other endpoints:`);
  for (const ep of [...new Set(allEndpoints)].slice(0, 20)) {
    console.log(`    - ${ep}`);
  }
  console.log();

  // Test 4: Test common API endpoints
  console.log('🌐 TEST 4: Testing common API endpoints...');
  const apiResults: TestResult[] = [];
  
  for (const domain of POSSIBLE_API_DOMAINS) {
    for (const endpoint of COMMON_ENDPOINTS) {
      const url = domain + endpoint;
      const result = await testEndpoint(url);
      if (result.status === 200 && (result.isJson || result.size > 1000)) {
        apiResults.push(result);
        console.log(`  ✅ ${url} - ${result.status} - ${result.size} bytes - JSON: ${result.isJson}`);
      }
    }
  }
  console.log();

  // Test 5: Test sport-specific pages
  console.log('⚽ TEST 5: Testing sport-specific pages...');
  for (const sport of SPORTS.slice(0, 3)) {
    console.log(`  Testing ${sport}...`);
    const results = await testSportPage(sport);
    for (const r of results) {
      if (r.status === 200) {
        console.log(`    ✅ ${r.url} - ${r.size} bytes`);
      }
    }
  }
  console.log();

  // Test 6: Check for embed/player endpoints
  console.log('🎬 TEST 6: Testing embed/player endpoints...');
  const embedEndpoints = [
    `${BASE_URL}/embed/1`,
    `${BASE_URL}/player/1`,
    `${BASE_URL}/watch/1`,
    `${BASE_URL}/stream/1`,
    `${BASE_URL}/live/1`,
    `${BASE_URL}/channel/1`,
    `${BASE_URL}/event/1`,
  ];
  
  for (const url of embedEndpoints) {
    const result = await testEndpoint(url);
    console.log(`  ${result.status === 200 ? '✅' : '❌'} ${url} - ${result.status} - ${result.size} bytes`);
    if (result.status === 200 && result.size > 1000) {
      console.log(`    Preview: ${result.preview.substring(0, 200)}...`);
    }
  }
  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total API endpoints found: ${apiResults.length}`);
  console.log(`JavaScript files analyzed: ${jsFiles.length}`);
  console.log();
  
  if (apiResults.length > 0) {
    console.log('Working API endpoints:');
    for (const r of apiResults) {
      console.log(`  - ${r.url}`);
      if (r.isJson) {
        console.log(`    Preview: ${r.preview.substring(0, 300)}...`);
      }
    }
  }
}

main().catch(console.error);
