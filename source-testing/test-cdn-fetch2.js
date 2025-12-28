/**
 * Test CDN-Live.tv player page fetch v2
 */

const https = require('https');
const fs = require('fs');

const url = 'https://cdn-live.tv/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
    
    // Save the HTML
    fs.writeFileSync('source-testing/cdn-player-espn.html', data);
    console.log('Saved to cdn-player-espn.html');
    
    // Find the script
    const scriptStart = data.indexOf('<script>var _0x');
    const scriptEnd = data.indexOf('</script>', scriptStart);
    
    if (scriptStart !== -1) {
      const script = data.substring(scriptStart + 8, scriptEnd);
      console.log('Script length:', script.length);
      
      // Look for the eval pattern more carefully
      const evalIdx = script.indexOf('eval(function(h,u,n,t,e,r)');
      if (evalIdx !== -1) {
        console.log('Found eval at index:', evalIdx);
        
        // Find the parameters at the end
        // Pattern: (",NUMBER,"CHARSET",NUMBER,NUMBER,NUMBER))
        const endPattern = /\(",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)$/;
        const endMatch = script.match(endPattern);
        
        if (endMatch) {
          console.log('Parameters found:');
          console.log('  u:', endMatch[1]);
          console.log('  charset:', endMatch[2]);
          console.log('  base:', endMatch[3]);
          console.log('  e:', endMatch[4]);
          console.log('  offset:', endMatch[5]);
          
          // Find the encoded data
          const dataStartIdx = script.indexOf('("', evalIdx) + 2;
          const dataEndIdx = script.lastIndexOf('",');
          const encoded = script.substring(dataStartIdx, dataEndIdx);
          
          console.log('Encoded data length:', encoded.length);
          console.log('First 100 chars:', encoded.substring(0, 100));
          
          // Decode
          const charset = endMatch[2];
          const e = parseInt(endMatch[4]);
          const offset = parseInt(endMatch[5]);
          
          function decode(h, n, e, t) {
            let r = '';
            let i = 0;
            while (i < h.length) {
              let s = '';
              while (i < h.length && h[i] !== n[e]) {
                s += h[i];
                i++;
              }
              i++;
              
              for (let j = 0; j < n.length; j++) {
                s = s.split(n[j]).join(j.toString());
              }
              
              const charCode = parseInt(s, e) - t;
              r += String.fromCharCode(charCode);
            }
            return r;
          }
          
          const decoded = decode(encoded, charset, e, offset);
          fs.writeFileSync('source-testing/cdn-decoded-espn.js', decoded);
          console.log('\nDecoded length:', decoded.length);
          console.log('\n=== DECODED (first 1500 chars) ===\n');
          console.log(decoded.substring(0, 1500));
          
          // Look for m3u8 URLs
          const m3u8Match = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
          if (m3u8Match) {
            console.log('\n=== M3U8 URLs ===');
            m3u8Match.forEach(u => console.log(u));
          }
          
          // Look for playlistUrl
          const playlistMatch = decoded.match(/playlistUrl\s*[=:]\s*["']([^"']+)["']/);
          if (playlistMatch) {
            console.log('\n=== playlistUrl ===');
            console.log(playlistMatch[1]);
          }
          
          // Look for src:
          const srcMatch = decoded.match(/src\s*:\s*["']([^"']+)["']/);
          if (srcMatch) {
            console.log('\n=== src ===');
            console.log(srcMatch[1]);
          }
        }
      }
    }
  });
}).on('error', e => console.error(e));
