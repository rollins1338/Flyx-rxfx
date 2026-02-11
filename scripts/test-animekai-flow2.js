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

async function test() {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  const headers = { 'User-Agent': UA };
  
  // Use known values from previous test
  const kaiId = 'c4S88Q';
  const encId = encrypt(kaiId);
  
  // Get episodes
  console.log('Getting episodes for', kaiId);
  let r = await fetch('https://animekai.to/ajax/episodes/list?ani_id=' + kaiId + '&_=' + encId, { headers });
  let data = await r.json();
  const tokenMatch = data.result.match(/token="([^"]+)"/);
  const token = tokenMatch[1];
  console.log('Token:', token);
  console.log('Token length:', token.length);
  
  // Get servers
  const encToken = encrypt(token);
  console.log('\nEncrypted token:', encToken);
  r = await fetch('https://animekai.to/ajax/links/list?token=' + token + '&_=' + encToken, { headers });
  data = await r.json();
  const lidMatch = data.result.match(/data-lid="([^"]+)"/);
  const lid = lidMatch[1];
  console.log('LID:', lid);
  console.log('LID length:', lid.length);
  
  // Check if lid has characters not in our tables
  for (let i = 0; i < lid.length; i++) {
    const ch = lid[i];
    const t = encTables[i];
    if (!t || !(ch in t)) {
      console.log(`WARNING: Character '${ch}' at position ${i} NOT in encrypt table!`);
    }
  }
  
  // Get embed - test with raw response
  const encLid = encrypt(lid);
  console.log('\nEncrypted lid:', encLid);
  const embedUrl = 'https://animekai.to/ajax/links/view?id=' + lid + '&_=' + encLid;
  console.log('Embed URL:', embedUrl);
  
  r = await fetch(embedUrl, { headers });
  console.log('Embed response status:', r.status);
  console.log('Embed content-type:', r.headers.get('content-type'));
  const text = await r.text();
  console.log('Embed response length:', text.length);
  console.log('Embed response first 300 chars:', text.substring(0, 300));
  
  // Also try with anikai.to domain
  console.log('\n\n=== Trying anikai.to domain ===');
  r = await fetch('https://anikai.to/ajax/links/view?id=' + lid + '&_=' + encLid, { headers });
  console.log('anikai.to status:', r.status);
  console.log('anikai.to content-type:', r.headers.get('content-type'));
  const text2 = await r.text();
  console.log('anikai.to response length:', text2.length);
  console.log('anikai.to response first 300 chars:', text2.substring(0, 300));
}
test().catch(e => console.error('Error:', e.message, e.stack));
