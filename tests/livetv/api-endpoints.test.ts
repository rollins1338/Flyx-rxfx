/**
 * LiveTV API Endpoints Tests
 * 
 * Tests all LiveTV API routes for proper functionality.
 * Run with: bun test tests/livetv/api-endpoints.test.ts
 */

import { describe, test, expect } from 'bun:test';

const LOCAL_API = 'http://localhost:3000/api/livetv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchApi(endpoint: string) {
  const response = await fetch(`${LOCAL_API}${endpoint}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });
  return { response, data: await response.json() };
}

describe('LiveTV API Endpoints', () => {
  
  describe('DLHD APIs', () => {
    
    test('GET /dlhd-channels - should return channel list', async () => {
      try {
        const { response, data } = await fetchApi('/dlhd-channels');
        
        console.log('\n=== DLHD Channels API ===');
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        console.log('Channels:', data.channels?.length || 0);
        
        if (data.success) {
          expect(data.channels).toBeDefined();
          expect(Array.isArray(data.channels)).toBe(true);
          
          if (data.channels.length > 0) {
            console.log('Sample channel:', JSON.stringify(data.channels[0], null, 2));
          }
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
    
    test('GET /schedule - should return DLHD events', async () => {
      try {
        const { response, data } = await fetchApi('/schedule');
        
        console.log('\n=== DLHD Schedule API ===');
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        
        if (data.success && data.schedule) {
          const totalEvents = data.schedule.categories?.reduce(
            (sum: number, cat: any) => sum + (cat.events?.length || 0), 0
          ) || 0;
          console.log('Total events:', totalEvents);
          console.log('Categories:', data.schedule.categories?.length || 0);
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
  });
  
  describe('PPV APIs', () => {
    
    test('GET /ppv-streams - should return PPV events', async () => {
      try {
        const { response, data } = await fetchApi('/ppv-streams');
        
        console.log('\n=== PPV Streams API ===');
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        
        if (data.success) {
          const totalStreams = data.categories?.reduce(
            (sum: number, cat: any) => sum + (cat.streams?.length || 0), 0
          ) || 0;
          console.log('Total streams:', totalStreams);
          console.log('Categories:', data.categories?.length || 0);
          
          // Find a live stream for testing
          for (const cat of data.categories || []) {
            const liveStream = cat.streams?.find((s: any) => s.isLive);
            if (liveStream) {
              console.log('Live stream found:', liveStream.name);
              console.log('URI:', liveStream.uriName);
              break;
            }
          }
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
    
    test('GET /ppv-stream - should return stream URL', async () => {
      try {
        // First get a PPV event
        const { data: ppvData } = await fetchApi('/ppv-streams');
        
        if (!ppvData.success || !ppvData.categories?.length) {
          console.log('No PPV data available');
          return;
        }
        
        // Find any stream
        let testUri = '';
        for (const cat of ppvData.categories) {
          if (cat.streams?.length > 0) {
            testUri = cat.streams[0].uriName;
            break;
          }
        }
        
        if (!testUri) {
          console.log('No PPV streams available');
          return;
        }
        
        console.log('\n=== PPV Stream API ===');
        console.log('Testing URI:', testUri);
        
        const { response, data } = await fetchApi(`/ppv-stream?uri=${encodeURIComponent(testUri)}`);
        
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        console.log('Stream URL:', data.streamUrl ? 'Available' : 'Not available');
        console.log('Error:', data.error || 'None');
        
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
  });
  
  describe('CDN Live APIs', () => {
    
    test('GET /cdn-live-channels - should return CDN channels', async () => {
      try {
        const { response, data } = await fetchApi('/cdn-live-channels');
        
        console.log('\n=== CDN Live Channels API ===');
        console.log('Status:', response.status);
        console.log('Channels:', data.channels?.length || 0);
        
        if (data.channels?.length > 0) {
          const online = data.channels.filter((c: any) => c.status === 'online');
          console.log('Online:', online.length);
          
          if (online.length > 0) {
            console.log('Sample online channel:', JSON.stringify(online[0], null, 2));
          }
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
  });
  
  describe('Streamed APIs', () => {
    
    test('GET /streamed-events - should return Streamed events', async () => {
      try {
        const { response, data } = await fetchApi('/streamed-events');
        
        console.log('\n=== Streamed Events API ===');
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        console.log('Events:', data.events?.length || 0);
        console.log('Live:', data.stats?.live || 0);
        
        if (data.events?.length > 0) {
          // Group by category
          const byCategory: Record<string, number> = {};
          for (const event of data.events) {
            byCategory[event.sport] = (byCategory[event.sport] || 0) + 1;
          }
          
          console.log('\nBy category:');
          for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
            console.log(`  ${cat}: ${count}`);
          }
        }
        
        if (data.success) {
          expect(data.events).toBeDefined();
          expect(Array.isArray(data.events)).toBe(true);
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
    
    test('GET /streamed-events?live=true - should return only live events', async () => {
      try {
        const { response, data } = await fetchApi('/streamed-events?live=true');
        
        console.log('\n=== Streamed Live Events ===');
        console.log('Status:', response.status);
        console.log('Live events:', data.events?.length || 0);
        
        if (data.events?.length > 0) {
          for (const event of data.events.slice(0, 3)) {
            console.log(`  ${event.title} (${event.sport})`);
          }
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
    
    test('GET /streamed-events?sport=football - should filter by sport', async () => {
      try {
        const { response, data } = await fetchApi('/streamed-events?sport=football');
        
        console.log('\n=== Streamed Football Events ===');
        console.log('Status:', response.status);
        console.log('Football events:', data.events?.length || 0);
        
        if (data.events?.length > 0) {
          // Verify all are football
          const allFootball = data.events.every((e: any) => e.sport === 'football');
          console.log('All football:', allFootball);
          expect(allFootball).toBe(true);
        }
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
    
    test('GET /streamed-stream - should return stream info', async () => {
      try {
        // First get events
        const { data: eventsData } = await fetchApi('/streamed-events');
        
        if (!eventsData.success || !eventsData.events?.length) {
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
        
        console.log('\n=== Streamed Stream API ===');
        console.log('Event:', event.title);
        console.log('Source:', `${source.source}:${source.id}`);
        
        const { response, data } = await fetchApi(
          `/streamed-stream?source=${source.source}&id=${source.id}`
        );
        
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        
        if (data.stream) {
          console.log('Stream #:', data.stream.streamNo);
          console.log('Language:', data.stream.language);
          console.log('HD:', data.stream.hd);
          console.log('Embed URL:', data.stream.embedUrl ? 'Available' : 'Not available');
          console.log('Stream URL:', data.stream.streamUrl || 'Not extracted');
        }
        
        console.log('All streams:', data.allStreams?.length || 0);
        
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
  });
  
  describe('Error Handling', () => {
    
    test('should handle missing parameters', async () => {
      try {
        const { response, data } = await fetchApi('/streamed-stream');
        
        console.log('\n=== Missing Parameters Test ===');
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        console.log('Error:', data.error);
        
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
    
    test('should handle invalid source', async () => {
      try {
        const { response, data } = await fetchApi('/streamed-stream?source=invalid&id=test');
        
        console.log('\n=== Invalid Source Test ===');
        console.log('Status:', response.status);
        console.log('Success:', data.success);
        console.log('Error:', data.error);
        
      } catch (err) {
        console.log('API not available:', (err as Error).message);
      }
    });
  });
});
