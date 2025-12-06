/**
 * RapidShare/RapidAirmax Stream Extractor
 * 
 * This module extracts HLS stream URLs from rapidshare.cc and rapidairmax.site embeds.
 * 
 * The encryption uses a constant header XOR'd with the URL to generate a key.
 * We can decrypt if we know the URL prefix (domain + path pattern).
 * 
 * Usage:
 *   const extractor = require('./rapidshare-extractor');
 *   const result = await extractor.extract('https://rapidairmax.site/e/abc123');
 */

const https = require('https');
const http = require('http');

// Constant header discovered through known-plaintext attack
const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// Known domain mappings
// Key: embed domain, Value: { hlsDomain, pathPrefix }
const DOMAIN_MAPPINGS = {
  'rapidshare.cc': {
    hlsDomain: 'rapidshare.cc',
    pathPrefix: '/stream/',
    urlPrefix: 'https://rapidshare.cc/stream/'
  },
  'rapidairmax.site': {
    hlsDomain: 'rrr.core36link.site',
    pathPrefix: '/p267/c5/h',
    urlPrefix: 'https://rrr.core36link.site/p267/c5/h'
  },
  // Add more mappings as discovered
};

/**
 * URL-safe base64 decode
 */
function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

/**
 * Decrypt PAGE_DATA using known URL prefix
 * 
 * Algorithm:
 * 1. key[0:19] = HEADER XOR URL[0:19]
 * 2. For i >= 19: key[i] = key[i-19] XOR (cipher[i-19] XOR cipher[i]) XOR (URL[i-19] XOR URL[i])
 * 3. plaintext[i] = cipher[i] XOR key[i]
 */
function decryptWithPrefix(pageData, urlPrefix) {
  const ciphertext = urlSafeBase64Decode(pageData);
  const key = Buffer.alloc(ciphertext.length);
  const plaintext = Buffer.alloc(ciphertext.length);
  
  // Step 1: Compute key[0:19] = HEADER XOR URL[0:19]
  for (let i = 0; i < 19 && i < urlPrefix.length; i++) {
    key[i] = HEADER[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // Step 2: Decrypt positions 0-18
  for (let i = 0; i < 19; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  // Step 3: For positions 19+, compute key iteratively
  for (let i = 19; i < ciphertext.length; i++) {
    if (i < urlPrefix.length) {
      // We know the URL character
      const C = ciphertext[i - 19] ^ ciphertext[i];
      const U = urlPrefix.charCodeAt(i - 19) ^ urlPrefix.charCodeAt(i);
      key[i] = key[i - 19] ^ (C ^ U);
      plaintext[i] = ciphertext[i] ^ key[i];
    } else {
      // Unknown - we can still compute the key but need to guess the plaintext
      // For now, mark as unknown
      plaintext[i] = 0;
    }
  }
  
  return {
    plaintext: plaintext.toString('utf8'),
    knownLength: Math.min(urlPrefix.length, ciphertext.length),
    totalLength: ciphertext.length
  };
}

/**
 * Try to decrypt PAGE_DATA by trying all known domain mappings
 */
function tryDecrypt(pageData, embedDomain) {
  // First try the specific domain mapping
  if (DOMAIN_MAPPINGS[embedDomain]) {
    const mapping = DOMAIN_MAPPINGS[embedDomain];
    const result = decryptWithPrefix(pageData, mapping.urlPrefix);
    
    if (result.plaintext.startsWith('https://')) {
      return {
        success: true,
        partialUrl: result.plaintext.substring(0, result.knownLength),
        urlPrefix: mapping.urlPrefix,
        knownLength: result.knownLength,
        totalLength: result.totalLength,
        remainingBytes: result.totalLength - result.knownLength
      };
    }
  }
  
  // Try all mappings
  for (const [domain, mapping] of Object.entries(DOMAIN_MAPPINGS)) {
    const result = decryptWithPrefix(pageData, mapping.urlPrefix);
    
    if (result.plaintext.startsWith('https://')) {
      return {
        success: true,
        partialUrl: result.plaintext.substring(0, result.knownLength),
        urlPrefix: mapping.urlPrefix,
        knownLength: result.knownLength,
        totalLength: result.totalLength,
        remainingBytes: result.totalLength - result.knownLength,
        detectedDomain: domain
      };
    }
  }
  
  return { success: false, error: 'No matching domain mapping found' };
}

/**
 * Fetch HTML from URL
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': url
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Extract PAGE_DATA and app.js hash from embed HTML
 */
function parseEmbedHtml(html) {
  // Extract PAGE_DATA
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*["']([^"']+)["']/);
  if (!pageDataMatch) {
    return { error: 'PAGE_DATA not found' };
  }
  
  // Extract app.js hash from URL
  const appJsMatch = html.match(/\/assets\/b\/([a-f0-9]+)\/min\/app\.js/);
  const appJsHash = appJsMatch ? appJsMatch[1] : null;
  
  // Extract base domain
  const baseMatch = html.match(/<base\s+href=["']https?:\/\/([^"'\/]+)/);
  const embedDomain = baseMatch ? baseMatch[1] : null;
  
  return {
    pageData: pageDataMatch[1],
    appJsHash,
    embedDomain
  };
}

/**
 * Main extraction function
 * 
 * @param {string} embedUrl - The embed URL (e.g., https://rapidairmax.site/e/abc123)
 * @returns {Promise<object>} - Extraction result
 */
async function extract(embedUrl) {
  try {
    // Parse embed domain from URL
    const urlObj = new URL(embedUrl);
    const embedDomain = urlObj.hostname;
    
    // Fetch embed page
    const html = await fetchHtml(embedUrl);
    
    // Parse HTML
    const parsed = parseEmbedHtml(html);
    if (parsed.error) {
      return { success: false, error: parsed.error };
    }
    
    // Try to decrypt
    const decrypted = tryDecrypt(parsed.pageData, parsed.embedDomain || embedDomain);
    
    return {
      success: decrypted.success,
      embedDomain: parsed.embedDomain || embedDomain,
      appJsHash: parsed.appJsHash,
      pageData: parsed.pageData,
      ...decrypted
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Extract from HTML string (for when you already have the HTML)
 */
function extractFromHtml(html, embedDomain) {
  const parsed = parseEmbedHtml(html);
  if (parsed.error) {
    return { success: false, error: parsed.error };
  }
  
  const decrypted = tryDecrypt(parsed.pageData, parsed.embedDomain || embedDomain);
  
  return {
    success: decrypted.success,
    embedDomain: parsed.embedDomain || embedDomain,
    appJsHash: parsed.appJsHash,
    pageData: parsed.pageData,
    ...decrypted
  };
}

// Export functions
module.exports = {
  extract,
  extractFromHtml,
  tryDecrypt,
  decryptWithPrefix,
  parseEmbedHtml,
  DOMAIN_MAPPINGS,
  HEADER
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('RapidShare/RapidAirmax Stream Extractor');
    console.log('');
    console.log('Usage:');
    console.log('  node rapidshare-extractor.js <embed_url>');
    console.log('  node rapidshare-extractor.js --pagedata <PAGE_DATA> <embed_domain>');
    console.log('');
    console.log('Examples:');
    console.log('  node rapidshare-extractor.js https://rapidairmax.site/e/abc123');
    console.log('  node rapidshare-extractor.js --pagedata "3wMOLPOC..." rapidairmax.site');
    console.log('');
    
    // Demo with known samples
    console.log('=== Demo with known samples ===\n');
    
    // Sample 1
    const pd1 = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
    console.log('Sample 1 (rapidshare.cc):');
    console.log('PAGE_DATA:', pd1);
    const result1 = tryDecrypt(pd1, 'rapidshare.cc');
    console.log('Result:', JSON.stringify(result1, null, 2));
    console.log('');
    
    // Sample 2
    const pd2 = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
    console.log('Sample 2 (rapidairmax.site - FNAF2):');
    console.log('PAGE_DATA:', pd2);
    const result2 = tryDecrypt(pd2, 'rapidairmax.site');
    console.log('Result:', JSON.stringify(result2, null, 2));
    
  } else if (args[0] === '--pagedata' && args.length >= 3) {
    const pageData = args[1];
    const domain = args[2];
    const result = tryDecrypt(pageData, domain);
    console.log(JSON.stringify(result, null, 2));
    
  } else if (args[0].startsWith('http')) {
    extract(args[0]).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else {
    console.error('Invalid arguments. Run without arguments for help.');
  }
}
