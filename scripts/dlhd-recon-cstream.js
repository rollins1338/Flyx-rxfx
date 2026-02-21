const https = require('https');
const url = 'https://cstream.fit/embed/wffwehg9yklo7k3dmabqxi70sbws5w4q';
https.get(url, { 
  headers: { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
    'Referer': 'https://daddyliveplayer.shop/' 
  }, 
  rejectUnauthorized: false 
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const epa = data.match(/EPlayerAuth\.init\s*\(\s*\{([^}]+)\}\s*\)/);
    if (epa) console.log('EPlayerAuth:', epa[1].replace(/\s+/g, ' ').trim());
    
    const m3u8 = data.match(/https?:\/\/[^\s"']+(?:\.m3u8|mono\.css)[^\s"']*/g);
    if (m3u8) console.log('M3U8:', [...new Set(m3u8)]);
    
    const dvalna = data.match(/[a-z0-9]+new\.dvalna\.ru[^\s"'<>]*/g);
    if (dvalna) console.log('dvalna:', [...new Set(dvalna)]);
    
    if (data.includes('server_lookup')) console.log('Has server_lookup');
    
    const iframes = data.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
    if (iframes) console.log('Iframes:', iframes.map(m => m.match(/src=["']([^"']+)["']/)?.[1]).filter(Boolean));
    
    if (data.includes('channelSalt')) console.log('Has channelSalt');
    if (data.includes('authToken')) console.log('Has authToken');
    if (data.includes('Clappr')) console.log('Uses Clappr player');
    if (data.includes('Hls')) console.log('Uses HLS.js');
    if (data.includes('jwplayer')) console.log('Uses JWPlayer');
    if (data.includes('chevy.dvalna')) console.log('Has chevy.dvalna key server');
    
    console.log('Body size:', data.length);
  });
}).on('error', e => console.log('Error:', e.message));
