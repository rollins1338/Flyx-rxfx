const https = require('https');

// First get auth token
const playerUrl = 'https://epicplayplay.cfd/premiumtv/daddyhd.php?id=51';
console.log('Fetching player page...');

https.get(playerUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://daddyhd.com/' } }, (res) => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    const tokenMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
    const countryMatch = html.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
    const tsMatch = html.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);
    
    if (!tokenMatch) { console.log('No token found'); return; }
    
    const token = tokenMatch[1];
    const country = countryMatch ? countryMatch[1] : 'US';
    const ts = tsMatch ? tsMatch[1] : String(Math.floor(Date.now()/1000));
    
    console.log('Token:', token.substring(0,30) + '...');
    console.log('Country:', country);
    console.log('TS:', ts);
    
    // Generate client token
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const channelKey = 'premium51';
    const fp = ua + '|1920x1080|America/New_York|en-US';
    const signData = channelKey + '|' + country + '|' + ts + '|' + ua + '|' + fp;
    const clientToken = Buffer.from(signData).toString('base64');
    
    console.log('ClientToken:', clientToken.substring(0,50) + '...');
    
    // Call heartbeat
    const hbUrl = 'https://chevy.kiko2.ru/heartbeat';
    console.log('\nCalling heartbeat:', hbUrl);
    
    const req = https.get(hbUrl, {
      headers: {
        'User-Agent': ua,
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
        'Authorization': 'Bearer ' + token,
        'X-Channel-Key': channelKey,
        'X-Client-Token': clientToken,
        'X-User-Agent': ua,
      },
      timeout: 10000
    }, (hbRes) => {
      let data = '';
      hbRes.on('data', c => data += c);
      hbRes.on('end', () => {
        console.log('Heartbeat Status:', hbRes.statusCode);
        console.log('Heartbeat Response:', data);
      });
    });
    req.on('error', e => console.log('HB Error:', e.message));
  });
}).on('error', e => console.log('Player Error:', e.message));
