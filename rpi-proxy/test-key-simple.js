#!/usr/bin/env node
/**
 * Simple DLHD key test - run this ON the Raspberry Pi
 * 
 * Usage: node test-key-simple.js
 * 
 * This tests if your RPI's residential IP can fetch DLHD keys.
 * 
 * Expected results:
 *   - If your IP is residential and not blocked: ✓ KEY FETCH SUCCEEDED
 *   - If your IP is blocked or datacenter: ❌ KEY FETCH FAILED with E3 error
 */

const https = require('https');

// First, get a fresh key URL from the M3U8
async function getFreshKeyUrl() {
  return new Promise((resolve, reject) => {
    https.get('https://zekonew.kiko2.ru/zeko/premium51/mono.css', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Referer': 'https://epicplayplay.cfd/',
        'Origin': 'https://epicplayplay.cfd',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
        if (match) {
          resolve(match[1]);
        } else {
          reject(new Error('No key URL found in M3U8'));
        }
      });
    }).on('error', reject);
  });
}

// Fetch the key
async function fetchKey(keyUrl) {
  return new Promise((resolve) => {
    const url = new URL(keyUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Accept': '*/*',
        'Referer': 'https://epicplayplay.cfd/',
        'Origin': 'https://epicplayplay.cfd',
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

// Get public IP
async function getPublicIP() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve('unknown'));
  });
}

async function main() {
  console.log('=== DLHD Key Test ===\n');
  
  // Get public IP
  const ip = await getPublicIP();
  console.log('Your public IP:', ip);
  
  // Get fresh key URL
  console.log('\n1. Fetching fresh M3U8 to get current key URL...');
  let keyUrl;
  try {
    keyUrl = await getFreshKeyUrl();
    console.log('   Key URL:', keyUrl);
  } catch (e) {
    console.log('   ERROR:', e.message);
    return;
  }
  
  // Fetch the key
  console.log('\n2. Fetching key...');
  const result = await fetchKey(keyUrl);
  
  if (result.error) {
    console.log('   ERROR:', result.error);
    return;
  }
  
  console.log('   Status:', result.status);
  console.log('   Length:', result.data.length, 'bytes');
  
  if (result.data.length === 16) {
    const text = result.data.toString('utf8');
    if (text.includes('error')) {
      console.log('   Response:', text);
      console.log('\n❌ KEY FETCH FAILED - Your IP is blocked');
      console.log('   The key server returned an error.');
      console.log('   This could mean:');
      console.log('   1. Your IP is not residential');
      console.log('   2. Your IP has been flagged/blocked');
      console.log('   3. DLHD changed their blocking rules');
    } else {
      console.log('   Key (hex):', result.data.toString('hex'));
      console.log('\n✓ KEY FETCH SUCCEEDED!');
      console.log('   Your residential IP works for DLHD keys.');
    }
  } else {
    console.log('   Response:', result.data.toString('utf8').substring(0, 100));
    console.log('\n❌ Unexpected response');
  }
}

main().catch(console.error);
