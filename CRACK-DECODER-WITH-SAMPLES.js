/**
 * CRACK THE DECODER BY ANALYZING MULTIPLE INPUT/OUTPUT SAMPLES
 * We'll get multiple div contents and their decoded outputs to find the pattern
 */

const puppeteer = require('puppeteer');
const VidsrcProExtractor = require('./VIDSRC-PRO-WORKING-EXTRACTOR.js');

async function getSample(type, tmdbId, season, episode) {
  const extractor = new VidsrcProExtractor({ debug: false });
  
  // Get div info
  const result = type === 'movie' 
    ? await extractor.extractMovie(tmdbId)
    : await extractor.extractTvEpisode(tmdbId, season, episode);
  
  // Get decoded output with Puppeteer
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Referer': 'https://vidsrc-embed.ru/',
    'Origin': 'https://vidsrc-embed.ru'
  });
  
  await page.goto(result.proRcpUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  
  try {
    await page.waitForFunction(
      (divId) => window[divId] !== undefined,
      { timeout: 20000 },
      result.divId
    );
  } catch (e) {}
  
  const decoded = await page.evaluate((divId) => window[divId], result.divId);
  await browser.close();
  
  return {
    divId: result.divId,
    encoded: result.divContent,
    decoded: decoded
  };
}

(async () => {
  console.log('🔬 Collecting samples to crack the decoder...\n');
  
  const samples = [];
  
  // Sample 1: Fight Club
  console.log('📦 Sample 1: Fight Club (550)');
  try {
    const s1 = await getSample('movie', 550);
    samples.push(s1);
    console.log('✅ Collected');
  } catch (e) {
    console.log('❌ Failed:', e.message);
  }
  
  // Sample 2: The Matrix
  console.log('📦 Sample 2: The Matrix (603)');
  try {
    const s2 = await getSample('movie', 603);
    samples.push(s2);
    console.log('✅ Collected');
  } catch (e) {
    console.log('❌ Failed:', e.message);
  }
  
  // Sample 3: Inception
  console.log('📦 Sample 3: Inception (27205)');
  try {
    const s3 = await getSample('movie', 27205);
    samples.push(s3);
    console.log('✅ Collected');
  } catch (e) {
    console.log('❌ Failed:', e.message);
  }
  
  console.log(`\n✅ Collected ${samples.length} samples\n`);
  
  // Analyze samples
  console.log('🔍 ANALYSIS:\n');
  
  samples.forEach((sample, i) => {
    console.log(`Sample ${i + 1}:`);
    console.log('  Div ID:', sample.divId);
    console.log('  Encoded length:', sample.encoded.length);
    console.log('  Decoded length:', sample.decoded ? sample.decoded.length : 'NULL');
    console.log('  Encoded (first 100):', sample.encoded.substring(0, 100));
    console.log('  Decoded (first 100):', sample.decoded ? sample.decoded.substring(0, 100) : 'NULL');
    console.log('');
  });
  
  // Try to find patterns
  console.log('🔎 Looking for patterns...\n');
  
  // Check if div ID is used in decoding
  samples.forEach((sample, i) => {
    if (sample.decoded) {
      const divIdInDecoded = sample.decoded.includes(sample.divId);
      console.log(`Sample ${i + 1}: Div ID in decoded? ${divIdInDecoded}`);
    }
  });
  
  // Try simple base64 decode
  console.log('\n🧪 Testing base64 decode...');
  samples.forEach((sample, i) => {
    try {
      const decoded = Buffer.from(sample.encoded, 'base64').toString('utf8');
      const hasM3u8 = decoded.includes('.m3u8') || decoded.includes('http');
      console.log(`Sample ${i + 1}: Base64 decode contains m3u8/http? ${hasM3u8}`);
      if (hasM3u8) {
        console.log('  🎯 FOUND IT! Base64 decode works!');
        console.log('  Result:', decoded);
      }
    } catch (e) {
      console.log(`Sample ${i + 1}: Base64 decode failed`);
    }
  });
  
  // Try XOR with div ID
  console.log('\n🧪 Testing XOR with div ID...');
  samples.forEach((sample, i) => {
    try {
      const decoded = Buffer.from(sample.encoded, 'base64');
      const divIdBytes = Buffer.from(sample.divId);
      
      let result = '';
      for (let j = 0; j < Math.min(decoded.length, 200); j++) {
        const xored = decoded[j] ^ divIdBytes[j % divIdBytes.length];
        result += String.fromCharCode(xored);
      }
      
      const hasM3u8 = result.includes('.m3u8') || result.includes('http');
      console.log(`Sample ${i + 1}: XOR with div ID contains m3u8/http? ${hasM3u8}`);
      if (hasM3u8) {
        console.log('  🎯 FOUND IT! XOR works!');
        console.log('  Result:', result);
      }
    } catch (e) {
      console.log(`Sample ${i + 1}: XOR failed:`, e.message);
    }
  });
  
  // Save samples
  const fs = require('fs');
  fs.writeFileSync('decoder-samples.json', JSON.stringify(samples, null, 2));
  console.log('\n💾 Samples saved to decoder-samples.json');
  
})().catch(console.error);
