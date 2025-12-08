/**
 * Stalker Portal MAC Tester
 * Verifies a single MAC address works with a portal
 * 
 * Usage: npx tsx scripts/test-stalker-mac.ts <portal_url> <mac_address>
 * Example: npx tsx scripts/test-stalker-mac.ts http://line.stayconnected.pro/c 00:1A:2B:3C:4D:5E
 */

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n❌ Usage: npx tsx scripts/test-stalker-mac.ts <portal_url> <mac_address>\n');
  console.log('Example:');
  console.log('  npx tsx scripts/test-stalker-mac.ts http://line.stayconnected.pro/c 00:1A:2B:3C:4D:5E\n');
  process.exit(1);
}

// Parse portal URL - handle both base URL and full path
let PORTAL_BASE = args[0].replace(/\/$/, '');
const MAC_ADDRESS = args[1].toUpperCase();

// Common Stalker API paths to try
const API_PATHS = [
  '/portal.php',
  '/server/load.php', 
  '/stalker_portal/server/load.php',
  '/c/server/load.php',
  '/api.php',
];

const STB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
  'X-User-Agent': 'Model: MAG250; Link: WiFi',
  'Accept': '*/*',
  'Connection': 'keep-alive',
};

async function findApiEndpoint(): Promise<string | null> {
  console.log('\n1️⃣  Discovering API endpoint...');
  
  const encodedMac = encodeURIComponent(MAC_ADDRESS);
  const cookie = `mac=${encodedMac}; stb_lang=en; timezone=GMT`;

  for (const path of API_PATHS) {
    const testUrl = `${PORTAL_BASE}${path}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    console.log(`   Trying: ${path}`);
    
    try {
      const res = await fetch(testUrl, {
        headers: { ...STB_HEADERS, Cookie: cookie },
      });
      
      const text = await res.text();
      
      // Check if it's JSON with a token
      if (text.startsWith('{') || text.startsWith('/*-secure-')) {
        const cleanText = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
        try {
          const data = JSON.parse(cleanText);
          if (data?.js?.token) {
            console.log(`   ✅ Found API at: ${path}`);
            return `${PORTAL_BASE}${path}`;
          }
        } catch {}
      }
    } catch {}
  }
  
  // Try the URL as-is (maybe it's already the full API path)
  console.log(`   Trying URL as-is...`);
  try {
    const testUrl = `${PORTAL_BASE}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    const res = await fetch(testUrl, {
      headers: { ...STB_HEADERS, Cookie: cookie },
    });
    const text = await res.text();
    const cleanText = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    if (cleanText.startsWith('{')) {
      const data = JSON.parse(cleanText);
      if (data?.js?.token) {
        console.log(`   ✅ URL is the API endpoint`);
        return PORTAL_BASE;
      }
    }
  } catch {}

  return null;
}

async function testPortal() {
  console.log('\n🔍 STALKER PORTAL MAC TESTER\n');
  console.log(`Portal: ${PORTAL_BASE}`);
  console.log(`MAC: ${MAC_ADDRESS}`);
  console.log('─'.repeat(50));

  const encodedMac = encodeURIComponent(MAC_ADDRESS);
  const cookie = `mac=${encodedMac}; stb_lang=en; timezone=GMT`;

  // Step 1: Find the API endpoint
  const apiUrl = await findApiEndpoint();
  
  if (!apiUrl) {
    console.log('\n   ❌ Could not find Stalker API endpoint');
    console.log('   Try providing the full API path, e.g.:');
    console.log('   - http://domain.com/portal.php');
    console.log('   - http://domain.com/server/load.php');
    console.log('   - http://domain.com/stalker_portal/server/load.php');
    return;
  }

  // Step 2: Handshake to get token
  console.log('\n2️⃣  Performing handshake...');
  let token: string | null = null;
  try {
    const handshakeUrl = `${apiUrl}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    const handshakeRes = await fetch(handshakeUrl, {
      headers: { ...STB_HEADERS, Cookie: cookie },
    });

    let handshakeText = await handshakeRes.text();
    // Handle secure JSON wrapper
    handshakeText = handshakeText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    
    console.log(`   Response: ${handshakeText.substring(0, 200)}${handshakeText.length > 200 ? '...' : ''}`);

    const handshakeData = JSON.parse(handshakeText);
    token = handshakeData?.js?.token;

    if (token) {
      console.log(`   ✅ Token received: ${token.substring(0, 20)}...`);
    } else {
      console.log('   ❌ No token in response');
      console.log('   Full response:', JSON.stringify(handshakeData, null, 2));
      return;
    }
  } catch (err) {
    console.log(`   ❌ Handshake failed: ${err instanceof Error ? err.message : err}`);
    return;
  }

  // Step 3: Get profile
  console.log('\n3️⃣  Fetching account profile...');
  try {
    const profileUrl = `${apiUrl}?type=stb&action=get_profile&JsHttpRequest=1-xml`;
    const profileRes = await fetch(profileUrl, {
      headers: {
        ...STB_HEADERS,
        Cookie: cookie,
        Authorization: `Bearer ${token}`,
      },
    });

    let profileText = await profileRes.text();
    // Handle secure JSON wrapper
    profileText = profileText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    const profileData = JSON.parse(profileText);
    const profile = profileData?.js;

    if (!profile) {
      console.log('   ❌ No profile data');
      console.log('   Response:', profileText.substring(0, 500));
      return;
    }

    console.log('   ✅ Profile received!\n');
    console.log('─'.repeat(50));
    
    // Check if this is a real account or just default/empty response
    const accountId = parseInt(profile.id) || 0;
    const isRealAccount = accountId > 0;
    const isBlocked = profile.blocked === '1' || profile.blocked === 1 || profile.blocked === true;
    
    // Get expiry - check for valid date (not 0000-00-00)
    const expiryRaw = profile.expire_billing_date || profile.end_date || profile.tariff_expired_date;
    const isValidExpiry = expiryRaw && !expiryRaw.startsWith('0000-00-00');
    
    console.log('📋 ACCOUNT ANALYSIS:\n');
    
    if (!isRealAccount) {
      console.log('   ❌ NO ACCOUNT FOUND');
      console.log('   This MAC is not registered on this portal.');
      console.log(`   (ID returned: ${profile.id})`);
      console.log('\n' + '─'.repeat(50));
      console.log('\n❌ MAC NOT REGISTERED\n');
      return;
    }

    // Display account info
    console.log(`   Account ID: ${profile.id}`);
    if (profile.name && profile.name !== '0') console.log(`   Name: ${profile.name}`);
    if (profile.login) console.log(`   Login: ${profile.login}`);
    console.log(`   Blocked: ${isBlocked ? '❌ YES' : '✅ No'}`);
    
    if (profile.tariff_plan_name) console.log(`   Tariff Plan: ${profile.tariff_plan_name}`);
    if (profile.tariff_plan_id && profile.tariff_plan_id !== '0') {
      console.log(`   Tariff ID: ${profile.tariff_plan_id}`);
    }
    
    if (profile.created && !profile.created.startsWith('0000')) {
      console.log(`   Created: ${profile.created}`);
    }
    
    if (profile.account_balance) console.log(`   Balance: ${profile.account_balance}`);

    // Expiry analysis
    console.log('\n   📅 SUBSCRIPTION:');
    if (!isValidExpiry) {
      console.log('      ❌ No valid expiry date (no subscription)');
    } else {
      console.log(`      Expiry: ${expiryRaw}`);
      const expiryDate = new Date(expiryRaw);
      const now = new Date();
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);

      if (diffDays > 0) {
        console.log(`      ✅ ${diffDays} days remaining (${diffMonths.toFixed(1)} months)`);
      } else {
        console.log(`      ❌ EXPIRED ${Math.abs(diffDays)} days ago`);
      }
    }

    console.log('\n' + '─'.repeat(50));

    // Final verdict
    const hasValidSubscription = isValidExpiry && new Date(expiryRaw) > new Date();
    
    if (isBlocked) {
      console.log('\n❌ MAC IS BLOCKED\n');
    } else if (!hasValidSubscription) {
      console.log('\n⚠️  MAC exists but subscription expired/missing\n');
    } else {
      const expiryDate = new Date(expiryRaw);
      const monthsLeft = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
      console.log(`\n✅ MAC IS VALID! (${monthsLeft.toFixed(1)} months remaining)\n`);
    }

    // Raw profile dump
    console.log('📦 Raw Profile Data:');
    console.log(JSON.stringify(profile, null, 2));

  } catch (err) {
    console.log(`   ❌ Profile fetch failed: ${err instanceof Error ? err.message : err}`);
  }
}

testPortal().catch(console.error);
