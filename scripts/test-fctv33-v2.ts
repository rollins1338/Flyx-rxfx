/**
 * FCTV33 Reverse Engineering Test Suite v2
 * Focuses on analyzing the SPA and finding the actual data source
 */

const BASE_URL = 'https://www.fctv33.site';

async function fetchFullPage(): Promise<string> {
  const response = await fetch(BASE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  return response.text();
}

function extractScriptSources(html: string): string[] {
  const sources: string[] = [];
  
  // Match <script src="...">
  const srcRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    sources.push(match[1]);
  }
  
  return sources;
}

function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  
  // Match <script>...</script>
  const scriptRegex = /<script[^>]*>([^<]+)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    if (match[1].trim().length > 50) {
      scripts.push(match[1]);
    }
  }
  
  return scripts;
}

function findUrlsInCode(code: string): { apis: string[]; streams: string[]; other: string[] } {
  const apis: string[] = [];
  const streams: string[] = [];
  const other: string[] = [];
  
  // Find all URLs
  const urlRegex = /["'`](https?:\/\/[^"'`\s]+)["'`]/g;
  let match;
  while ((match = urlRegex.exec(code)) !== null) {
    const url = match[1];
    if (url.includes('api') || url.includes('/v1') || url.includes('/v2') || url.includes('graphql')) {
      apis.push(url);
    } else if (url.includes('m3u8') || url.includes('stream') || url.includes('embed') || url.includes('player') || url.includes('.ts')) {
      streams.push(url);
    } else if (!url.includes('google') && !url.includes('facebook') && !url.includes('twitter') && !url.includes('analytics')) {
      other.push(url);
    }
  }
  
  // Find relative API paths
  const relativeRegex = /["'`](\/api\/[^"'`\s]+)["'`]/g;
  while ((match = relativeRegex.exec(code)) !== null) {
    apis.push(BASE_URL + match[1]);
  }
  
  // Find fetch/axios calls
  const fetchRegex = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g;
  while ((match = fetchRegex.exec(code)) !== null) {
    apis.push(match[1]);
  }
  
  return {
    apis: [...new Set(apis)],
    streams: [...new Set(streams)],
    other: [...new Set(other)],
  };
}

async function fetchAndAnalyzeScript(url: string): Promise<{ url: string; apis: string[]; streams: string[]; other: string[] }> {
  try {
    // Handle relative URLs
    let fullUrl = url;
    if (url.startsWith('//')) {
      fullUrl = 'https:' + url;
    } else if (url.startsWith('/')) {
      fullUrl = BASE_URL + url;
    } else if (!url.startsWith('http')) {
      fullUrl = BASE_URL + '/' + url;
    }
    
    console.log(`  Fetching: ${fullUrl}`);
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`    ❌ Failed: ${response.status}`);
      return { url: fullUrl, apis: [], streams: [], other: [] };
    }
    
    const code = await response.text();
    console.log(`    ✅ Size: ${code.length} bytes`);
    
    const urls = findUrlsInCode(code);
    return { url: fullUrl, ...urls };
  } catch (error: any) {
    console.log(`    ❌ Error: ${error.message}`);
    return { url, apis: [], streams: [], other: [] };
  }
}

async function testApiEndpoint(url: string): Promise<void> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': BASE_URL,
      },
    });
    
    const text = await response.text();
    const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
    
    console.log(`  ${isJson ? '✅' : '❌'} ${url}`);
    console.log(`    Status: ${response.status}, Size: ${text.length}, JSON: ${isJson}`);
    
    if (isJson && text.length < 5000) {
      console.log(`    Content: ${text.substring(0, 500)}`);
    } else if (isJson) {
      console.log(`    Preview: ${text.substring(0, 300)}...`);
    }
  } catch (error: any) {
    console.log(`  ❌ ${url} - Error: ${error.message}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('FCTV33 REVERSE ENGINEERING TEST SUITE v2');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Fetch main page
  console.log('📄 STEP 1: Fetching main page...');
  const html = await fetchFullPage();
  console.log(`  Page size: ${html.length} bytes`);
  console.log();

  // Step 2: Extract script sources
  console.log('📜 STEP 2: Extracting script sources...');
  const scriptSources = extractScriptSources(html);
  console.log(`  Found ${scriptSources.length} external scripts:`);
  for (const src of scriptSources) {
    console.log(`    - ${src}`);
  }
  console.log();

  // Step 3: Extract inline scripts
  console.log('📝 STEP 3: Analyzing inline scripts...');
  const inlineScripts = extractInlineScripts(html);
  console.log(`  Found ${inlineScripts.length} inline scripts`);
  
  let allApis: string[] = [];
  let allStreams: string[] = [];
  let allOther: string[] = [];
  
  for (const script of inlineScripts) {
    const urls = findUrlsInCode(script);
    allApis.push(...urls.apis);
    allStreams.push(...urls.streams);
    allOther.push(...urls.other);
  }
  
  // Also check the HTML itself for URLs
  const htmlUrls = findUrlsInCode(html);
  allApis.push(...htmlUrls.apis);
  allStreams.push(...htmlUrls.streams);
  allOther.push(...htmlUrls.other);
  
  console.log();

  // Step 4: Fetch and analyze external scripts
  console.log('🔍 STEP 4: Analyzing external scripts...');
  for (const src of scriptSources.slice(0, 10)) {
    const result = await fetchAndAnalyzeScript(src);
    allApis.push(...result.apis);
    allStreams.push(...result.streams);
    allOther.push(...result.other);
  }
  console.log();

  // Deduplicate
  allApis = [...new Set(allApis)];
  allStreams = [...new Set(allStreams)];
  allOther = [...new Set(allOther)];

  // Step 5: Report findings
  console.log('📊 STEP 5: Summary of findings...');
  console.log();
  
  console.log(`  API URLs found (${allApis.length}):`);
  for (const api of allApis.slice(0, 30)) {
    console.log(`    - ${api}`);
  }
  console.log();
  
  console.log(`  Stream URLs found (${allStreams.length}):`);
  for (const stream of allStreams.slice(0, 20)) {
    console.log(`    - ${stream}`);
  }
  console.log();
  
  console.log(`  Other interesting URLs (${allOther.length}):`);
  for (const url of allOther.filter(u => !u.includes('cdn') && !u.includes('font')).slice(0, 20)) {
    console.log(`    - ${url}`);
  }
  console.log();

  // Step 6: Test discovered API endpoints
  if (allApis.length > 0) {
    console.log('🧪 STEP 6: Testing discovered API endpoints...');
    for (const api of allApis.slice(0, 10)) {
      await testApiEndpoint(api);
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('DONE');
  console.log('='.repeat(80));
}

main().catch(console.error);
