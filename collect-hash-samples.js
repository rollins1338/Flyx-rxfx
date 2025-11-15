// Collect multiple hash samples to find the pattern
const axios = require('axios');

const TEST_MOVIES = [
  { id: '558449', name: 'Sonic 3' },
  { id: '550', name: 'Fight Club' },
  { id: '603', name: 'The Matrix' },
  { id: '13', name: 'Forrest Gump' },
  { id: '155', name: 'The Dark Knight' },
];

async function collectSamples() {
  console.log('='.repeat(70));
  console.log('📦 COLLECTING HASH SAMPLES');
  console.log('='.repeat(70));
  
  const samples = [];
  
  for (const movie of TEST_MOVIES) {
    console.log(`\n[${movie.name}] TMDB ID: ${movie.id}`);
    
    try {
      // Get hash from your existing extractor
      const hashUrl = `https://vidsrc.cc/v2/embed/movie/${movie.id}`;
      const hashResponse = await axios.get(hashUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://vidsrc.cc/'
        },
        timeout: 10000
      });
      
      // Extract data-hash
      const hashMatch = hashResponse.data.match(/data-hash="([^"]+)"/);
      if (!hashMatch) {
        console.log('  ❌ No hash found');
        continue;
      }
      
      const hash = hashMatch[1];
      console.log(`  ✅ Hash: ${hash.substring(0, 30)}...`);
      
      // Decode hash (Caesar +3)
      const decoded = hash.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 + 3) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 + 3) % 26) + 97);
        }
        return c;
      }).join('');
      
      console.log(`  ✅ Decoded: ${decoded}`);
      
      // Get ProRCP page
      const prorcpUrl = `https://vidsrc.cc${decoded}`;
      const prorcpResponse = await axios.get(prorcpUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': hashUrl
        },
        timeout: 10000
      });
      
      // Extract hidden div
      const divMatch = prorcpResponse.data.match(/<div[^>]+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);
      
      if (!divMatch) {
        console.log('  ❌ No hidden div found');
        continue;
      }
      
      const divId = divMatch[1];
      const encoded = divMatch[2];
      
      console.log(`  ✅ Div ID: ${divId}`);
      console.log(`  ✅ Encoded length: ${encoded.length}`);
      console.log(`  ✅ First 50: ${encoded.substring(0, 50)}`);
      
      samples.push({
        movie: movie.name,
        tmdbId: movie.id,
        divId,
        encoded,
        encodedLength: encoded.length
      });
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Analyze samples
  console.log('\n' + '='.repeat(70));
  console.log('📊 SAMPLE ANALYSIS');
  console.log('='.repeat(70));
  
  if (samples.length === 0) {
    console.log('\n❌ No samples collected');
    return;
  }
  
  console.log(`\n✅ Collected ${samples.length} samples\n`);
  
  samples.forEach((sample, i) => {
    console.log(`[${i + 1}] ${sample.movie}`);
    console.log(`    Div ID: ${sample.divId}`);
    console.log(`    Length: ${sample.encodedLength}`);
    console.log(`    First 50: ${sample.encoded.substring(0, 50)}`);
    console.log(`    Format: ${detectFormat(sample.encoded)}`);
    console.log('');
  });
  
  // Try to find common patterns
  console.log('='.repeat(70));
  console.log('🔍 PATTERN ANALYSIS');
  console.log('='.repeat(70));
  
  // Check if all use same format
  const formats = samples.map(s => detectFormat(s.encoded));
  const uniqueFormats = [...new Set(formats)];
  
  console.log(`\nFormats used: ${uniqueFormats.join(', ')}`);
  
  if (uniqueFormats.length === 1) {
    console.log(`✅ All samples use the same format: ${uniqueFormats[0]}`);
    
    // Try decoding all with the same method
    console.log(`\nTrying to decode all samples...`);
    
    for (const sample of samples) {
      console.log(`\n[${sample.movie}]`);
      tryDecode(sample.encoded, sample.divId);
    }
  } else {
    console.log(`⚠️  Samples use different formats`);
  }
}

function detectFormat(encoded) {
  const isHex = /^[0-9a-fA-F:]+$/.test(encoded);
  const isBase64Like = /^[A-Za-z0-9+\/=]+$/.test(encoded);
  const startsWithEquals = encoded.startsWith('=');
  
  if (isHex) return 'hex';
  if (isBase64Like && startsWithEquals) return 'base64-reversed';
  if (isBase64Like) return 'base64';
  return 'unknown';
}

function tryDecode(encoded, divId) {
  // Method 1: Reverse + Base64
  try {
    const reversed = encoded.split('').reverse().join('');
    const decoded = Buffer.from(reversed, 'base64').toString('utf8');
    if (decoded.includes('http')) {
      console.log(`  ✅ Reverse + Base64: ${decoded}`);
      return;
    }
  } catch (e) {}
  
  // Method 2: Base64 + XOR
  try {
    const decoded = Buffer.from(encoded, 'base64');
    const xored = Buffer.alloc(decoded.length);
    
    for (let i = 0; i < decoded.length; i++) {
      xored[i] = decoded[i] ^ divId.charCodeAt(i % divId.length);
    }
    
    const result = xored.toString('utf8');
    if (result.includes('http')) {
      console.log(`  ✅ Base64 + XOR: ${result}`);
      return;
    }
  } catch (e) {}
  
  console.log(`  ❌ No valid URL found`);
}

collectSamples();
