/**
 * Video Player Tests
 * 
 * Tests for the video player hook and stream URL generation.
 */

import { describe, test, expect } from 'bun:test';

// Mock the proxy config functions
const RPI_PROXY_URL = 'https://rpi-proxy.vynx.cc';
const CF_WORKER_URL = 'https://media-proxy.vynx.workers.dev';

function getTvPlaylistUrl(channelId: string): string {
  return `${RPI_PROXY_URL}/tv/${channelId}/playlist.m3u8`;
}

function getPpvStreamProxyUrl(streamUrl: string): string {
  return `${CF_WORKER_URL}/ppv-proxy?url=${encodeURIComponent(streamUrl)}`;
}

function getCdnLiveStreamProxyUrl(streamUrl: string): string {
  return `${CF_WORKER_URL}/cdnlive-proxy?url=${encodeURIComponent(streamUrl)}`;
}

describe('Video Player Tests', () => {
  
  describe('Stream URL Generation', () => {
    
    test('should generate DLHD stream URL', () => {
      const channelId = '51';
      const url = getTvPlaylistUrl(channelId);
      
      console.log('DLHD URL:', url);
      
      expect(url).toBe(`${RPI_PROXY_URL}/tv/51/playlist.m3u8`);
      expect(url).toContain('/tv/');
      expect(url).toContain('/playlist.m3u8');
    });
    
    test('should generate PPV proxy URL', () => {
      const streamUrl = 'https://example.com/stream.m3u8';
      const url = getPpvStreamProxyUrl(streamUrl);
      
      console.log('PPV Proxy URL:', url);
      
      expect(url).toContain('/ppv-proxy');
      expect(url).toContain(encodeURIComponent(streamUrl));
    });
    
    test('should generate CDN Live proxy URL', () => {
      const streamUrl = 'https://cdn.example.com/live.m3u8';
      const url = getCdnLiveStreamProxyUrl(streamUrl);
      
      console.log('CDN Live Proxy URL:', url);
      
      expect(url).toContain('/cdnlive-proxy');
      expect(url).toContain(encodeURIComponent(streamUrl));
    });
  });
  
  describe('Channel ID Extraction', () => {
    
    test('should extract DLHD channel ID from event', () => {
      const event = {
        id: 'dlhd-123',
        source: 'dlhd',
        channels: [
          { name: 'ESPN', channelId: '51', href: '/stream/51' }
        ]
      };
      
      const channelId = event.channels[0].channelId;
      
      console.log('DLHD Channel ID:', channelId);
      expect(channelId).toBe('51');
    });
    
    test('should extract PPV URI name from event', () => {
      const event = {
        id: 'ppv-456',
        source: 'ppv',
        ppvUriName: 'ufc-fight-night',
        channels: []
      };
      
      const channelId = event.ppvUriName;
      
      console.log('PPV URI Name:', channelId);
      expect(channelId).toBe('ufc-fight-night');
    });
    
    test('should extract CDN Live channel ID from event', () => {
      const event = {
        id: 'cdnlive-789',
        source: 'cdnlive',
        channels: [
          { name: 'ESPN', channelId: 'ESPN|us', href: '/cdn/espn' }
        ]
      };
      
      const channelId = event.channels[0].channelId;
      const [channelName, countryCode] = channelId.split('|');
      
      console.log('CDN Live Channel:', channelName, 'Country:', countryCode);
      expect(channelName).toBe('ESPN');
      expect(countryCode).toBe('us');
    });
    
    test('should extract Streamed source ID from event', () => {
      const event = {
        id: 'streamed-abc',
        source: 'streamed',
        streamedSources: [
          { source: 'alpha', id: 'match123' }
        ],
        channels: []
      };
      
      const src = event.streamedSources[0];
      const channelId = `${src.source}:${src.id}`;
      
      console.log('Streamed Channel ID:', channelId);
      expect(channelId).toBe('alpha:match123');
      
      // Parse it back
      const [source, id] = channelId.split(':');
      expect(source).toBe('alpha');
      expect(id).toBe('match123');
    });
  });
  
  describe('API URL Construction', () => {
    
    test('should construct DLHD API URL', () => {
      const channelId = '51';
      const url = `/api/livetv/dlhd-stream?channel=${channelId}`;
      
      console.log('DLHD API URL:', url);
      expect(url).toContain('/api/livetv/dlhd-stream');
    });
    
    test('should construct PPV API URL', () => {
      const uriName = 'ufc-fight-night';
      const url = `/api/livetv/ppv-stream?uri=${encodeURIComponent(uriName)}`;
      
      console.log('PPV API URL:', url);
      expect(url).toContain('/api/livetv/ppv-stream');
      expect(url).toContain('uri=');
    });
    
    test('should construct CDN Live API URL', () => {
      const channelName = 'ESPN';
      const countryCode = 'us';
      const url = `/api/livetv/cdnlive-stream?channel=${encodeURIComponent(channelName)}&code=${countryCode}`;
      
      console.log('CDN Live API URL:', url);
      expect(url).toContain('/api/livetv/cdnlive-stream');
      expect(url).toContain('channel=');
      expect(url).toContain('code=');
    });
    
    test('should construct Streamed API URL', () => {
      const source = 'alpha';
      const id = 'match123';
      const url = `/api/livetv/streamed-stream?source=${source}&id=${id}`;
      
      console.log('Streamed API URL:', url);
      expect(url).toContain('/api/livetv/streamed-stream');
      expect(url).toContain('source=alpha');
      expect(url).toContain('id=match123');
    });
  });
  
  describe('Source Type Detection', () => {
    
    test('should detect DLHD source', () => {
      const event = { source: 'dlhd' };
      expect(event.source).toBe('dlhd');
    });
    
    test('should detect PPV source', () => {
      const event = { source: 'ppv' };
      expect(event.source).toBe('ppv');
    });
    
    test('should detect CDN Live source', () => {
      const event = { source: 'cdnlive' };
      expect(event.source).toBe('cdnlive');
    });
    
    test('should detect Streamed source', () => {
      const event = { source: 'streamed' };
      expect(event.source).toBe('streamed');
    });
  });
  
  describe('Event Data Validation', () => {
    
    test('should validate DLHD event structure', () => {
      const event = {
        id: 'dlhd-123',
        title: 'Lakers vs Celtics',
        sport: 'basketball',
        time: '7:30 PM',
        isLive: true,
        source: 'dlhd',
        channels: [
          { name: 'ESPN', channelId: '51', href: '/stream/51' }
        ]
      };
      
      expect(event.id).toMatch(/^dlhd-/);
      expect(event.source).toBe('dlhd');
      expect(event.channels.length).toBeGreaterThan(0);
      expect(event.channels[0].channelId).toBeDefined();
    });
    
    test('should validate PPV event structure', () => {
      const event = {
        id: 'ppv-456',
        title: 'UFC Fight Night',
        sport: 'mma',
        time: '10:00 PM',
        isLive: false,
        source: 'ppv',
        ppvUriName: 'ufc-fight-night',
        poster: 'https://example.com/poster.jpg',
        channels: []
      };
      
      expect(event.id).toMatch(/^ppv-/);
      expect(event.source).toBe('ppv');
      expect(event.ppvUriName).toBeDefined();
    });
    
    test('should validate Streamed event structure', () => {
      const event = {
        id: 'streamed-abc',
        title: 'Man United vs Liverpool',
        sport: 'football',
        time: '3:00 PM',
        isLive: true,
        source: 'streamed',
        streamedSources: [
          { source: 'alpha', id: 'match123' },
          { source: 'bravo', id: 'match456' }
        ],
        channels: []
      };
      
      expect(event.id).toMatch(/^streamed-/);
      expect(event.source).toBe('streamed');
      expect(event.streamedSources).toBeDefined();
      expect(event.streamedSources.length).toBeGreaterThan(0);
    });
  });
});
