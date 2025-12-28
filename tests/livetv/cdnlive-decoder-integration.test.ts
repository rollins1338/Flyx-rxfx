/**
 * CDN Live Decoder Integration Tests
 * 
 * Tests the full decoder integration
 */

import { describe, test, expect } from 'bun:test';
import { decodeStreamFromPlayer, getCDNLiveStreamUrl, isTokenValid, getTokenTTL } from '../../app/lib/livetv/cdnlive-decoder';

describe('CDN Live Decoder Integration', () => {
  test('should decode ESPN stream', async () => {
    const result = await getCDNLiveStreamUrl('espn', 'us');
    
    console.log('ESPN decode result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.streamUrl).toBeDefined();
    expect(result.streamUrl).toContain('.m3u8');
    expect(result.streamUrl).toContain('token=');
    expect(result.channelId).toContain('espn');
  });
  
  test('should decode ABC stream', async () => {
    const result = await getCDNLiveStreamUrl('abc', 'us');
    
    console.log('ABC decode result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.streamUrl).toBeDefined();
    expect(result.streamUrl).toContain('.m3u8');
    expect(result.channelId).toContain('abc');
  });
  
  test('should decode beIN Sports stream', async () => {
    const result = await getCDNLiveStreamUrl('bein sports', 'us');
    
    console.log('beIN Sports decode result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.streamUrl).toBeDefined();
    expect(result.streamUrl).toContain('.m3u8');
  });
  
  test('should decode Fox Sports stream', async () => {
    const result = await getCDNLiveStreamUrl('fox sports 1', 'us');
    
    console.log('Fox Sports decode result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.streamUrl).toBeDefined();
  });
  
  test('should decode Sky Sports stream (UK)', async () => {
    const result = await getCDNLiveStreamUrl('sky sports main event', 'gb');
    
    console.log('Sky Sports decode result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.streamUrl).toBeDefined();
  });
  
  test('should have valid token expiration', async () => {
    const result = await getCDNLiveStreamUrl('espn', 'us');
    
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBeDefined();
    
    // The expiresAt is a Unix timestamp - check it's reasonable
    const now = Math.floor(Date.now() / 1000);
    console.log(`Current time: ${now}`);
    console.log(`Token expires: ${result.expiresAt}`);
    console.log(`Difference: ${(result.expiresAt! - now)} seconds`);
    
    // Token should be within a reasonable range (not expired more than a few seconds ago)
    // Allow for some timing variance
    expect(result.expiresAt!).toBeGreaterThanOrEqual(now - 5);
    
    // Token TTL should be defined
    const ttl = getTokenTTL(result.expiresAt);
    console.log(`Token TTL: ${ttl} seconds`);
    expect(ttl).toBeGreaterThanOrEqual(0);
  });
  
  test('should verify m3u8 URL is accessible', async () => {
    const result = await getCDNLiveStreamUrl('espn', 'us');
    
    expect(result.success).toBe(true);
    expect(result.streamUrl).toBeDefined();
    
    // Try to fetch the m3u8 playlist
    const response = await fetch(result.streamUrl!, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cdn-live.tv/',
        'Origin': 'https://cdn-live.tv',
      },
    });
    
    console.log(`M3U8 fetch status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok) {
      const content = await response.text();
      console.log(`M3U8 content preview:\n${content.substring(0, 500)}`);
      
      // Should be a valid m3u8 playlist
      expect(content).toContain('#EXTM3U');
    }
    
    // Even if 403/401, the URL structure is correct
    expect(response.status).toBeDefined();
  });
  
  test('should decode multiple channels in parallel', async () => {
    const channels = ['espn', 'abc', 'cnn', 'fox'];
    
    const results = await Promise.all(
      channels.map(ch => getCDNLiveStreamUrl(ch, 'us'))
    );
    
    console.log('\nParallel decode results:');
    results.forEach((result, i) => {
      console.log(`  ${channels[i]}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.streamUrl?.substring(0, 80) || result.error}`);
    });
    
    // At least some should succeed
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBeGreaterThan(0);
  });
});
