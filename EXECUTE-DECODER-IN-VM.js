/**
 * EXECUTE DECODER IN NODE VM
 * Run the obfuscated decoder in a controlled environment to extract the M3U8 URL
 */

const vm = require('vm');
const fs = require('fs');
const https = require('https');
const cheerio = require('cheerio');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    https.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': options.referer || '',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data }));
    }).on('error', reject).end();
  });
}

async function executeDecoderInVM() {
  console.log('\n🎯 EXECUTING DECODER IN NODE VM\n');
  
  // Step 1: Get ProRCP page HTML
  console.log('Step 1: Getting ProRCP page...');
  const embedResp = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const $ = cheerio.load(embedResp.data);
  const dataHash = $('[data-hash]').first().attr('data-hash');
  
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  console.log('✅ Got data hash');
  
  // Step 3: Load the decoder script we already downloaded
  const decoderScript = fs.readFileSync('prorcp-decoder-script.js', 'utf8');
  
  console.log('✅ Loaded decoder script:', decoderScript.length, 'chars');
  
  // Step 4: Create a VM context with DOM-like environment
  console.log('\nStep 4: Creating VM context...');
  
  const sandbox = {
    window: {},
    document: {
      getElementById: function(id) {
        console.log('getElementById called for:', id);
        // Return a fake element with the encoded content
        // We need to figure out what the encoded content is
        return {
          innerHTML: 'ENCODED_CONTENT_HERE',
          textContent: 'ENCODED_CONTENT_HERE',
          outerHTML: '<div id="' + id + '">ENCODED_CONTENT_HERE</div>'
        };
      }
    },
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    URL: {
      createObjectURL: function(blob) {
        console.log('createObjectURL called with blob');
        return 'blob://fake-url';
      }
    },
    Blob: function(parts, options) {
      console.log('Blob created with parts:', parts.length);
      this.parts = parts;
      this.type = options?.type;
    }
  };
  
  // Link window to itself
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  
  const context = vm.createContext(sandbox);
  
  // Step 5: Execute the decoder script
  console.log('\nStep 5: Executing decoder script...');
  
  try {
    vm.runInContext(decoderScript, context, {
      timeout: 5000,
      displayErrors: true
    });
    
    console.log('✅ Script executed');
    
    // Check what variables were created
    console.log('\nVariables in window:');
    const windowKeys = Object.keys(sandbox.window).filter(k => k.length === 10);
    console.log(windowKeys);
    
    // Check for M3U8 URLs
    windowKeys.forEach(key => {
      const value = sandbox.window[key];
      if (typeof value === 'string' && (value.includes('.m3u8') || value.includes('http'))) {
        console.log(`\n✅ FOUND M3U8 URL in window.${key}:`);
        console.log(value);
      }
    });
    
  } catch (error) {
    console.error('❌ Error executing script:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n✅ Done!');
}

executeDecoderInVM().catch(console.error);
