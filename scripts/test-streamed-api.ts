/**
 * Test Streamed.pk API - A working sports streaming API
 */

const API_BASE = 'https://streamed.pk/api';

interface Match {
  id: string;
  title: string;
  category: string;
  date: string;
  poster?: string;
  popular?: boolean;
  sources: Array<{
    source: string;
    id: string;
  }>;
}

interface Stream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

async function testSportsEndpoint(): Promise<void> {
  console.log('📋 Testing /api/sports...');
  try {
    const sports = await fetchJson<any>(`${API_BASE}/sports`);
    console.log('  Sports:', JSON.stringify(sports, null, 2).substring(0, 1000));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();
}

async function testMatchesEndpoint(sport: string): Promise<Match[]> {
  console.log(`⚽ Testing /api/matches/${sport}...`);
  try {
    const matches = await fetchJson<Match[]>(`${API_BASE}/matches/${sport}`);
    console.log(`  Found ${matches.length} matches`);
    
    if (matches.length > 0) {
      console.log('  First match:', JSON.stringify(matches[0], null, 2));
    }
    
    return matches;
  } catch (error: any) {
    console.log('  Error:', error.message);
    return [];
  }
}

async function testStreamEndpoint(source: string, id: string): Promise<Stream[]> {
  console.log(`🎬 Testing /api/stream/${source}/${id}...`);
  try {
    const streams = await fetchJson<Stream[]>(`${API_BASE}/stream/${source}/${id}`);
    console.log(`  Found ${streams.length} streams`);
    
    if (streams.length > 0) {
      console.log('  First stream:', JSON.stringify(streams[0], null, 2));
    }
    
    return streams;
  } catch (error: any) {
    console.log('  Error:', error.message);
    return [];
  }
}

async function testAllMatchEndpoints(): Promise<void> {
  const sports = ['football', 'basketball', 'tennis', 'cricket', 'hockey', 'baseball', 'rugby', 'motorsport', 'fighting'];
  
  console.log('🏆 Testing all sports endpoints...');
  console.log();
  
  for (const sport of sports) {
    try {
      const matches = await fetchJson<Match[]>(`${API_BASE}/matches/${sport}`);
      console.log(`  ${sport}: ${matches.length} matches`);
    } catch (error: any) {
      console.log(`  ${sport}: Error - ${error.message}`);
    }
  }
  console.log();
}

async function testLiveEndpoint(): Promise<void> {
  console.log('🔴 Testing /api/matches/live...');
  try {
    const matches = await fetchJson<Match[]>(`${API_BASE}/matches/live`);
    console.log(`  Found ${matches.length} live matches`);
    
    for (const match of matches.slice(0, 5)) {
      console.log(`    - ${match.title} (${match.category})`);
    }
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();
}

async function testAllEndpoint(): Promise<void> {
  console.log('📺 Testing /api/matches/all...');
  try {
    const matches = await fetchJson<Match[]>(`${API_BASE}/matches/all`);
    console.log(`  Found ${matches.length} total matches`);
    
    // Group by category
    const byCategory: Record<string, number> = {};
    for (const match of matches) {
      byCategory[match.category] = (byCategory[match.category] || 0) + 1;
    }
    
    console.log('  By category:');
    for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${cat}: ${count}`);
    }
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();
}

async function main() {
  console.log('='.repeat(80));
  console.log('STREAMED.PK API TEST');
  console.log('='.repeat(80));
  console.log();

  // Test sports endpoint
  await testSportsEndpoint();

  // Test all matches endpoint
  await testAllEndpoint();

  // Test live endpoint
  await testLiveEndpoint();

  // Test all sports
  await testAllMatchEndpoints();

  // Test football matches and get streams
  console.log('='.repeat(80));
  console.log('DETAILED FOOTBALL TEST');
  console.log('='.repeat(80));
  console.log();
  
  const footballMatches = await testMatchesEndpoint('football');
  console.log();
  
  // Test stream for first match with sources
  if (footballMatches.length > 0) {
    const matchWithSources = footballMatches.find(m => m.sources && m.sources.length > 0);
    if (matchWithSources) {
      console.log(`Testing streams for: ${matchWithSources.title}`);
      console.log(`Sources: ${matchWithSources.sources.map(s => `${s.source}:${s.id}`).join(', ')}`);
      console.log();
      
      for (const source of matchWithSources.sources.slice(0, 3)) {
        await testStreamEndpoint(source.source, source.id);
        console.log();
      }
    }
  }

  console.log('='.repeat(80));
  console.log('DONE');
  console.log('='.repeat(80));
}

main().catch(console.error);
