/**
 * Debug Stalker Portal - Raw output to see exactly what's returned
 */

const PORTAL = 'http://suiptv265.xyz';
const MAC = '00:1A:79:2A:3B:46'; // Known working MAC

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
  'X-User-Agent': 'Model: MAG250; Link: WiFi',
};

async function debug() {
  const encodedMac = encodeURIComponent(MAC);
  const cookie = `mac=${encodedMac}; stb_lang=en; timezone=GMT`;

  console.log('='.repeat(60));
  console.log('STALKER DEBUG');
  console.log('='.repeat(60));
  console.log(`Portal: ${PORTAL}`);
  console.log(`MAC: ${MAC}`);
  console.log(`Cookie: ${cookie}`);
  console.log('='.repeat(60));

  // Try different API paths - including /c variants
  const paths = [
    '/c/server/load.php',
    '/c/portal.php', 
    '/portal.php', 
    '/server/load.php', 
    '/stalker_portal/server/load.php',
    '/c',
  ];

  for (const path of paths) {
    console.log(`\n--- Testing ${path} ---`);
    
    try {
      // Handshake
      const hsUrl = `${PORTAL}${path}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
      console.log(`Handshake URL: ${hsUrl}`);
      
      const hsRes = await fetch(hsUrl, { headers: { ...HEADERS, Cookie: cookie } });
      console.log(`Status: ${hsRes.status}`);
      
      const hsText = await hsRes.text();
      console.log(`Raw response (first 500 chars):\n${hsText.substring(0, 500)}`);
      
      // Try to parse
      let token = null;
      try {
        const clean = hsText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
        const data = JSON.parse(clean);
        token = data?.js?.token;
        console.log(`Parsed token: ${token}`);
      } catch (e) {
        console.log(`Parse error: ${e}`);
        continue;
      }

      if (!token) {
        console.log('No token found');
        continue;
      }

      // Get profile
      console.log('\nFetching profile...');
      const profUrl = `${PORTAL}${path}?type=stb&action=get_profile&JsHttpRequest=1-xml`;
      const profRes = await fetch(profUrl, {
        headers: { ...HEADERS, Cookie: cookie, Authorization: `Bearer ${token}` },
      });
      
      const profText = await profRes.text();
      console.log(`Profile status: ${profRes.status}`);
      
      try {
        const clean = profText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
        const data = JSON.parse(clean);
        const p = data?.js;
        
        console.log('\n=== PROFILE DATA ===');
        console.log(`id: ${p?.id} (type: ${typeof p?.id})`);
        console.log(`name: ${p?.name}`);
        console.log(`blocked: ${p?.blocked} (type: ${typeof p?.blocked})`);
        console.log(`status: ${p?.status} (type: ${typeof p?.status})`);
        console.log(`expire_billing_date: ${p?.expire_billing_date}`);
        console.log(`end_date: ${p?.end_date}`);
        console.log(`tariff_expired_date: ${p?.tariff_expired_date}`);
        console.log(`tariff_plan_name: ${p?.tariff_plan_name}`);
        console.log(`tariff_plan_id: ${p?.tariff_plan_id}`);
        
        console.log('\n=== FULL PROFILE JSON ===');
        console.log(JSON.stringify(p, null, 2));
        
      } catch (e) {
        console.log(`Profile parse error: ${e}`);
        console.log(`Raw: ${profText.substring(0, 1000)}`);
      }

      // If we got this far, we found a working endpoint
      console.log('\n✅ This endpoint works!');
      break;

    } catch (err) {
      console.log(`Error: ${err}`);
    }
  }
}

debug().catch(console.error);
