/**
 * Test what type of IP the RPI has
 * Run this ON the Raspberry Pi to check if it's residential
 */

const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'curl/7.68.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Checking IP type...\n');
  
  // Get public IP
  try {
    const ip = await fetch('https://api.ipify.org');
    console.log('Public IP:', ip);
    
    // Check IP info
    const info = await fetch(`https://ipinfo.io/${ip}/json`);
    const parsed = JSON.parse(info);
    console.log('\nIP Info:');
    console.log('  City:', parsed.city);
    console.log('  Region:', parsed.region);
    console.log('  Country:', parsed.country);
    console.log('  Org:', parsed.org);
    console.log('  Hostname:', parsed.hostname || 'N/A');
    
    // Check if it looks residential
    const org = (parsed.org || '').toLowerCase();
    const isDatacenter = org.includes('amazon') || org.includes('google') || 
                         org.includes('microsoft') || org.includes('cloudflare') ||
                         org.includes('digitalocean') || org.includes('linode') ||
                         org.includes('vultr') || org.includes('ovh') ||
                         org.includes('hetzner') || org.includes('hosting');
    
    const isResidential = org.includes('comcast') || org.includes('verizon') ||
                          org.includes('at&t') || org.includes('spectrum') ||
                          org.includes('cox') || org.includes('charter') ||
                          org.includes('frontier') || org.includes('centurylink') ||
                          org.includes('bt ') || org.includes('virgin') ||
                          org.includes('sky ') || org.includes('talktalk') ||
                          org.includes('plusnet') || org.includes('ee ') ||
                          org.includes('vodafone') || org.includes('o2 ') ||
                          org.includes('three') || org.includes('giffgaff');
    
    console.log('\n  Type:', isDatacenter ? 'DATACENTER (bad)' : isResidential ? 'RESIDENTIAL (good)' : 'UNKNOWN');
    
    if (isDatacenter) {
      console.log('\n⚠️  Your IP appears to be from a datacenter.');
      console.log('   DLHD key servers block datacenter IPs.');
      console.log('   You need a residential IP for this to work.');
    } else if (isResidential) {
      console.log('\n✓ Your IP appears to be residential.');
      console.log('  If keys still fail, the IP may be flagged or there\'s another issue.');
    } else {
      console.log('\n? Could not determine IP type.');
      console.log('  Check the Org field above to see if it\'s your ISP.');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Also test the key server directly
  console.log('\n\n=== Testing DLHD Key Server ===\n');
  
  const keyUrl = 'https://chevy.kiko2.ru/key/premium51/5885923';
  console.log('Key URL:', keyUrl);
  
  const req = https.get(keyUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    }
  }, (res) => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const data = Buffer.concat(chunks);
      console.log('Status:', res.statusCode);
      console.log('Length:', data.length);
      
      if (data.length === 16) {
        const text = data.toString('utf8');
        if (text.includes('error')) {
          console.log('Response:', text);
          console.log('\n❌ Key server returned error - IP is blocked');
        } else {
          console.log('Key (hex):', data.toString('hex'));
          console.log('\n✓ Got valid key! Your IP works.');
        }
      } else {
        console.log('Response:', data.toString('utf8').substring(0, 100));
      }
    });
  });
  
  req.on('error', (e) => console.error('Error:', e.message));
}

main();
