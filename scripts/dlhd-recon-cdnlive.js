const https = require('https');
const url = 'https://cdn-live.tv/api/v1/channels/player/?name=abc&code=us&user=daddylive&plan=free';
https.get(url, { 
  headers: { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
    'Referer': 'https://dlhd.link/' 
  }, 
  rejectUnauthorized: false 
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Size:', data.length);
    
    /* Look for stream URLs */
    const m3u8 = data.match(/https?:\/\/[^\s"']+(?:\.m3u8|mono\.css|\.mpd)[^\s"']*/g);
    if (m3u8) console.log('M3U8:', [...new Set(m3u8)].slice(0, 10));
    
    /* Look for OPlayer source config */
    const sourceMatch = data.match(/source\s*:\s*\{[^}]*url[^}]*\}/g);
    if (sourceMatch) console.log('OPlayer sources:', sourceMatch);
    
    /* Look for any URL with stream/live */
    const streamUrls = data.match(/https?:\/\/[^\s"']+(?:stream|live|hls|channel)[^\s"']*/gi);
    if (streamUrls) console.log('Stream URLs:', [...new Set(streamUrls)].slice(0, 10));
    
    /* Look for inline scripts with source */
    const scripts = data.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (let i = 0; i < scripts.length; i++) {
      const content = scripts[i].replace(/<\/?script[^>]*>/gi, '').trim();
      if (content.length > 200 && (content.includes('source') || content.includes('m3u8') || content.includes('OPlayer'))) {
        console.log('\nScript #' + i + ' (' + content.length + ' chars):');
        console.log(content.substring(0, 1500));
        if (content.length > 1500) console.log('... (truncated)');
      }
    }
    
    if (data.includes('dvalna')) console.log('Has dvalna');
    if (data.includes('EPlayerAuth')) console.log('Has EPlayerAuth');
    if (data.includes('channelSalt')) console.log('Has channelSalt');
    if (data.includes('lovecdn')) console.log('Has lovecdn');
    if (data.includes('moveonjoy')) console.log('Has moveonjoy');
  });
}).on('error', e => console.log('Error:', e.message));
