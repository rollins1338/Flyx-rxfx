/**
 * FCTV33 Deep Analysis - Find the actual data API
 */

const JS_FILES = [
  'https://statics2.tcgfs39a2.xyz/statics/195cc98d4.js',
  'https://statics2.tcgfs39a2.xyz/statics/6c848c44352.js',
  'https://statics2.tcgfs39a2.xyz/statics/e85a3e5631.js',
  'https://statics2.tcgfs39a2.xyz/statics/75a3ee3152.js',
  'https://statics2.tcgfs39a2.xyz/statics/2df69bfe55.js',
  'https://statics2.tcgfs39a2.xyz/statics/f80da25ba72.js',
  'https://statics2.tcgfs39a2.xyz/statics/35841cd600.js',
  'https://statics2.tcgfs39a2.xyz/statics/431546b7e3.js',
  'https://statics2.tcgfs39a2.xyz/statics/5a0fc54567.js',
  'https://statics2.tcgfs39a2.xyz/statics/2fa11e88210.js',
  'https://statics2.tcgfs39a2.xyz/statics/539b2324f15.js',
  'https://statics2.tcgfs39a2.xyz/statics/e98ee9e7190.js',
  'https://statics2.tcgfs39a2.xyz/statics/f7305f4c814.js',
];

async function fetchScript(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  return response.text();
}

function findPatterns(code: string): {
  apiCalls: string[];
  endpoints: string[];
  domains: string[];
  functions: string[];
} {
  const apiCalls: string[] = [];
  const endpoints: string[] = [];
  const domains: string[] = [];
  const functions: string[] = [];

  // Find fetch/axios/http calls
  const fetchPatterns = [
    /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /axios\.[a-z]+\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /\$\.(?:get|post|ajax)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /http\.[a-z]+\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /request\s*\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const pattern of fetchPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      apiCalls.push(match[1]);
    }
  }

  // Find URL-like strings
  const urlPattern = /["'`]((?:https?:)?\/\/[a-zA-Z0-9.-]+(?:\/[^"'`\s]*)?)["'`]/g;
  let match;
  while ((match = urlPattern.exec(code)) !== null) {
    const url = match[1];
    if (!url.includes('google') && !url.includes('facebook') && !url.includes('.css') && !url.includes('.png') && !url.includes('.jpg')) {
      endpoints.push(url);
    }
  }

  // Find domain patterns
  const domainPattern = /["'`]([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)["'`]/g;
  while ((match = domainPattern.exec(code)) !== null) {
    const domain = match[1];
    if (!domain.includes('google') && !domain.includes('facebook') && domain.includes('.')) {
      domains.push(domain);
    }
  }

  // Find function names that might be API related
  const funcPattern = /(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s*)?\(?|(?:\s*\())/g;
  while ((match = funcPattern.exec(code)) !== null) {
    const name = match[1].toLowerCase();
    if (name.includes('fetch') || name.includes('api') || name.includes('load') || name.includes('get') || name.includes('stream') || name.includes('event') || name.includes('match') || name.includes('schedule')) {
      functions.push(match[1]);
    }
  }

  return {
    apiCalls: [...new Set(apiCalls)],
    endpoints: [...new Set(endpoints)],
    domains: [...new Set(domains)],
    functions: [...new Set(functions)],
  };
}

function findApiBaseUrls(code: string): string[] {
  const baseUrls: string[] = [];
  
  // Common patterns for API base URLs
  const patterns = [
    /(?:baseURL|baseUrl|apiUrl|API_URL|apiBase|API_BASE)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
    /(?:BASE_URL|BASE|API)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
    /["'`](https?:\/\/[^"'`]+\/api(?:\/v\d+)?)["'`]/gi,
    /["'`](https?:\/\/api\.[^"'`]+)["'`]/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      baseUrls.push(match[1]);
    }
  }

  return [...new Set(baseUrls)];
}

function findStreamPatterns(code: string): string[] {
  const streams: string[] = [];
  
  const patterns = [
    /["'`]([^"'`]*\.m3u8[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*\/live\/[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*\/stream\/[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*\/embed\/[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*\/player\/[^"'`]*)["'`]/gi,
    /["'`]([^"'`]*\/hls\/[^"'`]*)["'`]/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      streams.push(match[1]);
    }
  }

  return [...new Set(streams)];
}

async function main() {
  console.log('='.repeat(80));
  console.log('FCTV33 DEEP ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  const allApiCalls: string[] = [];
  const allEndpoints: string[] = [];
  const allDomains: string[] = [];
  const allFunctions: string[] = [];
  const allBaseUrls: string[] = [];
  const allStreams: string[] = [];

  for (const jsUrl of JS_FILES) {
    console.log(`📜 Analyzing: ${jsUrl.split('/').pop()}`);
    
    try {
      const code = await fetchScript(jsUrl);
      console.log(`   Size: ${code.length} bytes`);
      
      const patterns = findPatterns(code);
      const baseUrls = findApiBaseUrls(code);
      const streams = findStreamPatterns(code);
      
      allApiCalls.push(...patterns.apiCalls);
      allEndpoints.push(...patterns.endpoints);
      allDomains.push(...patterns.domains);
      allFunctions.push(...patterns.functions);
      allBaseUrls.push(...baseUrls);
      allStreams.push(...streams);
      
      if (patterns.apiCalls.length > 0) {
        console.log(`   API calls: ${patterns.apiCalls.join(', ')}`);
      }
      if (baseUrls.length > 0) {
        console.log(`   Base URLs: ${baseUrls.join(', ')}`);
      }
      if (streams.length > 0) {
        console.log(`   Streams: ${streams.join(', ')}`);
      }
    } catch (error: any) {
      console.log(`   Error: ${error.message}`);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();

  const uniqueApiCalls = [...new Set(allApiCalls)];
  const uniqueEndpoints = [...new Set(allEndpoints)];
  const uniqueDomains = [...new Set(allDomains)];
  const uniqueFunctions = [...new Set(allFunctions)];
  const uniqueBaseUrls = [...new Set(allBaseUrls)];
  const uniqueStreams = [...new Set(allStreams)];

  console.log(`API Calls (${uniqueApiCalls.length}):`);
  for (const call of uniqueApiCalls) {
    console.log(`  - ${call}`);
  }
  console.log();

  console.log(`Base URLs (${uniqueBaseUrls.length}):`);
  for (const url of uniqueBaseUrls) {
    console.log(`  - ${url}`);
  }
  console.log();

  console.log(`Stream Patterns (${uniqueStreams.length}):`);
  for (const stream of uniqueStreams) {
    console.log(`  - ${stream}`);
  }
  console.log();

  console.log(`Interesting Domains (${uniqueDomains.length}):`);
  for (const domain of uniqueDomains.filter(d => 
    !d.includes('tcgfs') && 
    !d.includes('google') && 
    !d.includes('facebook') &&
    !d.includes('twitter') &&
    !d.includes('youtube')
  ).slice(0, 30)) {
    console.log(`  - ${domain}`);
  }
  console.log();

  console.log(`Interesting Endpoints (${uniqueEndpoints.length}):`);
  for (const ep of uniqueEndpoints.filter(e => 
    !e.includes('tcgfs') && 
    !e.includes('google') &&
    !e.includes('.js') &&
    !e.includes('.css')
  ).slice(0, 30)) {
    console.log(`  - ${ep}`);
  }
  console.log();

  console.log(`API-related Functions (${uniqueFunctions.length}):`);
  for (const func of uniqueFunctions.slice(0, 30)) {
    console.log(`  - ${func}`);
  }
}

main().catch(console.error);
