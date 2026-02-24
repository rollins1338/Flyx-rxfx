#!/usr/bin/env node
/**
 * Test different AnimeKai endpoint patterns to find the new search API
 */

const domains = ['animekai.to', 'anikai.to'];
const searchKeyword = 'Jujutsu Kaisen';

async function testEndpoint(domain, path, headers = {}) {
  const url = `https://${domain}${path}`;
  console.log(`\nTesting: ${url}`);
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Referer': `https://${domain}/`,
        ...headers,
      },
      signal: AbortSignal.timeout(10000),
    });
    
    console.log(`  Status: ${res.status}`);
    console.log(`  Content-Type: ${res.headers.get('content-type')}`);
    
    const text = await res.text();
    console.log(`  Size: ${text.length} bytes`);
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log(`  JSON: ${JSON.stringify(json).substring(0, 200)}`);
      return { success: true, data: json };
    } catch {
      console.log(`  Text preview: ${text.substring(0, 200)}`);
      return { success: false, text };
    }
  } catch (err) {
    console.log(`  Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  AnimeKai Endpoint Discovery           ║');
  console.log('╚════════════════════════════════════════╝');

  for (const domain of domains) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Domain: ${domain}`);
    console.log('='.repeat(60));

    // Test various endpoint patterns
    const endpoints = [
      `/ajax/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/api/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/api/v1/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/api/v2/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/ajax/anime/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/ajax/v1/search?keyword=${encodeURIComponent(searchKeyword)}`,
      `/ajax/v2/search?keyword=${encodeURIComponent(searchKeyword)}`,
    ];

    for (const endpoint of endpoints) {
      await testEndpoint(domain, endpoint, {
        'X-Requested-With': 'XMLHttpRequest',
      });
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
