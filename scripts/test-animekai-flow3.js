const fs = require('fs');
const tables = JSON.parse(fs.readFileSync('./rpi-proxy/animekai-tables.json', 'utf8'));
const encTables = {};
for (const [pos, table] of Object.entries(tables)) {
  encTables[pos] = {};
  for (const [byte, char] of Object.entries(table)) {
    encTables[pos][char] = parseInt(byte);
  }
}
function urlSafeBase64Encode(buffer) { return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
function urlSafeBase64Decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}
function getCipherPosition(p) { if(p===0)return 0;if(p===1)return 7;if(p===2)return 11;if(p===3)return 13;if(p===4)return 15;if(p===5)return 17;if(p===6)return 19;return 20+(p-7); }
const HEADER = Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa','hex');
const CB = {1:0xf2,2:0xdf,3:0x9b,4:0x9d,5:0x16,6:0xe5,8:0x67,9:0xc9,10:0xdd,12:0x9c,14:0x29,16:0x35,18:0xc8};
function encrypt(pt) {
  const ptLen = pt.length;
  let cdl; if(ptLen<=1)cdl=1;else if(ptLen<=2)cdl=8;else if(ptLen<=3)cdl=12;else if(ptLen<=4)cdl=14;else if(ptLen<=5)cdl=16;else if(ptLen<=6)cdl=18;else if(ptLen<=7)cdl=20;else cdl=20+(ptLen-7);
  const cipher = Buffer.alloc(21+cdl); HEADER.copy(cipher,0);
  for(const[pos,byte] of Object.entries(CB)){const idx=21+parseInt(pos);if(idx<cipher.length)cipher[idx]=byte;}
  for(let i=0;i<ptLen;i++){const ch=pt[i];const cp=getCipherPosition(i);const t=encTables[i];if(t&&ch in t)cipher[21+cp]=t[ch];else cipher[21+cp]=ch.charCodeAt(0);}
  return urlSafeBase64Encode(cipher);
}
function decrypt(ciphertext) {
  const HEADER_LEN = 21;
  const cipher = urlSafeBase64Decode(ciphertext);
  const dataOffset = cipher.length > HEADER_LEN ? HEADER_LEN : 0;
  const dataLen = cipher.length - dataOffset;
  let plaintextLen = 0;
  if (dataLen > 20) plaintextLen = 7 + (dataLen - 20);
  else if (dataLen > 19) plaintextLen = 7;
  else if (dataLen > 17) plaintextLen = 6;
  else if (dataLen > 15) plaintextLen = 5;
  else if (dataLen > 13) plaintextLen = 4;
  else if (dataLen > 11) plaintextLen = 3;
  else if (dataLen > 7) plaintextLen = 2;
  else if (dataLen > 0) plaintextLen = 1;
  let plaintext = '';
  for (let i = 0; i < plaintextLen; i++) {
    const cipherPos = getCipherPosition(i);
    const actualPos = dataOffset + cipherPos;
    if (actualPos >= cipher.length) break;
    const byte = cipher[actualPos];
    const table = tables[i];
    if (table && byte in table) plaintext += table[byte];
    else plaintext += String.fromCharCode(byte);
  }
  return plaintext;
}

async function test() {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  const headers = { 'User-Agent': UA };
  
  const kaiId = 'c4S88Q';
  const encId = encrypt(kaiId);
  
  // Get episodes
  let r = await fetch('https://animekai.to/ajax/episodes/list?ani_id=' + kaiId + '&_=' + encId, { headers });
  let data = await r.json();
  const tokenMatch = data.result.match(/token="([^"]+)"/);
  const token = tokenMatch[1];
  
  // Get servers
  const encToken = encrypt(token);
  r = await fetch('https://animekai.to/ajax/links/list?token=' + token + '&_=' + encToken, { headers });
  data = await r.json();
  
  // Get ALL lids
  const lidRegex = /data-lid="([^"]+)"/g;
  const lids = [];
  let m;
  while ((m = lidRegex.exec(data.result)) !== null) {
    lids.push(m[1]);
  }
  console.log('Found', lids.length, 'server lids');
  
  // Try each lid
  for (const lid of lids) {
    console.log('\n--- Testing lid:', lid, '---');
    const encLid = encrypt(lid);
    r = await fetch('https://animekai.to/ajax/links/view?id=' + lid + '&_=' + encLid, { headers });
    const contentType = r.headers.get('content-type');
    
    if (!contentType || !contentType.includes('json')) {
      console.log('ERROR: Got non-JSON response:', contentType);
      const text = await r.text();
      console.log('Response preview:', text.substring(0, 100));
      continue;
    }
    
    data = await r.json();
    if (data.status !== 200 || !data.result) {
      console.log('ERROR: Bad response:', data);
      continue;
    }
    
    // Decrypt
    const decrypted = decrypt(data.result);
    const decoded = decrypted.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    console.log('Decrypted:', decoded.substring(0, 200));
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(decoded);
      console.log('Parsed URL:', parsed.url || parsed.file || (parsed.sources && parsed.sources[0]?.file));
    } catch {
      // Check if it's a URL directly
      if (decoded.startsWith('http')) {
        console.log('Direct URL:', decoded);
      } else {
        console.log('Not JSON, not URL. Raw:', decoded.substring(0, 100));
      }
    }
  }
}
test().catch(e => console.error('Error:', e.message, e.stack));
