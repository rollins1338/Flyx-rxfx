// Extract M3U8 URLs and handle encryption
const axios = require('axios');
const crypto = require('crypto');

// ============================================
// M3U8 EXTRACTION (from your existing work)
// ============================================

/**
 * Extract m3u8 from various providers
 */
async function extractM3U8FromProvider(tmdbId, season = null, episode = null) {
  const results = {
    tmdbId,
    season,
    episode,
    sources: []
  };

  console.log(`\n🎬 Extracting streams for TMDB ID: ${tmdbId}${season ? ` S${season}E${episode}` : ''}`);

  // Try multiple providers
  const providers = [
    { name: 'vidsrc.cc', extractor: extractFromVidsrcCC },
    { name: 'vidsrc.xyz', extractor: extractFromVidsrcXYZ },
    { name: '2embed', extractor: extractFrom2Embed },
    { name: 'superembed', extractor: extractFromSuperembed }
  ];

  for (const provider of providers) {
    try {
      console.log(`\n📡 Trying ${provider.name}...`);
      const m3u8Urls = await provider.extractor(tmdbId, season, episode);
      
      if (m3u8Urls && m3u8Urls.length > 0) {
        for (const url of m3u8Urls) {
          const info = await analyzeM3U8(url, provider.name);
          results.sources.push(info);
        }
      }
    } catch (error) {
      console.log(`❌ ${provider.name} failed:`, error.message);
    }
  }

  return results;
}

/**
 * Extract from vidsrc.cc (your existing logic)
 */
async function extractFromVidsrcCC(tmdbId, season, episode) {
  const mediaType = season ? 'tv' : 'movie';
  const url = season 
    ? `https://vidsrc.cc/v2/embed/${mediaType}/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.cc/v2/embed/${mediaType}/${tmdbId}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://vidsrc.cc/'
    }
  });

  // Extract data-hash
  const hashMatch = response.data.match(/data-hash="([^"]+)"/);
  if (!hashMatch) throw new Error('No data-hash found');

  const hash = hashMatch[1];
  
  // Decode hash (your Caesar +3 method)
  const decoded = caesarDecode(hash, 3);
  
  // Get source URL
  const sourceUrl = `https://vidsrc.cc${decoded}`;
  const sourceResponse = await axios.get(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': url
    }
  });

  // Extract m3u8 from source
  const m3u8Match = sourceResponse.data.match(/file:"([^"]+\.m3u8[^"]*)"/);
  if (!m3u8Match) throw new Error('No m3u8 found');

  return [m3u8Match[1]];
}

/**
 * Extract from vidsrc.xyz
 */
async function extractFromVidsrcXYZ(tmdbId, season, episode) {
  const mediaType = season ? 'tv' : 'movie';
  const url = season
    ? `https://vidsrc.xyz/embed/${mediaType}/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.xyz/embed/${mediaType}/${tmdbId}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://vidsrc.xyz/'
    }
  });

  // Look for m3u8 URLs in the page
  const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g;
  const matches = response.data.match(m3u8Regex);
  
  return matches || [];
}

/**
 * Extract from 2embed
 */
async function extractFrom2Embed(tmdbId, season, episode) {
  const mediaType = season ? 'tv' : 'movie';
  const url = season
    ? `https://www.2embed.cc/embed/${tmdbId}/${season}/${episode}`
    : `https://www.2embed.cc/embed/${tmdbId}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.2embed.cc/'
    }
  });

  const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g;
  const matches = response.data.match(m3u8Regex);
  
  return matches || [];
}

/**
 * Extract from superembed
 */
async function extractFromSuperembed(tmdbId, season, episode) {
  const mediaType = season ? 'tv' : 'movie';
  const url = season
    ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`
    : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://multiembed.mov/'
    }
  });

  const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g;
  const matches = response.data.match(m3u8Regex);
  
  return matches || [];
}

// ============================================
// M3U8 ANALYSIS & ENCRYPTION DETECTION
// ============================================

/**
 * Analyze m3u8 playlist and detect encryption
 */
async function analyzeM3U8(m3u8Url, provider) {
  console.log(`\n🔍 Analyzing: ${m3u8Url}`);

  try {
    const response = await axios.get(m3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const content = response.data;
    const info = {
      provider,
      url: m3u8Url,
      type: 'unknown',
      encrypted: false,
      encryptionInfo: null,
      qualities: [],
      valid: true
    };

    // Check if it's a master playlist (contains #EXT-X-STREAM-INF)
    if (content.includes('#EXT-X-STREAM-INF')) {
      info.type = 'master';
      info.qualities = extractQualities(content);
      console.log(`✅ Master playlist with ${info.qualities.length} qualities`);
    } else if (content.includes('#EXTINF')) {
      info.type = 'media';
      console.log(`✅ Media playlist`);
    }

    // Check for encryption
    const keyMatch = content.match(/#EXT-X-KEY:([^\n]+)/);
    if (keyMatch) {
      info.encrypted = true;
      info.encryptionInfo = parseEncryptionInfo(keyMatch[1]);
      console.log(`🔒 ENCRYPTED with ${info.encryptionInfo.method}`);
      console.log(`   Key URI: ${info.encryptionInfo.uri}`);
      if (info.encryptionInfo.iv) {
        console.log(`   IV: ${info.encryptionInfo.iv}`);
      }
    } else {
      console.log(`🔓 Not encrypted`);
    }

    return info;

  } catch (error) {
    console.log(`❌ Failed to analyze: ${error.message}`);
    return {
      provider,
      url: m3u8Url,
      valid: false,
      error: error.message
    };
  }
}

/**
 * Extract quality levels from master playlist
 */
function extractQualities(content) {
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
          url: url.startsWith('http') ? url : new URL(url, content).href
        });
      }
    }
  }

  return qualities;
}

/**
 * Parse EXT-X-KEY encryption information
 */
function parseEncryptionInfo(keyLine) {
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
  if (uriMatch) info.uri = uriMatch[1];

  // Extract IV
  const ivMatch = keyLine.match(/IV=0x([0-9A-Fa-f]+)/);
  if (ivMatch) info.iv = ivMatch[1];

  // Extract KEYFORMAT
  const keyFormatMatch = keyLine.match(/KEYFORMAT="([^"]+)"/);
  if (keyFormatMatch) info.keyFormat = keyFormatMatch[1];

  return info;
}

// ============================================
// DECRYPTION UTILITIES
// ============================================

/**
 * Fetch decryption key from URI
 */
async function fetchDecryptionKey(keyUri, referer) {
  console.log(`🔑 Fetching decryption key from: ${keyUri}`);

  try {
    const response = await axios.get(keyUri, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer
      },
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const key = Buffer.from(response.data);
    console.log(`✅ Key fetched: ${key.length} bytes`);
    console.log(`   Key (hex): ${key.toString('hex')}`);
    
    return key;
  } catch (error) {
    console.log(`❌ Failed to fetch key: ${error.message}`);
    throw error;
  }
}

/**
 * Decrypt AES-128-CBC encrypted segment
 */
function decryptSegment(encryptedData, key, iv) {
  // Convert IV from hex string to Buffer if needed
  if (typeof iv === 'string') {
    iv = Buffer.from(iv, 'hex');
  }

  // Ensure IV is 16 bytes
  if (iv.length !== 16) {
    throw new Error(`Invalid IV length: ${iv.length} (expected 16)`);
  }

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true); // Automatically removes PKCS7 padding

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);

  return decrypted;
}

/**
 * Download and decrypt a segment
 */
async function downloadAndDecryptSegment(segmentUrl, key, iv, referer) {
  console.log(`📥 Downloading segment: ${segmentUrl}`);

  try {
    const response = await axios.get(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const encryptedData = Buffer.from(response.data);
    console.log(`✅ Downloaded: ${encryptedData.length} bytes`);

    // Decrypt
    const decryptedData = decryptSegment(encryptedData, key, iv);
    console.log(`🔓 Decrypted: ${decryptedData.length} bytes`);

    return decryptedData;

  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Caesar cipher decode (for vidsrc.cc)
 */
function caesarDecode(str, shift) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    
    if (code >= 65 && code <= 90) {
      // Uppercase A-Z
      return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      // Lowercase a-z
      return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
    }
    
    return char;
  }).join('');
}

/**
 * Generate IV from segment sequence number (HLS default)
 */
function generateIVFromSequence(sequenceNumber) {
  const iv = Buffer.alloc(16);
  iv.writeUInt32BE(sequenceNumber, 12); // Write sequence number in last 4 bytes
  return iv;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  node extract-and-decrypt-m3u8.js <tmdbId> [season] [episode]

Examples:
  # Movie
  node extract-and-decrypt-m3u8.js 550

  # TV Show
  node extract-and-decrypt-m3u8.js 1396 1 1

  # Test with Fight Club
  node extract-and-decrypt-m3u8.js 550
    `);
    process.exit(1);
  }

  const tmdbId = args[0];
  const season = args[1] ? parseInt(args[1]) : null;
  const episode = args[2] ? parseInt(args[2]) : null;

  console.log('='.repeat(60));
  console.log('🎥 M3U8 EXTRACTOR & DECRYPTION ANALYZER');
  console.log('='.repeat(60));

  try {
    // Extract m3u8 URLs from providers
    const results = await extractM3U8FromProvider(tmdbId, season, episode);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(60));

    if (results.sources.length === 0) {
      console.log('❌ No streams found');
      return;
    }

    console.log(`\n✅ Found ${results.sources.length} source(s):\n`);

    results.sources.forEach((source, index) => {
      console.log(`\n[${index + 1}] ${source.provider}`);
      console.log(`    URL: ${source.url}`);
      console.log(`    Type: ${source.type}`);
      console.log(`    Encrypted: ${source.encrypted ? '🔒 YES' : '🔓 NO'}`);
      
      if (source.encrypted && source.encryptionInfo) {
        console.log(`    Method: ${source.encryptionInfo.method}`);
        console.log(`    Key URI: ${source.encryptionInfo.uri}`);
        if (source.encryptionInfo.iv) {
          console.log(`    IV: ${source.encryptionInfo.iv}`);
        }
      }

      if (source.qualities && source.qualities.length > 0) {
        console.log(`    Qualities: ${source.qualities.length}`);
        source.qualities.forEach(q => {
          console.log(`      - ${q.resolution || 'unknown'} (${Math.round(q.bandwidth / 1000)}kbps)`);
        });
      }
    });

    // Test decryption on first encrypted source
    const encryptedSource = results.sources.find(s => s.encrypted);
    if (encryptedSource && encryptedSource.encryptionInfo) {
      console.log('\n' + '='.repeat(60));
      console.log('🔓 TESTING DECRYPTION');
      console.log('='.repeat(60));

      try {
        const key = await fetchDecryptionKey(
          encryptedSource.encryptionInfo.uri,
          encryptedSource.url
        );

        console.log('\n✅ Decryption key successfully fetched!');
        console.log('   You can now decrypt segments using this key.');
        console.log('\n   To decrypt a segment:');
        console.log('   1. Download the .ts segment file');
        console.log('   2. Use the key and IV to decrypt with AES-128-CBC');
        console.log('   3. The decrypted data is the raw video/audio');

      } catch (error) {
        console.log('\n❌ Could not fetch decryption key');
        console.log('   This might require additional authentication or headers');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ EXTRACTION COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for use as module
module.exports = {
  extractM3U8FromProvider,
  analyzeM3U8,
  fetchDecryptionKey,
  decryptSegment,
  downloadAndDecryptSegment,
  caesarDecode,
  generateIVFromSequence
};
