// Test M3U8 extraction with decryption analysis
const axios = require('axios');
const crypto = require('crypto');

// Use a known working m3u8 URL for testing
const TEST_M3U8_URLS = [
  // Add your working m3u8 URLs here for testing
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Public test stream
];

/**
 * Analyze m3u8 playlist and detect encryption
 */
async function analyzeM3U8(m3u8Url) {
  console.log(`\n🔍 Analyzing: ${m3u8Url}`);

  try {
    const response = await axios.get(m3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const content = response.data;
    console.log(`\n📄 Playlist content (first 500 chars):`);
    console.log(content.substring(0, 500));
    console.log('...\n');

    const info = {
      url: m3u8Url,
      type: 'unknown',
      encrypted: false,
      encryptionInfo: null,
      qualities: [],
      segments: [],
      valid: true
    };

    // Check if it's a master playlist (contains #EXT-X-STREAM-INF)
    if (content.includes('#EXT-X-STREAM-INF')) {
      info.type = 'master';
      info.qualities = extractQualities(content, m3u8Url);
      console.log(`✅ Master playlist with ${info.qualities.length} qualities`);
      
      // Analyze first quality
      if (info.qualities.length > 0) {
        console.log(`\n🔍 Analyzing first quality variant...`);
        const variantInfo = await analyzeM3U8(info.qualities[0].url);
        if (variantInfo.encrypted) {
          info.encrypted = true;
          info.encryptionInfo = variantInfo.encryptionInfo;
        }
      }
    } else if (content.includes('#EXTINF')) {
      info.type = 'media';
      info.segments = extractSegments(content, m3u8Url);
      console.log(`✅ Media playlist with ${info.segments.length} segments`);
    }

    // Check for encryption
    const keyMatch = content.match(/#EXT-X-KEY:([^\n]+)/);
    if (keyMatch) {
      info.encrypted = true;
      info.encryptionInfo = parseEncryptionInfo(keyMatch[1], m3u8Url);
      console.log(`\n🔒 ENCRYPTED STREAM DETECTED!`);
      console.log(`   Method: ${info.encryptionInfo.method}`);
      console.log(`   Key URI: ${info.encryptionInfo.uri}`);
      if (info.encryptionInfo.iv) {
        console.log(`   IV: ${info.encryptionInfo.iv}`);
      } else {
        console.log(`   IV: Generated from segment sequence (default HLS behavior)`);
      }

      // Try to fetch the key
      try {
        const key = await fetchDecryptionKey(info.encryptionInfo.uri, m3u8Url);
        console.log(`\n✅ Successfully fetched decryption key!`);
        console.log(`   Key size: ${key.length} bytes`);
        console.log(`   Key (hex): ${key.toString('hex')}`);
        info.encryptionInfo.key = key;

        // Test decryption on first segment if available
        if (info.segments.length > 0) {
          console.log(`\n🧪 Testing decryption on first segment...`);
          await testSegmentDecryption(info.segments[0], key, info.encryptionInfo.iv, m3u8Url);
        }
      } catch (error) {
        console.log(`\n❌ Could not fetch decryption key: ${error.message}`);
      }
    } else {
      console.log(`\n🔓 Not encrypted (clear stream)`);
    }

    return info;

  } catch (error) {
    console.log(`❌ Failed to analyze: ${error.message}`);
    return {
      url: m3u8Url,
      valid: false,
      error: error.message
    };
  }
}

/**
 * Extract quality levels from master playlist
 */
function extractQualities(content, baseUrl) {
  const qualities = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
      const resolutionMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
      const url = lines[i + 1]?.trim();

      if (url) {
        qualities.push({
          bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : null,
          resolution: resolutionMatch ? resolutionMatch[1] : null,
          url: url.startsWith('http') ? url : new URL(url, baseUrl).href
        });
      }
    }
  }

  return qualities;
}

/**
 * Extract segments from media playlist
 */
function extractSegments(content, baseUrl) {
  const segments = [];
  const lines = content.split('\n');
  let sequence = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF')) {
      const durationMatch = lines[i].match(/#EXTINF:([\d.]+)/);
      const url = lines[i + 1]?.trim();

      if (url && !url.startsWith('#')) {
        segments.push({
          sequence: sequence++,
          duration: durationMatch ? parseFloat(durationMatch[1]) : null,
          url: url.startsWith('http') ? url : new URL(url, baseUrl).href
        });
      }
    }
  }

  return segments;
}

/**
 * Parse EXT-X-KEY encryption information
 */
function parseEncryptionInfo(keyLine, baseUrl) {
  const info = {
    method: null,
    uri: null,
    iv: null,
    keyFormat: 'identity'
  };

  // Extract METHOD
  const methodMatch = keyLine.match(/METHOD=([^,\s]+)/);
  if (methodMatch) info.method = methodMatch[1];

  // Extract URI
  const uriMatch = keyLine.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const uri = uriMatch[1];
    info.uri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
  }

  // Extract IV
  const ivMatch = keyLine.match(/IV=0x([0-9A-Fa-f]+)/);
  if (ivMatch) info.iv = ivMatch[1];

  // Extract KEYFORMAT
  const keyFormatMatch = keyLine.match(/KEYFORMAT="([^"]+)"/);
  if (keyFormatMatch) info.keyFormat = keyFormatMatch[1];

  return info;
}

/**
 * Fetch decryption key from URI
 */
async function fetchDecryptionKey(keyUri, referer) {
  console.log(`\n🔑 Fetching decryption key from: ${keyUri}`);

  const response = await axios.get(keyUri, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer,
      'Origin': new URL(referer).origin
    },
    responseType: 'arraybuffer',
    timeout: 10000
  });

  return Buffer.from(response.data);
}

/**
 * Test decryption on a segment
 */
async function testSegmentDecryption(segment, key, iv, referer) {
  try {
    console.log(`   Downloading segment: ${segment.url.substring(0, 80)}...`);
    
    const response = await axios.get(segment.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer
      },
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 5 * 1024 * 1024 // 5MB max for test
    });

    const encryptedData = Buffer.from(response.data);
    console.log(`   ✅ Downloaded: ${encryptedData.length} bytes`);

    // Generate IV if not provided
    let ivBuffer;
    if (iv) {
      ivBuffer = Buffer.from(iv, 'hex');
    } else {
      // Default HLS behavior: IV = segment sequence number
      ivBuffer = Buffer.alloc(16);
      ivBuffer.writeUInt32BE(segment.sequence, 12);
      console.log(`   Generated IV from sequence ${segment.sequence}: ${ivBuffer.toString('hex')}`);
    }

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuffer);
    decipher.setAutoPadding(true);

    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    console.log(`   🔓 Decrypted: ${decryptedData.length} bytes`);
    console.log(`   First 16 bytes (hex): ${decryptedData.slice(0, 16).toString('hex')}`);
    
    // Check if it looks like valid TS data (starts with 0x47 sync byte)
    if (decryptedData[0] === 0x47) {
      console.log(`   ✅ Valid MPEG-TS data detected (sync byte 0x47 found)`);
    } else {
      console.log(`   ⚠️  First byte is 0x${decryptedData[0].toString(16)} (expected 0x47 for MPEG-TS)`);
    }

    return decryptedData;

  } catch (error) {
    console.log(`   ❌ Decryption test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('='.repeat(70));
  console.log('🎥 M3U8 DECRYPTION ANALYZER & TESTER');
  console.log('='.repeat(70));

  const args = process.argv.slice(2);
  const testUrls = args.length > 0 ? args : TEST_M3U8_URLS;

  if (testUrls.length === 0) {
    console.log(`
Usage:
  node test-m3u8-extraction-with-decryption.js <m3u8_url> [<m3u8_url2> ...]

Examples:
  node test-m3u8-extraction-with-decryption.js "https://example.com/playlist.m3u8"
  
  # Test with multiple URLs
  node test-m3u8-extraction-with-decryption.js "url1" "url2"

Note: Provide your own m3u8 URLs from vidsrc.cc or other providers
    `);
    process.exit(1);
  }

  for (const url of testUrls) {
    console.log('\n' + '='.repeat(70));
    try {
      const info = await analyzeM3U8(url);
      
      console.log('\n📊 ANALYSIS SUMMARY:');
      console.log(`   Type: ${info.type}`);
      console.log(`   Encrypted: ${info.encrypted ? '🔒 YES' : '🔓 NO'}`);
      
      if (info.encrypted && info.encryptionInfo) {
        console.log(`   Encryption Method: ${info.encryptionInfo.method}`);
        console.log(`   Key Format: ${info.encryptionInfo.keyFormat}`);
        console.log(`   Key Available: ${info.encryptionInfo.key ? '✅ YES' : '❌ NO'}`);
      }

      if (info.qualities.length > 0) {
        console.log(`   Qualities: ${info.qualities.length}`);
      }

      if (info.segments.length > 0) {
        console.log(`   Segments: ${info.segments.length}`);
        console.log(`   Total Duration: ~${Math.round(info.segments.reduce((sum, s) => sum + (s.duration || 0), 0))}s`);
      }

    } catch (error) {
      console.error(`\n❌ Error analyzing ${url}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('='.repeat(70));
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeM3U8,
  fetchDecryptionKey,
  testSegmentDecryption
};
