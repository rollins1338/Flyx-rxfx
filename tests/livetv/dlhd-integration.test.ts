/**
 * DLHD Integration Tests
 * 
 * Tests the DLHD channels API and stream proxying.
 */

import { describe, test, expect } from 'bun:test';

const PLAYER_DOMAIN = 'epicplayplay.cfd';
const PARENT_DOMAIN = 'daddyhd.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ALL_SERVER_KEYS = ['zeko', 'wind', 'nfs', 'ddy6', 'chevy', 'top1/cdn'];
const CDN_DOMAINS = ['kiko2.ru', 'giokko.ru'];

describe('DLHD Integration Tests', () => {
  
  describe('DLHD Channels Data', () => {
    
    test('should load DLHD channels from JSON', async () => {
      const dlhdChannels = await import('@/app/data/dlhd-channels.json');
      
      console.log('Total channels:', dlhdChannels.totalChannels);
      console.log('Last updated:', dlhdChannels.lastUpdated);
      
      expect(dlhdChannels.channels).toBeDefined();
      expect(Array.isArray(dlhdChannels.channels)).toBe(true);
      expect(dlhdChannels.channels.length).toBeGreaterThan(0);
      
      // Sample channels
      console.log('\nSample channels:');
      for (const ch of dlhdChannels.channels.slice(0, 5)) {
        console.log(`  ${ch.id}: ${ch.name} (${ch.category}, ${ch.country})`);
      }
    });
    
    test('should have valid channel structure', async () => {
      const dlhdChannels = await import('@/app/data/dlhd-channels.json');
      
      const channel = dlhdChannels.channels[0];
      console.log('Sample channel:', JSON.stringify(channel, null, 2));
      
      expect(channel.id).toBeDefined();
      expect(channel.name).toBeDefined();
      expect(channel.category).toBeDefined();
      expect(channel.country).toBeDefined();
    });
    
    test('should have sports channels', async () => {
      const dlhdChannels = await import('@/app/data/dlhd-channels.json');
      
      const sportsChannels = dlhdChannels.channels.filter(
        (ch: any) => ch.category === 'sports'
      );
      
      console.log(`\nSports channels: ${sportsChannels.length}`);
      
      // Find popular sports channels
      const popularNames = ['espn', 'fox sports', 'sky sports', 'bein'];
      for (const name of popularNames) {
        const found = sportsChannels.filter((ch: any) => 
          ch.name.toLowerCase().includes(name)
        );
        if (found.length > 0) {
          console.log(`  ${name}: ${found.length} channels`);
          console.log(`    Sample: ${found[0].id} - ${found[0].name}`);
        }
      }
    });
  });
  
  describe('DLHD Player Page', () => {
    
    test('should fetch player page and extract auth tokens', async () => {
      // Test with a known channel (ESPN - usually channel 51)
      const testChannel = '51';
      
      const referer = `https://${PARENT_DOMAIN}/stream/stream-${testChannel}.php`;
      const playerUrl = `https://${PLAYER_DOMAIN}/premiumtv/daddyhd.php?id=${testChannel}`;
      
      console.log(`\nFetching player page for channel ${testChannel}`);
      console.log(`URL: ${playerUrl}`);
      console.log(`Referer: ${referer}`);
      
      const response = await fetch(playerUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': referer,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      
      console.log('Response status:', response.status);
      expect(response.ok).toBe(true);
      
      const html = await response.text();
      console.log('HTML length:', html.length);
      
      // Extract auth tokens
      const tokenMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
      const channelKeyMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
      const countryMatch = html.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
      const tsMatch = html.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);
      
      console.log('\nExtracted tokens:');
      console.log('  AUTH_TOKEN:', tokenMatch ? tokenMatch[1].substring(0, 20) + '...' : 'NOT FOUND');
      console.log('  CHANNEL_KEY:', channelKeyMatch ? channelKeyMatch[1] : 'NOT FOUND');
      console.log('  AUTH_COUNTRY:', countryMatch ? countryMatch[1] : 'NOT FOUND');
      console.log('  AUTH_TS:', tsMatch ? tsMatch[1] : 'NOT FOUND');
      
      expect(tokenMatch).toBeDefined();
      expect(tokenMatch![1].length).toBeGreaterThan(10);
    });
    
    test('should try different referer paths', async () => {
      const testChannel = '51';
      const refererPaths = [
        `https://${PARENT_DOMAIN}/watch.php?id=${testChannel}`,
        `https://${PARENT_DOMAIN}/stream/stream-${testChannel}.php`,
        `https://${PARENT_DOMAIN}/cast/stream-${testChannel}.php`,
        `https://${PARENT_DOMAIN}/watch/stream-${testChannel}.php`,
      ];
      
      console.log('\nTrying different referer paths:');
      
      for (const referer of refererPaths) {
        const playerUrl = `https://${PLAYER_DOMAIN}/premiumtv/daddyhd.php?id=${testChannel}`;
        
        try {
          const response = await fetch(playerUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': referer,
              'Accept': 'text/html,application/xhtml+xml',
            },
          });
          
          const html = await response.text();
          const hasToken = html.includes('AUTH_TOKEN');
          
          console.log(`  ${referer.split('/').slice(-1)[0]}: ${response.status} - Token: ${hasToken ? 'YES' : 'NO'}`);
        } catch (err) {
          console.log(`  ${referer.split('/').slice(-1)[0]}: ERROR - ${(err as Error).message}`);
        }
      }
    });
  });
  
  describe('DLHD Server Lookup', () => {
    
    test('should lookup server key for channel', async () => {
      const channelKey = 'premium51';
      
      console.log(`\nLooking up server for ${channelKey}`);
      
      const response = await fetch(
        `https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': `https://${PLAYER_DOMAIN}/`,
          },
        }
      );
      
      console.log('Server lookup status:', response.status);
      
      if (response.ok) {
        const text = await response.text();
        console.log('Server lookup response:', text);
        
        if (!text.startsWith('<')) {
          const data = JSON.parse(text);
          console.log('Server key:', data.server_key);
          expect(data.server_key).toBeDefined();
        }
      }
    });
    
    test('should construct valid M3U8 URLs', () => {
      const channelKey = 'premium51';
      
      console.log('\nConstructed M3U8 URLs:');
      
      for (const serverKey of ALL_SERVER_KEYS) {
        for (const domain of CDN_DOMAINS) {
          let url: string;
          if (serverKey === 'top1/cdn') {
            url = `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
          } else {
            url = `https://${serverKey}new.${domain}/${serverKey}/${channelKey}/mono.css`;
          }
          console.log(`  ${serverKey}@${domain}: ${url}`);
        }
      }
    });
  });
  
  describe('DLHD M3U8 Fetch', () => {
    
    test('should fetch M3U8 playlist from CDN', async () => {
      const channelKey = 'premium51';
      
      // First get server key
      let serverKey = 'zeko'; // default
      try {
        const lookupResponse = await fetch(
          `https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`,
          {
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': `https://${PLAYER_DOMAIN}/`,
            },
          }
        );
        
        if (lookupResponse.ok) {
          const text = await lookupResponse.text();
          if (!text.startsWith('<')) {
            const data = JSON.parse(text);
            if (data.server_key) {
              serverKey = data.server_key;
            }
          }
        }
      } catch {}
      
      console.log(`\nUsing server key: ${serverKey}`);
      
      // Try to fetch M3U8
      let foundWorking = false;
      
      for (const domain of CDN_DOMAINS) {
        let m3u8Url: string;
        if (serverKey === 'top1/cdn') {
          m3u8Url = `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
        } else {
          m3u8Url = `https://${serverKey}new.${domain}/${serverKey}/${channelKey}/mono.css`;
        }
        
        console.log(`\nTrying: ${m3u8Url}`);
        
        try {
          const response = await fetch(`${m3u8Url}?_t=${Date.now()}`, {
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': `https://${PLAYER_DOMAIN}/`,
            },
          });
          
          console.log('Status:', response.status);
          
          if (response.ok) {
            const content = await response.text();
            console.log('Content preview:', content.substring(0, 300));
            
            if (content.includes('#EXTM3U') || content.includes('#EXT-X-')) {
              console.log('✓ Valid M3U8 playlist found!');
              foundWorking = true;
              
              // Check for encryption
              if (content.includes('#EXT-X-KEY')) {
                console.log('Stream is encrypted (has EXT-X-KEY)');
                
                // Extract key URL
                const keyMatch = content.match(/URI="([^"]+)"/);
                if (keyMatch) {
                  console.log('Key URL:', keyMatch[1]);
                }
              }
              
              break;
            }
          }
        } catch (err) {
          console.log('Error:', (err as Error).message);
        }
      }
      
      // If primary server didn't work, try others
      if (!foundWorking) {
        console.log('\nPrimary server failed, trying alternatives...');
        
        for (const altServerKey of ALL_SERVER_KEYS) {
          if (altServerKey === serverKey) continue;
          
          for (const domain of CDN_DOMAINS) {
            let m3u8Url: string;
            if (altServerKey === 'top1/cdn') {
              m3u8Url = `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
            } else {
              m3u8Url = `https://${altServerKey}new.${domain}/${altServerKey}/${channelKey}/mono.css`;
            }
            
            try {
              const response = await fetch(`${m3u8Url}?_t=${Date.now()}`, {
                headers: {
                  'User-Agent': USER_AGENT,
                  'Referer': `https://${PLAYER_DOMAIN}/`,
                },
              });
              
              if (response.ok) {
                const content = await response.text();
                if (content.includes('#EXTM3U') || content.includes('#EXT-X-')) {
                  console.log(`✓ Found working: ${altServerKey}@${domain}`);
                  foundWorking = true;
                  break;
                }
              }
            } catch {}
          }
          
          if (foundWorking) break;
        }
      }
      
      expect(foundWorking).toBe(true);
    });
  });
});
