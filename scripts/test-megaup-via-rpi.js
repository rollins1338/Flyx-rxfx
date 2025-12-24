#!/usr/bin/env node
/**
 * Test MegaUp /media/ fetch via RPI proxy
 * This tests if the RPI can fetch from MegaUp and what response it gets
 */

const https = require('https');

const RPI_PROXY_URL = 'https://rpi-proxy.vynx.cc';
const RPI_PROXY_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

// Test video ID from DBZ
const testVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
const testHost = 'megaup22.online';
const mediaUrl = `https://${testHost}/media/${testVideoId}`;

// Use the RPI's /animekai endpoint to proxy the request
const proxyUrl = `${RPI_PROXY_URL}/animekai?key=${RPI_PROXY_KEY}&url=${encodeURIComponent(mediaUrl)}`;

console.log(`Testing MegaUp fetch via RPI proxy`);
console.log(`Target: ${mediaUrl}`);
console.log(`Proxy: ${proxyUrl.substring(0, 100)}...`);

https.get(proxyUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`\nStatus: ${res.statusCode}`);
    console.log(`Response length: ${data.length}`);
    console.log(`Response (first 500 chars):\n${data.substring(0, 500)}`);
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(data);
      console.log(`\nParsed JSON:`);
      console.log(`- status: ${json.status}`);
      console.log(`- result length: ${json.result?.length || 'N/A'}`);
      
      if (json.result) {
        // Show first 100 chars of encrypted result
        console.log(`- result (first 100): ${json.result.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`\nNot JSON: ${e.message}`);
    }
  });
}).on('error', (e) => {
  console.log(`Error: ${e.message}`);
});
