/**
 * Test CDN-Live.tv player page fetch
 */

const https = require('https');

const url = 'https://cdn-live.tv/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
    
    // Find the script
    const scriptMatch = data.match(/<script>var _0x[a-f0-9]+[\s\S]*?<\/script>/);
    if (scriptMatch) {
      console.log('Script found, length:', scriptMatch[0].length);
      
      // Extract the eval parameters
      const evalMatch = data.match(/eval\(function\(h,u,n,t,e,r\)\{[^}]+\}\("([^"]+)",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)/);
      if (evalMatch) {
        console.log('Encoded data length:', evalMatch[1].length);
        console.log('u:', evalMatch[2]);
        console.log('charset:', evalMatch[3]);
        console.log('base:', evalMatch[4]);
        console.log('e:', evalMatch[5]);
        console.log('offset:', evalMatch[6]);
        console.log('First 200 chars of encoded:', evalMatch[1].substring(0, 200));
        
        // Try to decode
        const encoded = evalMatch[1];
        const charset = evalMatch[3];
        const e = parseInt(evalMatch[5]);
        const offset = parseInt(evalMatch[6]);
        
        // Decode function
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
        console.log('\n=== DECODED (first 2000 chars) ===\n');
        console.log(decoded.substring(0, 2000));
        
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
      }
    }
    
    // Check for direct m3u8 URLs in raw HTML
    const m3u8 = data.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
    if (m3u8) console.log('\nDirect m3u8 URLs in HTML:', m3u8);
    
    // Check for edge URLs
    const edge = data.match(/edge\.cdn-live-tv\.ru/g);
    if (edge) console.log('Edge domain found:', edge.length, 'times');
  });
}).on('error', e => console.error(e));
