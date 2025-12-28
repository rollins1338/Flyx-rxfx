/**
 * CDN Live API Updated Tests
 * 
 * Tests for the updated CDN Live API endpoints
 */

import { describe, test, expect } from 'bun:test';

const API_BASE = 'https://api.cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('CDN Live Updated API Tests', () => {
  test('should fetch channels from CDN Live API', async () => {
    const response = await fetch(`${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    console.log(`Total channels: ${data.total_channels}`);
    expect(data.channels).toBeDefined();
    expect(data.channels.length).toBeGreaterThan(0);
    
    // Check channel structure
    const channel = data.channels[0];
    expect(channel.name).toBeDefined();
    expect(channel.code).toBeDefined();
    expect(channel.url).toBeDefined();
    expect(channel.status).toBeDefined();
    
    // Count online channels
    const onlineCount = data.channels.filter((ch: any) => ch.status === 'online').length;
    console.log(`Online channels: ${onlineCount}`);
    
    // Group by country
    const countries = new Set(data.channels.map((ch: any) => ch.code));
    console.log(`Countries: ${Array.from(countries).join(', ')}`);
  });
  
  test('should categorize channels correctly', async () => {
    const response = await fetch(`${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const data = await response.json();
    
    // Sport keywords for categorization
    const sportKeywords: Record<string, string[]> = {
      'sports': ['sports', 'espn', 'fox sports', 'sky sports', 'bein', 'dazn'],
      'soccer': ['soccer', 'football', 'premier', 'la liga'],
      'basketball': ['basketball', 'nba'],
      'american football': ['nfl', 'ncaa football'],
      'hockey': ['hockey', 'nhl'],
      'cricket': ['cricket', 'ipl'],
    };
    
    // Categorize channels
    const categories: Record<string, number> = {};
    
    for (const channel of data.channels) {
      const nameLower = channel.name.toLowerCase();
      let category = 'entertainment';
      
      for (const [cat, keywords] of Object.entries(sportKeywords)) {
        for (const keyword of keywords) {
          if (nameLower.includes(keyword)) {
            category = cat;
            break;
          }
        }
        if (category !== 'entertainment') break;
      }
      
      categories[category] = (categories[category] || 0) + 1;
    }
    
    console.log('\nChannel categories:');
    for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
    
    expect(Object.keys(categories).length).toBeGreaterThan(0);
  });
  
  test('should find sports channels', async () => {
    const response = await fetch(`${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const data = await response.json();
    
    // Find sports channels
    const sportsChannels = data.channels.filter((ch: any) => {
      const nameLower = ch.name.toLowerCase();
      return nameLower.includes('espn') || 
             nameLower.includes('sports') || 
             nameLower.includes('fox') ||
             nameLower.includes('nfl') ||
             nameLower.includes('nba');
    });
    
    console.log(`\nSports channels found: ${sportsChannels.length}`);
    sportsChannels.slice(0, 10).forEach((ch: any) => {
      console.log(`  ${ch.name} (${ch.code}) - ${ch.status} - ${ch.viewers} viewers`);
    });
    
    expect(sportsChannels.length).toBeGreaterThan(0);
  });
  
  test('should test player URL accessibility', async () => {
    const response = await fetch(`${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const data = await response.json();
    
    // Get first online channel
    const onlineChannel = data.channels.find((ch: any) => ch.status === 'online');
    
    if (!onlineChannel) {
      console.log('No online channels found');
      return;
    }
    
    console.log(`\nTesting player URL for: ${onlineChannel.name}`);
    console.log(`Player URL: ${onlineChannel.url}`);
    
    // Test player URL
    const playerResponse = await fetch(onlineChannel.url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    console.log(`Player page status: ${playerResponse.status}`);
    expect(playerResponse.ok).toBe(true);
    
    const html = await playerResponse.text();
    console.log(`Player HTML length: ${html.length}`);
    
    // Check for OPlayer
    const hasOPlayer = html.includes('oplayer') || html.includes('OPlayer');
    console.log(`Uses OPlayer: ${hasOPlayer}`);
    
    // Check for video element
    const hasVideo = html.includes('<video') || html.includes('player');
    console.log(`Has video/player: ${hasVideo}`);
  });
});
