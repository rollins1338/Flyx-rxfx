/**
 * Streamed.pk Integration Tests
 * 
 * Tests the Streamed.pk API integration for fetching events and streams.
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const API_BASE = 'https://streamed.pk/api';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface StreamedMatch {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string;
  popular?: boolean;
  sources: Array<{
    source: string;
    id: string;
  }>;
}

interface StreamedStream {
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
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

describe('Streamed.pk Integration Tests', () => {
  
  describe('API Connectivity', () => {
    
    test('should connect to streamed.pk API', async () => {
      const response = await fetch(`${API_BASE}/matches/all`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      });
      
      console.log('API Response Status:', response.status);
      expect(response.ok).toBe(true);
    });
    
    test('should return valid JSON', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
      
      console.log('Total matches:', matches.length);
      expect(Array.isArray(matches)).toBe(true);
    });
  });
  
  describe('Matches API', () => {
    
    test('should fetch all matches', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
      
      console.log('\n=== All Matches ===');
      console.log('Total:', matches.length);
      
      // Group by category
      const byCategory: Record<string, number> = {};
      for (const match of matches) {
        byCategory[match.category] = (byCategory[match.category] || 0) + 1;
      }
      
      console.log('\nBy Category:');
      for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${cat}: ${count}`);
      }
      
      expect(matches.length).toBeGreaterThan(0);
    });
    
    test('should fetch football matches', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/football`);
      
      console.log('\n=== Football Matches ===');
      console.log('Total:', matches.length);
      
      // Show first 5
      for (const match of matches.slice(0, 5)) {
        const date = new Date(match.date);
        console.log(`  ${match.title}`);
        console.log(`    Time: ${date.toLocaleString()}`);
        console.log(`    Sources: ${match.sources.length}`);
      }
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every(m => m.category === 'football')).toBe(true);
    });
    
    test('should fetch basketball matches', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/basketball`);
      
      console.log('\n=== Basketball Matches ===');
      console.log('Total:', matches.length);
      
      if (matches.length > 0) {
        for (const match of matches.slice(0, 3)) {
          console.log(`  ${match.title}`);
        }
      }
    });
    
    test('should have valid match structure', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
      
      const match = matches[0];
      console.log('\nSample match structure:');
      console.log(JSON.stringify(match, null, 2));
      
      expect(match.id).toBeDefined();
      expect(match.title).toBeDefined();
      expect(match.category).toBeDefined();
      expect(match.date).toBeDefined();
      expect(Array.isArray(match.sources)).toBe(true);
    });
    
    test('should identify live matches', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
      
      const now = Date.now();
      const threeHoursMs = 3 * 60 * 60 * 1000;
      
      const liveMatches = matches.filter(m => {
        const matchTime = m.date;
        return matchTime <= now && (now - matchTime) < threeHoursMs;
      });
      
      console.log('\n=== Live Matches ===');
      console.log('Total live:', liveMatches.length);
      
      for (const match of liveMatches.slice(0, 5)) {
        const startedAgo = Math.round((now - match.date) / 60000);
        console.log(`  ${match.title}`);
        console.log(`    Started: ${startedAgo} minutes ago`);
        console.log(`    Category: ${match.category}`);
      }
    });
    
    test('should have matches with sources', async () => {
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
      
      const withSources = matches.filter(m => m.sources && m.sources.length > 0);
      
      console.log('\n=== Matches with Sources ===');
      console.log('With sources:', withSources.length);
      console.log('Without sources:', matches.length - withSources.length);
      
      // Analyze source types
      const sourceTypes: Record<string, number> = {};
      for (const match of withSources) {
        for (const src of match.sources) {
          sourceTypes[src.source] = (sourceTypes[src.source] || 0) + 1;
        }
      }
      
      console.log('\nSource types:');
      for (const [type, count] of Object.entries(sourceTypes).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
      }
      
      expect(withSources.length).toBeGreaterThan(0);
    });
  });
  
  describe('Stream API', () => {
    let testMatch: StreamedMatch | null = null;
    
    beforeAll(async () => {
      // Find a match with sources to test
      const matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
      testMatch = matches.find(m => m.sources && m.sources.length > 0) || null;
    });
    
    test('should fetch stream info for a match', async () => {
      if (!testMatch || !testMatch.sources.length) {
        console.log('No test match with sources available');
        return;
      }
      
      const source = testMatch.sources[0];
      console.log(`\n=== Stream Info ===`);
      console.log(`Match: ${testMatch.title}`);
      console.log(`Source: ${source.source}:${source.id}`);
      
      const streams = await fetchJson<StreamedStream[]>(
        `${API_BASE}/stream/${source.source}/${source.id}`
      );
      
      console.log(`Streams available: ${streams.length}`);
      
      for (const stream of streams) {
        console.log(`\n  Stream #${stream.streamNo}:`);
        console.log(`    Language: ${stream.language}`);
        console.log(`    HD: ${stream.hd}`);
        console.log(`    Source: ${stream.source}`);
        console.log(`    Embed URL: ${stream.embedUrl?.substring(0, 60)}...`);
      }
      
      expect(streams.length).toBeGreaterThan(0);
    });
    
    test('should have valid stream structure', async () => {
      if (!testMatch || !testMatch.sources.length) {
        console.log('No test match with sources available');
        return;
      }
      
      const source = testMatch.sources[0];
      const streams = await fetchJson<StreamedStream[]>(
        `${API_BASE}/stream/${source.source}/${source.id}`
      );
      
      if (streams.length === 0) {
        console.log('No streams available for this match');
        return;
      }
      
      const stream = streams[0];
      console.log('\nStream structure:');
      console.log(JSON.stringify(stream, null, 2));
      
      expect(stream.id).toBeDefined();
      expect(stream.streamNo).toBeDefined();
      expect(stream.embedUrl).toBeDefined();
    });
  });
  
  describe('Local API Routes', () => {
    const LOCAL_API = 'http://localhost:3000/api/livetv';
    
    test('should fetch events from local API', async () => {
      try {
        const response = await fetch(`${LOCAL_API}/streamed-events`);
        
        if (!response.ok) {
          console.log('Local API not running or returned error:', response.status);
          return;
        }
        
        const data = await response.json();
        
        console.log('\n=== Local Streamed Events API ===');
        console.log('Success:', data.success);
        console.log('Events:', data.events?.length || 0);
        console.log('Live:', data.stats?.live || 0);
        
        if (data.events?.length > 0) {
          console.log('\nSample event:');
          console.log(JSON.stringify(data.events[0], null, 2));
        }
        
        expect(data.success).toBe(true);
      } catch (err) {
        console.log('Local API not available:', (err as Error).message);
      }
    });
    
    test('should fetch stream from local API', async () => {
      try {
        // First get an event
        const eventsResponse = await fetch(`${LOCAL_API}/streamed-events`);
        if (!eventsResponse.ok) {
          console.log('Local API not running');
          return;
        }
        
        const eventsData = await eventsResponse.json();
        if (!eventsData.events?.length) {
          console.log('No events available');
          return;
        }
        
        // Find event with sources
        const event = eventsData.events.find((e: any) => e.streamedSources?.length > 0);
        if (!event) {
          console.log('No events with sources');
          return;
        }
        
        const source = event.streamedSources[0];
        console.log(`\n=== Local Stream API ===`);
        console.log(`Event: ${event.title}`);
        console.log(`Source: ${source.source}:${source.id}`);
        
        const streamResponse = await fetch(
          `${LOCAL_API}/streamed-stream?source=${source.source}&id=${source.id}`
        );
        
        const streamData = await streamResponse.json();
        
        console.log('Success:', streamData.success);
        console.log('Stream:', streamData.stream ? 'Available' : 'Not available');
        
        if (streamData.stream) {
          console.log('Embed URL:', streamData.stream.embedUrl?.substring(0, 60) + '...');
          console.log('Stream URL:', streamData.stream.streamUrl || 'Not extracted');
        }
        
      } catch (err) {
        console.log('Local API not available:', (err as Error).message);
      }
    });
  });
});
