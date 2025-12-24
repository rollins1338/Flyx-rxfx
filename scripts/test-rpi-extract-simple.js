#!/usr/bin/env node
/**
 * Simple test of RPI /animekai/extract endpoint
 * Uses a known encrypted embed from AnimeKai
 */

const https = require('https');

const RPI_PROXY_URL = 'https://rpi-proxy.vynx.cc';
const RPI_PROXY_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

// This is a sample encrypted embed - we need to get a fresh one
// Let's first test the health endpoint
const healthUrl = `${RPI_PROXY_URL}/health`;

console.log('Testing RPI health...');
https.get(healthUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Health: ${res.statusCode}`);
    console.log(data);
  });
}).on('error', e => console.log(`Error: ${e.message}`));
