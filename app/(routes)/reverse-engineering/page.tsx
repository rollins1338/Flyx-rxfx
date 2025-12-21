'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './reverse-engineering.css';

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'philosophy', title: 'Philosophy' },
  { id: 'dlhd', title: 'DLHD Live TV' },
  { id: '111movies', title: '111movies (1movies)' },
  { id: 'flixer', title: 'Flixer (WASM Cracking)' },
  { id: 'vidsrc', title: 'VidSrc' },
  { id: 'videasy', title: 'Videasy' },
  { id: 'animekai', title: 'AnimeKai' },
  { id: 'proxy-architecture', title: 'Proxy Architecture' },
  { id: 'techniques', title: 'Common Techniques' },
  { id: 'tools', title: 'Tools & Methods' },
  { id: 'contribute', title: 'Contributing' },
];

export default function ReverseEngineeringPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [progress, setProgress] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress((scrollTop / docHeight) * 100);

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };


  return (
    <div className="re-page">
      <div className="progress-bar" style={{ width: `${progress}%` }} />

      <header className="re-header">
        <Link href="/about" className="back-link">← Back to About</Link>
        <div className="badge">Technical Documentation • Last Updated: December 2025</div>
        <h1>Reverse Engineering Streaming Providers</h1>
        <p className="subtitle">
          A comprehensive guide to bypassing embed protections and extracting clean m3u8 streams 
          without ads, popups, or malware. Because you deserve to watch content without your 
          browser catching fire.
        </p>
        <div className="warning-box">
          <span className="warning-icon">⚠️</span>
          <div>
            <strong>Educational Purpose Only</strong>
            <p>
              This documentation is provided for educational and research purposes. The techniques 
              described here demonstrate how streaming site protections work and can be bypassed. 
              Use this knowledge responsibly.
            </p>
          </div>
        </div>
      </header>

      <div className="re-layout">
        <nav className="re-nav">
          <div className="nav-inner">
            <div className="nav-header">
              <span className="nav-title">Contents</span>
              <span className="nav-progress">{Math.round(progress)}%</span>
            </div>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={activeSection === s.id ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="nav-num">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <main className="re-content">
          {/* Overview */}
          <section id="overview">
            <h2>Overview</h2>
            <p className="lead">
              Most &quot;free&quot; streaming sites wrap their content in layers of obfuscation, 
              aggressive advertising, and sometimes outright malware. But here&apos;s the thing: 
              the actual video streams are just standard HLS (m3u8) files. All the garbage is 
              just a wrapper designed to monetize you.
            </p>
            <p>
              By reverse engineering these protections, we can extract the clean stream URLs and 
              play them in our own player—no ads, no popups, no cryptocurrency miners running in 
              the background.
            </p>
            <div className="provider-grid">
              <div className="provider-card">
                <div className="provider-status working">✓ Working</div>
                <h3>DLHD Live TV</h3>
                <p>AES-128 HLS with session-based auth. Requires heartbeat to establish session before key fetch. Updated December 2025.</p>
              </div>
              <div className="provider-card">
                <div className="provider-status working">✓ Working</div>
                <h3>111movies</h3>
                <p>AES-256-CBC encryption with XOR obfuscation and alphabet substitution. Fully cracked December 2025.</p>
              </div>
              <div className="provider-card">
                <div className="provider-status working">✓ Working</div>
                <h3>Flixer / Hexa</h3>
                <p>Rust WASM encryption with browser fingerprinting. 12-hour reverse engineering session with Ghidra. December 2025.</p>
              </div>
              <div className="provider-card">
                <div className="provider-status working">✓ Working</div>
                <h3>VidSrc</h3>
                <p>Static decoders for HEX, ROT3, and Base64 formats. No remote script execution needed.</p>
              </div>
              <div className="provider-card">
                <div className="provider-status working">✓ Working</div>
                <h3>Videasy</h3>
                <p>17 servers across 8 languages. External decryption API for encrypted responses.</p>
              </div>
              <div className="provider-card">
                <div className="provider-status working">✓ Working</div>
                <h3>AnimeKai</h3>
                <p>Anime specialist with MegaUp CDN. Requires residential proxy to bypass datacenter IP blocking.</p>
              </div>
            </div>
          </section>


          {/* Philosophy */}
          <section id="philosophy">
            <h2>Philosophy</h2>
            <h3>Why We Do This</h3>
            <p>
              The streaming sites we reverse engineer are not legitimate businesses. They profit 
              from content they don&apos;t own by wrapping it in exploitative monetization. We&apos;re 
              not stealing from creators—we&apos;re bypassing the middlemen who were already stealing.
            </p>
            <blockquote>
              &quot;We are not pirates. We are pirates who rob pirates. It&apos;s like being a 
              vigilante, except instead of fighting crime we are fighting pop-up advertisements 
              and cryptocurrency miners.&quot;
            </blockquote>
            <h3>The Rules</h3>
            <ul>
              <li><strong>No Puppeteer/Browser Automation</strong> - Pure HTTP requests only. If we need a browser, we haven&apos;t cracked it properly.</li>
              <li><strong>No Embedding Their Players</strong> - Their players contain ads and tracking. We extract the stream and use our own player.</li>
              <li><strong>Document Everything</strong> - Knowledge should be shared so others can build on it.</li>
              <li><strong>Keep It Updated</strong> - Providers change their obfuscation. We adapt.</li>
            </ul>
          </section>

          {/* DLHD Live TV */}
          <section id="dlhd">
            <h2>DLHD Live TV - Auth Token Discovery</h2>
            <div className="status-badge success">Fully Reverse Engineered - December 2025</div>
            
            <h3>Overview</h3>
            <p>
              DLHD (daddyhd.com) provides live TV streams using HLS with AES-128 encryption. The key 
              server initially appeared to block datacenter IPs, but reverse engineering their 
              obfuscated JavaScript player revealed the real protection: Bearer token authentication.
            </p>
            <p>
              The breakthrough came from analyzing the player iframe at <code>epicplayplay.cfd</code>, 
              where we discovered that auth tokens are generated server-side and embedded in the page. 
              With the correct token, key requests work from ANY IP—no residential proxy needed.
            </p>

            <h3>The Problem</h3>
            <p>
              Initial attempts to fetch encryption keys returned errors. The key server at 
              <code>chevy.kiko2.ru</code> seemed to reject requests from datacenter IPs. We tried:
            </p>
            <ul>
              <li>Different User-Agent strings</li>
              <li>Various Referer headers</li>
              <li>Cookie forwarding</li>
              <li>TLS fingerprint spoofing</li>
            </ul>
            <p>
              None worked. But the browser worked fine from the same IP. This meant it wasn&apos;t 
              IP-based blocking—something else was happening.
            </p>

            <h3>The Discovery</h3>
            <p>
              By fetching and analyzing the player page at <code>epicplayplay.cfd/premiumtv/daddyhd.php</code>, 
              we found the key: an <code>AUTH_TOKEN</code> variable embedded in the JavaScript.
            </p>
            <div className="code-block">
              <div className="code-header">
                <span>Token Extraction</span>
                <button 
                  onClick={() => copyCode('AUTH_TOKEN\\\\s*=\\\\s*["\']([^"\']+)["\']', 'dlhd-regex')}
                  className={copiedCode === 'dlhd-regex' ? 'copied' : ''}
                >
                  {copiedCode === 'dlhd-regex' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre><code>{`// Fetch the player page
const playerUrl = \`https://epicplayplay.cfd/premiumtv/daddyhd.php?id=\${channel}\`;
const html = await fetch(playerUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 ...',
    'Referer': 'https://daddyhd.com/',
  }
}).then(r => r.text());

// Extract the auth token
const match = html.match(/AUTH_TOKEN\\s*=\\s*["']([^"']+)["']/);
const authToken = match[1];
// Token looks like: "713384aaecd20309fbc8..."`}</code></pre>
            </div>

            <h3>The Algorithm (Updated December 2025)</h3>
            <p>
              DLHD added a <strong>heartbeat session requirement</strong> in December 2025. Simply having 
              the auth token is no longer enough—you must establish a session via the heartbeat endpoint first.
            </p>
            <div className="algorithm-flow">
              <div className="flow-step">
                <span className="step-num">1</span>
                <div>
                  <h4>Get Server Key</h4>
                  <p>Call <code>server_lookup?channel_id=premium{'{channel}'}</code> to get CDN server (zeko, chevy, etc.)</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">2</span>
                <div>
                  <h4>Fetch Auth Token</h4>
                  <p>Get <code>AUTH_TOKEN</code> and <code>CHANNEL_KEY</code> from player page</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <div>
                  <h4>Establish Heartbeat Session</h4>
                  <p>Call <code>https://{'{server}'}.kiko2.ru/heartbeat</code> with auth headers. Returns session expiry (~5 hours).</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <div>
                  <h4>Fetch M3U8 Playlist</h4>
                  <p>Build URL: <code>https://{'{server}'}new.kiko2.ru/{'{server}'}/premium{'{channel}'}/mono.css</code></p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">5</span>
                <div>
                  <h4>Fetch Key with Session</h4>
                  <p>Request key with <code>Authorization: Bearer {'{token}'}</code> + <code>X-Channel-Key</code> headers</p>
                </div>
              </div>
            </div>
            
            <h3>Heartbeat Session (New in Dec 2025)</h3>
            <p>
              Without calling the heartbeat endpoint first, key requests return error <code>E2: &quot;Session must be created via heartbeat first&quot;</code>.
            </p>
            <div className="code-block">
              <div className="code-header"><span>Heartbeat Request</span></div>
              <pre><code>{`// Establish session before fetching keys
const heartbeatUrl = 'https://chevy.kiko2.ru/heartbeat';
const response = await fetch(heartbeatUrl, {
  method: 'GET',
  headers: {
    'Authorization': \`Bearer \${authToken}\`,
    'X-Channel-Key': channelKey,  // e.g., "premium51"
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
  }
});

// Response: {"expiry":1765944911,"message":"Session created","status":"ok"}
const { expiry, status } = await response.json();
// Session valid for ~5 hours (expiry is Unix timestamp)`}</code></pre>
            </div>
            
            <h3>Error Codes</h3>
            <div className="endpoint-list">
              <div className="endpoint">
                <span className="method get">E2</span>
                <code>&quot;Session must be created via heartbeat first&quot;</code>
                <p>Call heartbeat endpoint before fetching keys</p>
              </div>
              <div className="endpoint">
                <span className="method get">E3</span>
                <code>Token expired or invalid</code>
                <p>Refresh auth token from player page</p>
              </div>
              <div className="endpoint">
                <span className="method get">400</span>
                <code>Missing X-Channel-Key header</code>
                <p>Add X-Channel-Key header to heartbeat/key requests</p>
              </div>
            </div>

            <h3>Key Request Headers</h3>
            <p>The key server requires specific headers. The critical one is <code>Authorization</code>:</p>
            <div className="code-block">
              <div className="code-header"><span>Required Headers for Key Fetch</span></div>
              <pre><code>{`{
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': '*/*',
  'Origin': 'https://epicplayplay.cfd',
  'Referer': 'https://epicplayplay.cfd/',
  'Authorization': 'Bearer \${authToken}',  // THE KEY!
  'X-Channel-Key': 'premium\${channel}',
}`}</code></pre>
            </div>

            <h3>URL Patterns</h3>
            <div className="endpoint-list">
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>https://epicplayplay.cfd/premiumtv/daddyhd.php?id={'{channel}'}</code>
                <p>Player page containing AUTH_TOKEN and CHANNEL_KEY</p>
              </div>
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>https://{'{server}'}.kiko2.ru/heartbeat</code>
                <p>Establish session. Requires: <code>Authorization</code> + <code>X-Channel-Key</code> headers</p>
              </div>
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>https://chevy.giokko.ru/server_lookup?channel_id=premium{'{channel}'}</code>
                <p>Returns JSON: <code>{`{"server_key": "zeko"}`}</code></p>
              </div>
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>https://{'{server}'}new.kiko2.ru/{'{server}'}/premium{'{channel}'}/mono.css</code>
                <p>Returns HLS M3U8 playlist with AES-128 encryption</p>
              </div>
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>https://{'{server}'}.kiko2.ru/key/premium{'{channel}'}/{'{keyId}'}</code>
                <p>Returns 16-byte AES key (requires session + auth headers)</p>
              </div>
            </div>

            <h3>Implementation</h3>
            <div className="code-block">
              <div className="code-header"><span>Complete Session + Key Fetch</span></div>
              <pre><code>{`async function fetchDLHDKey(keyUrl, channel) {
  // Step 1: Get auth token from player page (cached)
  const { token, channelKey } = await getAuthToken(channel);
  if (!token) throw new Error('Failed to get auth token');
  
  // Step 2: Establish heartbeat session (required since Dec 2025)
  const hbResponse = await fetch('https://chevy.kiko2.ru/heartbeat', {
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'X-Channel-Key': channelKey,
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    },
  });
  const { status, expiry } = await hbResponse.json();
  if (status !== 'ok') throw new Error('Heartbeat failed');
  
  // Step 3: Fetch key with session
  const response = await fetch(keyUrl, {
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'X-Channel-Key': channelKey,
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    },
  });
  
  const keyData = await response.arrayBuffer();
  if (keyData.byteLength !== 16) {
    const text = new TextDecoder().decode(keyData);
    if (text.includes('E2')) throw new Error('Session not established');
    throw new Error(\`Invalid key: \${text}\`);
  }
  
  return keyData; // Valid 16-byte AES key
}`}</code></pre>
            </div>

            <h3>Why This Works</h3>
            <p>
              The auth token + heartbeat session system is tied to the token, not the IP address. This means:
            </p>
            <ul>
              <li><strong>No residential proxy needed</strong> - Works from Cloudflare Workers</li>
              <li><strong>Session validity ~5 hours</strong> - Heartbeat returns Unix timestamp expiry</li>
              <li><strong>Auto-refresh sessions</strong> - We refresh 2 minutes before expiry</li>
              <li><strong>Per-channel isolation</strong> - Each channel needs its own session</li>
              <li><strong>No IP blocking</strong> - The &quot;blocking&quot; was just missing session</li>
            </ul>

            <h3>Session Management</h3>
            <p>
              For long viewing sessions, the session must be kept alive. Our implementation:
            </p>
            <ul>
              <li>Caches sessions per channel with expiry tracking</li>
              <li>Refreshes 2 minutes before expiry to avoid interruption</li>
              <li>Retries with fresh session on E2 errors</li>
              <li>Maximum cache TTL of 20 minutes regardless of expiry</li>
            </ul>

            <h3>Lessons Learned</h3>
            <blockquote>
              &quot;When requests fail from code but work in browser, don&apos;t assume IP blocking. 
              Check what headers the browser is actually sending. The answer is usually in the 
              JavaScript. And when that stops working, check if they added a session requirement.&quot;
              <cite>- Field Notes, December 2025</cite>
            </blockquote>
            <p>
              This crack evolved over time. First we discovered the Bearer token (worked for months), 
              then DLHD added the heartbeat session requirement. The key insight: always monitor for 
              new error codes and trace them back to the player JavaScript.
            </p>
          </section>

          {/* 111movies */}
          <section id="111movies">
            <h2>111movies (1movies) - Complete Breakdown</h2>
            <div className="status-badge success">Fully Reverse Engineered - December 2025</div>
            
            <h3>Overview</h3>
            <p>
              111movies uses a Next.js frontend with a sophisticated encoding scheme to protect their 
              API endpoints. The encoding involves AES-256-CBC encryption, XOR obfuscation, and custom 
              alphabet substitution. We cracked it completely without any browser automation.
            </p>

            <h3>The Algorithm</h3>
            <div className="algorithm-flow">
              <div className="flow-step">
                <span className="step-num">1</span>
                <div>
                  <h4>Extract Page Data</h4>
                  <p>Fetch the page and extract <code>__NEXT_DATA__.props.pageProps.data</code></p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">2</span>
                <div>
                  <h4>AES-256-CBC Encrypt</h4>
                  <p>Encrypt the page data using static key and IV, output as hex string</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <div>
                  <h4>XOR Obfuscation</h4>
                  <p>XOR each character with a 9-byte rotating key</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <div>
                  <h4>Base64 Encode</h4>
                  <p>UTF-8 encode the XORed string, then Base64 with URL-safe characters</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">5</span>
                <div>
                  <h4>Alphabet Substitution</h4>
                  <p>Replace each character using a shuffled alphabet mapping</p>
                </div>
              </div>
            </div>

            <h3>Extracted Keys</h3>
            <p>These keys were extracted from their obfuscated JavaScript bundle (<code>860-58807119fccb267b.js</code>):</p>
            
            <div className="code-block">
              <div className="code-header">
                <span>AES Key (32 bytes)</span>
                <button 
                  onClick={() => copyCode('[3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]', 'aes-key')}
                  className={copiedCode === 'aes-key' ? 'copied' : ''}
                >
                  {copiedCode === 'aes-key' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre><code>{`const AES_KEY = Buffer.from([
  3, 75, 207, 198, 39, 85, 65, 255,
  64, 89, 191, 251, 35, 214, 209, 210,
  62, 164, 155, 85, 247, 158, 167, 48,
  172, 84, 13, 18, 19, 166, 19, 57
]);`}</code></pre>
            </div>

            <div className="code-block">
              <div className="code-header">
                <span>IV (16 bytes)</span>
                <button 
                  onClick={() => copyCode('[162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]', 'iv')}
                  className={copiedCode === 'iv' ? 'copied' : ''}
                >
                  {copiedCode === 'iv' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre><code>{`const AES_IV = Buffer.from([
  162, 231, 173, 134, 84, 100, 241, 33,
  5, 233, 223, 132, 245, 189, 171, 237
]);`}</code></pre>
            </div>

            <div className="code-block">
              <div className="code-header">
                <span>XOR Key (9 bytes)</span>
                <button 
                  onClick={() => copyCode('[170,162,126,126,60,255,136,130,133]', 'xor-key')}
                  className={copiedCode === 'xor-key' ? 'copied' : ''}
                >
                  {copiedCode === 'xor-key' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre><code>{`const XOR_KEY = Buffer.from([170, 162, 126, 126, 60, 255, 136, 130, 133]);`}</code></pre>
            </div>

            <div className="code-block">
              <div className="code-header">
                <span>Alphabet Mapping</span>
                <button 
                  onClick={() => copyCode('Standard: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_\nShuffled: TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks', 'alphabet')}
                  className={copiedCode === 'alphabet' ? 'copied' : ''}
                >
                  {copiedCode === 'alphabet' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre><code>{`const STANDARD = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";`}</code></pre>
            </div>

            <h3>API Endpoints</h3>
            <div className="endpoint-list">
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>/{'{API_HASH}'}/{'{encoded}'}/sr</code>
                <p>Returns list of available sources (Alpha, Charlie, Delta, etc.)</p>
              </div>
              <div className="endpoint">
                <span className="method get">GET</span>
                <code>/{'{API_HASH}'}/{'{source.data}'}</code>
                <p>Returns JSON with m3u8 URL: <code>{`{"url": "https://...m3u8", "tracks": [...]}`}</code></p>
              </div>
            </div>

            <h3>Required Headers</h3>
            <p>The API requires specific headers to return data instead of a 403:</p>
            <div className="code-block">
              <div className="code-header"><span>Required Headers</span></div>
              <pre><code>{`{
  'X-Requested-With': 'XMLHttpRequest',  // Critical!
  'Content-Type': 'application/octet-stream',
  'Referer': 'https://111movies.com/',
  'User-Agent': 'Mozilla/5.0 ...'
}`}</code></pre>
            </div>

            <h3>CDN Proxy Requirement</h3>
            <p>
              The 1movies CDN (<code>p.XXXXX.workers.dev</code>) blocks datacenter IPs. Requests from 
              Cloudflare Workers, AWS, Vercel, etc. return 403. Solution: route through a residential 
              proxy (Raspberry Pi on home internet).
            </p>
            <div className="code-block">
              <div className="code-header"><span>CDN Detection Pattern</span></div>
              <pre><code>{`// 1movies CDN URLs match this pattern:
// https://p.10014.workers.dev/...
function is1moviesCdnUrl(url) {
  if (url.includes('.workers.dev')) {
    if (url.match(/p\\.\\d+\\.workers\\.dev/)) return true;
  }
  return false;
}`}</code></pre>
            </div>

            <h3>How We Cracked It</h3>
            <ol>
              <li><strong>Bundle Analysis:</strong> Downloaded their webpack chunks and searched for crypto-related strings</li>
              <li><strong>String Deobfuscation:</strong> Found the string array and decoder function, decoded all strings</li>
              <li><strong>Key Extraction:</strong> Located byte arrays being passed to <code>createCipheriv</code></li>
              <li><strong>Algorithm Tracing:</strong> Followed the encoding flow from page data to API request</li>
              <li><strong>Header Discovery:</strong> Compared browser requests to our requests, found missing <code>X-Requested-With</code></li>
              <li><strong>CDN Bypass:</strong> Discovered datacenter IP blocking, implemented residential proxy routing</li>
            </ol>
          </section>


          {/* Flixer / Hexa */}
          <section id="flixer">
            <h2>Flixer / Hexa - WASM Reverse Engineering</h2>
            <div className="status-badge success">Fully Reverse Engineered - December 21, 2025 (2 AM)</div>
            
            <h3>Overview</h3>
            <p>
              Flixer.sh (and its sister site Hexa.su) represents the most sophisticated encryption 
              we&apos;ve encountered. They use a Rust-compiled WebAssembly module for key generation 
              and AES-256-CTR encryption with HMAC authentication. After a 12-hour reverse engineering 
              session involving Ghidra, memory forensics, and approximately 150 test scripts, we 
              cracked it.
            </p>
            <p>
              The breakthrough: instead of replicating their key derivation algorithm (which proved 
              impossible), we bundle their actual WASM binary into our Cloudflare Worker and run it 
              server-side with mocked browser APIs.
            </p>

            <h3>The Challenge</h3>
            <p>
              Flixer&apos;s protection is multi-layered:
            </p>
            <ul>
              <li><strong>WASM Encryption:</strong> All API responses are encrypted with AES-256-CTR</li>
              <li><strong>Browser Fingerprinting:</strong> Keys are derived from screen size, User-Agent, timezone, canvas fingerprint</li>
              <li><strong>Session Binding:</strong> Each browser session generates a unique 64-char hex key</li>
              <li><strong>HMAC Authentication:</strong> Requests require HMAC-SHA256 signatures</li>
              <li><strong>Anti-Bot Detection:</strong> Checks for HeadlessChrome, PhantomJS, Selenium</li>
              <li><strong>CDN IP Blocking:</strong> Their CDN (p.XXXXX.workers.dev) blocks datacenter IPs</li>
            </ul>

            <h3>The WASM Binary</h3>
            <div className="code-block">
              <div className="code-header"><span>WASM Analysis</span></div>
              <pre><code>{`File: img_data_bg.wasm
Size: 136,881 bytes
Functions: 377 total (52 imported, 325 defined)
Language: Compiled from Rust

Key Exports:
  get_img_key()                    → Returns 64-char hex session key
  process_img_data(encrypted, key) → Decrypts API responses

Rust Crates Identified (via Ghidra):
  - aes-0.8.4 (fixslice32.rs)     → AES-256 encryption
  - ctr-0.9.2 (ctr32.rs)          → CTR mode
  - hmac-0.12.1                    → HMAC authentication
  - cipher-0.4.4                   → Stream cipher traits
  - base64-0.21.7                  → Base64 encoding
  - serde_json-1.0.141            → JSON parsing`}</code></pre>
            </div>

            <h3>Fingerprint Discovery</h3>
            <p>
              Through memory analysis, we discovered the exact fingerprint string format stored in 
              WASM memory at offset 1119360:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Fingerprint Format (131 chars)</span></div>
              <pre><code>{`{colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}

Example:
24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:360:1766278661:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk`}</code></pre>
            </div>

            <h3>What We Tried (And Failed)</h3>
            <p>
              We spent hours trying to replicate the key derivation in pure JavaScript:
            </p>
            <ul>
              <li>SHA256, SHA384, SHA512, SHA1, MD5 of fingerprint string</li>
              <li>HMAC-SHA256 with various keys</li>
              <li>HKDF with various salts/info</li>
              <li>PBKDF2 with various iterations</li>
              <li>xorshift128+, splitmix64, PCG32 PRNGs</li>
              <li>Canvas pixel data hashing</li>
              <li>XOR combinations with embedded constants</li>
            </ul>
            <p>
              None matched. The key derivation uses a custom algorithm buried in the compiled Rust code.
            </p>

            <h3>The Breakthrough: WASM Bundling</h3>
            <p>
              Instead of cracking the algorithm, we bundle their WASM binary directly into our 
              Cloudflare Worker. The key insight: WASM runs anywhere that provides the expected 
              browser APIs. We mock those APIs server-side.
            </p>
            <div className="code-block">
              <div className="code-header"><span>WASM Import Mocking</span></div>
              <pre><code>{`// The WASM expects browser APIs. We provide mocks:

const mockWindow = {
  document: {
    createElement: (tag) => tag === 'canvas' ? mockCanvas : {},
    getElementsByTagName: (tag) => tag === 'body' ? [mockBody] : [],
  },
  localStorage: {
    getItem: (key) => key === 'tmdb_session_id' ? sessionId : null,
    setItem: () => {},
  },
  navigator: { platform: 'Win32', language: 'en-US', userAgent: '...' },
  screen: { width: 1920, height: 1080, colorDepth: 24 },
  performance: { now: () => Date.now() - timestamp },
};

// Canvas fingerprint mock (deterministic)
const mockCanvas = {
  width: 200, height: 50,
  getContext: () => ({
    fillText: () => {},
    font: '14px Arial',
    textBaseline: 'top',
  }),
  toDataURL: () => 'data:image/png;base64,iVBORw0KGgo...',
};`}</code></pre>
            </div>

            <h3>Critical Discovery: Header Blocking</h3>
            <p>
              After getting WASM working, requests still failed. Hours of debugging revealed:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Headers That BLOCK Requests</span></div>
              <pre><code>{`// These headers cause Flixer to reject requests:

'bW90aGFmYWth': '1'     // Base64 for "mothafaka" - anti-scraping marker!
'Origin': '...'         // Browser adds this automatically
'sec-fetch-*': '...'    // Fetch metadata headers

// Solution: Don't send these headers from the Worker`}</code></pre>
            </div>

            <h3>API Authentication</h3>
            <p>
              Flixer requires HMAC-SHA256 signed requests:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Request Signing</span></div>
              <pre><code>{`// Generate authentication headers
const timestamp = Math.floor(Date.now() / 1000);
const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 22);
const path = '/api/tmdb/movie/550/images';

// HMAC signature
const message = \`\${apiKey}:\${timestamp}:\${nonce}:\${path}\`;
const signature = await hmacSha256(apiKey, message);

const headers = {
  'X-Api-Key': apiKey,           // 64-char hex from get_img_key()
  'X-Request-Timestamp': timestamp,
  'X-Request-Nonce': nonce,
  'X-Request-Signature': btoa(signature),
  'X-Client-Fingerprint': fingerprint,
  'Accept': 'text/plain',
  // NO Origin, NO bW90aGFmYWth!
};`}</code></pre>
            </div>

            <h3>Encryption Scheme</h3>
            <div className="code-block">
              <div className="code-header"><span>Response Structure</span></div>
              <pre><code>{`// Encrypted response format:
// [195 bytes prefix] + [ciphertext]

Prefix contains:
  - IV/Nonce for AES-CTR
  - HMAC-SHA256 authentication tag

Algorithm: AES-256-CTR (fixslice32 implementation)
Key: Derived from API key + session key (internal WASM logic)
Authentication: HMAC-SHA256 (modifying any byte fails)

// Decryption via WASM
const decrypted = await wasmLoader.process_img_data(encrypted, apiKey);
const data = JSON.parse(decrypted);
// data.sources[0].url → HLS stream URL`}</code></pre>
            </div>

            <h3>Hexa.su (Sister Site)</h3>
            <p>
              Hexa.su uses a different encryption scheme but is owned by the same people:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Hexa Encryption</span></div>
              <pre><code>{`// Hexa uses simpler encryption (no WASM)
// But the algorithm is closed-source and changes frequently

Structure:
  - 12-byte nonce prefix
  - XOR-based stream cipher (no auth tag)
  - Key: Random 32-byte hex string (X-Api-Key header)

// We use enc-dec.app API for Hexa decryption
const decrypted = await fetch('https://enc-dec.app/api/dec-hexa', {
  method: 'POST',
  body: JSON.stringify({ text: encrypted, key: apiKey })
});`}</code></pre>
            </div>

            <h3>CDN Proxy Requirement</h3>
            <p>
              Flixer&apos;s CDN (<code>p.XXXXX.workers.dev</code>) blocks datacenter IPs AND requires 
              a Referer header. This is the opposite of MegaUp (which blocks Referer).
            </p>
            <div className="code-block">
              <div className="code-header"><span>CDN Requirements</span></div>
              <pre><code>{`// Flixer CDN (p.10014.workers.dev, etc.)
// REQUIRES: Referer: https://flixer.sh/
// BLOCKS: Datacenter IPs (Cloudflare, AWS, Vercel)

// Solution: Route through RPI residential proxy WITH Referer
const proxyUrl = \`/animekai?url=\${encodeURIComponent(cdnUrl)}&referer=\${encodeURIComponent('https://flixer.sh/')}\`;

// RPI proxy detects Flixer CDN and adds Referer header
if (url.hostname.match(/^p\\.\\d+\\.workers\\.dev$/)) {
  headers['Referer'] = customReferer || 'https://flixer.sh/';
}`}</code></pre>
            </div>

            <h3>Server Names</h3>
            <p>
              Flixer uses NATO phonetic alphabet for server names, mapped to mythology:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Server Mapping</span></div>
              <pre><code>{`alpha   → Ares      (Primary)
bravo   → Balder
charlie → Circe
delta   → Dionysus
echo    → Eros
foxtrot → Freya`}</code></pre>
            </div>

            <h3>Implementation Architecture</h3>
            <div className="algorithm-flow">
              <div className="flow-step">
                <span className="step-num">1</span>
                <div>
                  <h4>Initialize WASM</h4>
                  <p>Load bundled WASM binary, inject mocked browser APIs</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">2</span>
                <div>
                  <h4>Sync Server Time</h4>
                  <p>Call <code>/api/time</code> to calculate server time offset</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <div>
                  <h4>Generate API Key</h4>
                  <p>Call <code>get_img_key()</code> → 64-char hex session key</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <div>
                  <h4>Warm-up Request</h4>
                  <p>Make request WITHOUT X-Server header (required quirk)</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">5</span>
                <div>
                  <h4>Fetch Encrypted Data</h4>
                  <p>Request with HMAC signature + X-Server header</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">6</span>
                <div>
                  <h4>Decrypt Response</h4>
                  <p>Call <code>process_img_data(encrypted, apiKey)</code></p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">7</span>
                <div>
                  <h4>Proxy Stream</h4>
                  <p>Route CDN URL through RPI proxy with Referer header</p>
                </div>
              </div>
            </div>

            <h3>Lessons Learned</h3>
            <blockquote>
              &quot;Sometimes the best way to crack encryption is to not crack it at all. Just run 
              their code in your environment with mocked inputs. If you can&apos;t beat the algorithm, 
              become the algorithm.&quot;
              <cite>- Field Notes, December 21, 2025, 2:00 AM</cite>
            </blockquote>
            <p>
              Key insights from this 12-hour session:
            </p>
            <ul>
              <li><strong>WASM is portable:</strong> If you can mock the imports, you can run it anywhere</li>
              <li><strong>Headers matter:</strong> One wrong header can block everything</li>
              <li><strong>Ghidra works on WASM:</strong> The WASM plugin is invaluable for understanding compiled Rust</li>
              <li><strong>Memory forensics:</strong> Watching WASM memory during execution reveals secrets</li>
              <li><strong>CDNs have quirks:</strong> Flixer CDN needs Referer, MegaUp blocks it—test both</li>
              <li><strong>Sleep is optional:</strong> But coffee is mandatory</li>
            </ul>

            <h3>Files Created During Research</h3>
            <p>
              The <code>source-testing/tests/</code> directory contains ~150 test scripts from this 
              reverse engineering session, including:
            </p>
            <ul>
              <li><code>crack-wasm-*.js</code> - Various WASM cracking attempts</li>
              <li><code>hexa-crack-v*.js</code> - Hexa encryption analysis (46 versions)</li>
              <li><code>flixer-*.js</code> - Flixer-specific tests</li>
              <li><code>wasm-analysis/</code> - Ghidra exports and documentation</li>
            </ul>
          </section>


          {/* VidSrc */}
          <section id="vidsrc">
            <h2>VidSrc - Static Decoder Implementation</h2>
            <div className="status-badge success">Working - Primary Provider</div>
            
            <h3>Overview</h3>
            <p>
              VidSrc (vidsrc-embed.ru → cloudnestra.com) is our primary provider for movies and TV shows. 
              We reverse engineered their encoding schemes and implemented static decoders—no remote 
              script execution required. This avoids Cloudflare detection from fetching decoder scripts.
            </p>

            <h3>Architecture</h3>
            <div className="code-block">
              <div className="code-header"><span>Request Flow</span></div>
              <pre><code>{`1. vidsrc-embed.ru/embed/{type}/{tmdbId}
   └─> Extract RCP iframe URL

2. cloudnestra.com/rcp/{hash}
   └─> Extract prorcp/srcrcp URL (may have Turnstile)

3. cloudnestra.com/prorcp/{hash}
   └─> Extract encoded div content

4. Static decode → HLS stream URL`}</code></pre>
            </div>

            <h3>Encoding Formats Detected</h3>
            <p>VidSrc uses multiple encoding formats. Our static decoders handle all of them:</p>
            
            <div className="code-block">
              <div className="code-header"><span>HEX Format (Primary - December 2025)</span></div>
              <pre><code>{`// Algorithm: Reverse → Subtract 1 from each char → Hex decode
function decodeHexFormat(encoded) {
  // Step 1: Reverse the string
  const reversed = encoded.split('').reverse().join('');
  
  // Step 2: Subtract 1 from each character code
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  
  // Step 3: Remove non-hex characters (like colons)
  const hexClean = adjusted.replace(/[^0-9a-fA-F]/g, '');
  
  // Step 4: Convert hex pairs to ASCII
  let decoded = '';
  for (let i = 0; i < hexClean.length; i += 2) {
    decoded += String.fromCharCode(parseInt(hexClean.substr(i, 2), 16));
  }
  return decoded;
}`}</code></pre>
            </div>

            <div className="code-block">
              <div className="code-header"><span>ROT3 Format</span></div>
              <pre><code>{`// Content starts with "eqqmp://" (https with -3 shift)
// Shift letters FORWARD by 3 to decode
function decodeRot3(encoded) {
  let decoded = '';
  for (const char of encoded) {
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) { // lowercase
      decoded += String.fromCharCode(((code - 97 + 3) % 26) + 97);
    } else if (code >= 65 && code <= 90) { // uppercase
      decoded += String.fromCharCode(((code - 65 + 3) % 26) + 65);
    } else {
      decoded += char; // Numbers NOT shifted!
    }
  }
  return decoded;
}`}</code></pre>
            </div>

            <div className="code-block">
              <div className="code-header"><span>Reversed Base64 Format</span></div>
              <pre><code>{`// Content starts with "==" (reversed padding)
// Algorithm: Reverse → Base64 decode → Subtract shift
function decodeBase64Format(encoded, shift = 3) {
  let data = encoded.startsWith('=') ? encoded.substring(1) : encoded;
  data = data.split('').reverse().join('');
  data = data.replace(/-/g, '+').replace(/_/g, '/');
  while (data.length % 4 !== 0) data += '=';
  
  const decoded = atob(data);
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) - shift);
  }
  return result;
}`}</code></pre>
            </div>

            <div className="code-block">
              <div className="code-header"><span>PlayerJS Format (Custom Base64)</span></div>
              <pre><code>{`// Uses shuffled base64 alphabet
const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';

// #0 prefix: Direct custom base64 decode
// #1 prefix: Replace # with + first, then decode`}</code></pre>
            </div>

            <h3>Cloudflare Turnstile Bypass</h3>
            <p>
              Some requests trigger Cloudflare Turnstile. We support automatic solving via CapSolver API 
              (optional, ~$2-3 per 1000 solves). Set <code>CAPSOLVER_API_KEY</code> environment variable.
            </p>

            <h3>Security Note</h3>
            <p>
              VidSrc is <strong>disabled by default</strong> because the fallback dynamic decoder uses 
              <code>new Function()</code> to execute remote scripts. Enable with <code>ENABLE_VIDSRC_PROVIDER=true</code> 
              only if you accept this risk. Our static decoders avoid this for known formats.
            </p>
          </section>

          {/* Videasy */}
          <section id="videasy">
            <h2>Videasy - Multi-Language Extraction</h2>
            <div className="status-badge success">Working - 17 Servers, 8 Languages</div>
            
            <h3>Overview</h3>
            <p>
              Videasy provides excellent multi-language support with 17 servers across 8 languages. 
              Their API returns encrypted responses that we decrypt using an external service.
            </p>

            <h3>Available Servers</h3>
            <div className="code-block">
              <div className="code-header"><span>Server Configuration</span></div>
              <pre><code>{`// English Servers (Priority 1-8)
Neon      → myflixerzupcloud  (English)
Sage      → 1movies           (English)
Cypher    → moviebox          (English)
Yoru      → cdn               (English, MOVIE ONLY)
Reyna     → primewire         (English)
Omen      → onionplay         (English)
Breach    → m4uhd             (English)
Vyse      → hdmovie           (English)

// International Servers
Killjoy   → meine?language=german   (German)
Harbor    → meine?language=italian  (Italian)
Chamber   → meine?language=french   (French, MOVIE ONLY)
Gekko     → cuevana-latino          (Latin Spanish)
Kayo      → cuevana-spanish         (Spanish)
Raze      → superflix              (Portuguese)
Phoenix   → overflix               (Portuguese)
Astra     → visioncine             (Portuguese)`}</code></pre>
            </div>

            <h3>API Flow</h3>
            <div className="code-block">
              <div className="code-header"><span>Extraction Process</span></div>
              <pre><code>{`// 1. Build API URL
const url = \`https://api.videasy.net/{endpoint}/sources-with-title
  ?title={title}&mediaType={type}&year={year}&tmdbId={tmdbId}
  &seasonId={season}&episodeId={episode}\`;

// 2. Fetch encrypted response
const encrypted = await fetch(url).then(r => r.text());

// 3. Decrypt via external API
const decrypted = await fetch('https://enc-dec.app/api/dec-videasy', {
  method: 'POST',
  body: JSON.stringify({ text: encrypted, id: tmdbId })
}).then(r => r.json());

// 4. Extract stream URL
const streamUrl = decrypted.result.sources[0].url;`}</code></pre>
            </div>

            <h3>Episode Number Handling</h3>
            <p>
              Some shows (like One Piece) use absolute episode numbers on TMDB. Videasy expects 
              relative episode numbers within each season. We detect this and convert automatically:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Episode Conversion</span></div>
              <pre><code>{`// TMDB: Season 2, Episode 62 (absolute)
// Videasy expects: Season 2, Episode 1 (relative)

const firstEpisodeOfSeason = await getSeasonFirstEpisode(tmdbId, season);
if (firstEpisodeOfSeason > 1) {
  relativeEpisode = episode - firstEpisodeOfSeason + 1;
}`}</code></pre>
            </div>

            <h3>Rate Limiting</h3>
            <p>
              Videasy enforces rate limits. We implement exponential backoff with configurable delays:
            </p>
            <ul>
              <li>Minimum delay: 800ms between requests</li>
              <li>Maximum delay: 2000ms (with backoff)</li>
              <li>Backoff multiplier: 1.5x per consecutive failure</li>
              <li>Automatic retry on HTTP 429 with Retry-After header support</li>
            </ul>
          </section>


          {/* AnimeKai */}
          <section id="animekai">
            <h2>AnimeKai - Anime Specialist</h2>
            <div className="status-badge success">Working - Sub/Dub Support</div>
            
            <h3>Overview</h3>
            <p>
              AnimeKai is our dedicated anime provider, offering both subbed and dubbed versions 
              with proper episode mapping. The main challenges are ID mapping (TMDB → MAL/AniList) 
              and their MegaUp CDN which blocks datacenter IPs.
            </p>

            <h3>Complex Extraction Flow</h3>
            <div className="algorithm-flow">
              <div className="flow-step">
                <span className="step-num">1</span>
                <div>
                  <h4>ID Mapping</h4>
                  <p>Convert TMDB ID → MAL/AniList ID using ARM mapping API</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">2</span>
                <div>
                  <h4>Search AnimeKai</h4>
                  <p>Search database for anime, get <code>content_id</code> (kai_id)</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <div>
                  <h4>Get Episodes</h4>
                  <p>Encrypt content_id → fetch episodes list → parse HTML</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <div>
                  <h4>Get Servers</h4>
                  <p>Encrypt episode token → fetch servers (sub/dub) → parse HTML</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">5</span>
                <div>
                  <h4>Get Embed</h4>
                  <p>Encrypt server lid → fetch encrypted embed URL</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="step-num">6</span>
                <div>
                  <h4>Decrypt Stream</h4>
                  <p>Decrypt MegaUp embed → extract HLS stream URL</p>
                </div>
              </div>
            </div>

            <h3>Encryption/Decryption</h3>
            <p>
              AnimeKai uses custom encryption for all API parameters. We use the enc-dec.app service 
              for encryption and decryption:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Encryption API</span></div>
              <pre><code>{`// Encrypt for AnimeKai
const encrypted = await fetch(
  \`https://enc-dec.app/api/enc-kai?text=\${encodeURIComponent(text)}\`
).then(r => r.json());

// Decrypt from AnimeKai
const decrypted = await fetch('https://enc-dec.app/api/dec-kai', {
  method: 'POST',
  body: JSON.stringify({ text: encryptedText })
}).then(r => r.json());`}</code></pre>
            </div>

            <h3>MegaUp CDN Decryption</h3>
            <p>
              MegaUp embeds (<code>/e/{'{videoId}'}</code>) need special handling. The video data is 
              encrypted and requires the dec-mega API:
            </p>
            <div className="code-block">
              <div className="code-header"><span>MegaUp Decryption Flow</span></div>
              <pre><code>{`// 1. Extract video ID from embed URL
const [, baseUrl, videoId] = embedUrl.match(/^(https?:\\/\\/[^/]+)\\/e\\/([^/?#]+)/);

// 2. Fetch encrypted media data (via residential proxy!)
const mediaData = await fetch(\`\${baseUrl}/media/\${videoId}\`);

// 3. Decrypt with enc-dec.app
// CRITICAL: User-Agent must match what RPI proxy used!
const decrypted = await fetch('https://enc-dec.app/api/dec-mega', {
  method: 'POST',
  body: JSON.stringify({ 
    text: mediaData.result,
    agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...'
  })
});

// 4. Extract stream URL from decrypted response
const streamUrl = decrypted.result.sources[0].file;`}</code></pre>
            </div>

            <h3>Season/Episode Mapping Challenges</h3>
            <p>
              Anime naming is complex. TMDB&apos;s &quot;Bleach Season 2&quot; is &quot;Bleach: Thousand-Year Blood War&quot; 
              on AnimeKai. We handle this with multiple search strategies:
            </p>
            <ul>
              <li><strong>MAL ID lookup:</strong> Most reliable when available</li>
              <li><strong>Season name search:</strong> Use TMDB season name (e.g., &quot;Thousand-Year Blood War&quot;)</li>
              <li><strong>Title variants:</strong> Try &quot;Title II&quot;, &quot;Title Season 2&quot;, &quot;Title 2nd Season&quot;, etc.</li>
              <li><strong>Scoring algorithm:</strong> Rank results by title similarity, penalize &quot;Movie&quot;, &quot;OVA&quot;, etc.</li>
            </ul>

            <h3>CDN Blocking</h3>
            <p>
              MegaUp CDN blocks ALL datacenter IPs and requests with Origin headers. This affects:
            </p>
            <ul>
              <li>Cloudflare Workers</li>
              <li>AWS Lambda/EC2</li>
              <li>Vercel Edge Functions</li>
              <li>Any VPS or cloud provider</li>
              <li>Browser XHR (adds Origin header automatically)</li>
            </ul>
            <p>
              Solution: Route through Raspberry Pi on residential internet. See Proxy Architecture section.
            </p>
          </section>

          {/* Proxy Architecture */}
          <section id="proxy-architecture">
            <h2>Proxy Architecture</h2>
            <div className="status-badge success">Production Ready</div>
            
            <h3>The Problem</h3>
            <p>
              Multiple CDNs (MegaUp for AnimeKai, p.XXXXX.workers.dev for 1movies) block datacenter IPs. 
              They also reject requests with Origin headers (which browsers add automatically to XHR).
            </p>

            <h3>The Solution: Multi-Layer Proxy</h3>
            <div className="code-block">
              <div className="code-header"><span>Request Flow</span></div>
              <pre><code>{`Browser (XHR with Origin header)
    ↓
Vercel API Route (datacenter IP)
    ↓
Cloudflare Worker /animekai route (datacenter IP)
    ↓
Raspberry Pi Proxy (RESIDENTIAL IP, no Origin header)
    ↓
CDN (accepts residential IP without Origin)
    ↓
HLS Stream ← flows back through the chain`}</code></pre>
            </div>

            <h3>Cloudflare Worker Routes</h3>
            <div className="code-block">
              <div className="code-header"><span>Route Configuration</span></div>
              <pre><code>{`/stream   → Standard proxy with Referer header
            Used for: Videasy, VidSrc, most CDNs

/animekai → Forwards to RPI residential proxy
            Used for: AnimeKai (MegaUp), 1movies CDN
            Strips Origin header, uses residential IP`}</code></pre>
            </div>

            <h3>CDN Detection</h3>
            <div className="code-block">
              <div className="code-header"><span>proxy-config.ts</span></div>
              <pre><code>{`// MegaUp CDN (AnimeKai)
function isMegaUpCdnUrl(url) {
  return url.includes('megaup') || 
         url.includes('hub26link') || 
         url.includes('app28base') ||
         url.includes('code29wave') ||
         url.includes('pro25zone');
}

// 1movies CDN
function is1moviesCdnUrl(url) {
  if (url.includes('.workers.dev')) {
    if (url.match(/p\\.\\d+\\.workers\\.dev/)) return true;
  }
  return false;
}

// Route decision in maybeProxyUrl()
if (isAnimeKai || isMegaUpCdn || is1moviesCdn) {
  return getAnimeKaiProxyUrl(url); // → /animekai → RPI
} else {
  return getStreamProxyUrl(url);   // → /stream → direct
}`}</code></pre>
            </div>

            <h3>RPI Proxy Server</h3>
            <p>
              The Raspberry Pi runs a simple Node.js server exposed via Cloudflare Tunnel. 
              Key features:
            </p>
            <ul>
              <li><strong>No Origin/Referer headers:</strong> CDNs that block these get clean requests</li>
              <li><strong>Residential IP:</strong> Home internet connection passes IP checks</li>
              <li><strong>Response caching:</strong> Short TTL for m3u8, longer for segments</li>
              <li><strong>Rate limiting:</strong> Prevents abuse</li>
              <li><strong>API key auth:</strong> Only our Cloudflare Worker can use it</li>
            </ul>

            <h3>User-Agent Consistency</h3>
            <p className="warning-text">
              <strong>Critical:</strong> The User-Agent header must be identical across the entire chain. 
              MegaUp&apos;s decryption is tied to the User-Agent that fetched the encrypted data. If the 
              RPI proxy uses a different User-Agent than what we send to enc-dec.app, decryption fails.
            </p>
            <div className="code-block">
              <div className="code-header"><span>User-Agent Propagation</span></div>
              <pre><code>{`// Pass User-Agent to RPI proxy
const proxyUrl = \`\${baseUrl}/animekai?url=\${encodeURIComponent(targetUrl)}&ua=\${encodeURIComponent(userAgent)}\`;

// RPI proxy uses the same User-Agent for fetch
const options = {
  headers: {
    'User-Agent': customUserAgent || defaultUserAgent,
    // NO Origin or Referer headers!
  }
};`}</code></pre>
            </div>
          </section>


          {/* Common Techniques */}
          <section id="techniques">
            <h2>Common Obfuscation Techniques</h2>
            
            <h3>String Array Obfuscation</h3>
            <p>
              Most providers store strings in an array and access them via index. The array is 
              often rotated or encoded.
            </p>
            <div className="code-block">
              <div className="code-header"><span>Before Deobfuscation</span></div>
              <pre><code>{`const _0x1234 = ['aGVsbG8=', 'd29ybGQ='];
const a = atob(_0x1234[0]); // "hello"
const b = atob(_0x1234[1]); // "world"`}</code></pre>
            </div>

            <h3>Control Flow Flattening</h3>
            <p>
              Code is restructured into a switch statement inside a while loop, making it hard 
              to follow the execution flow.
            </p>
            <div className="code-block">
              <div className="code-header"><span>Flattened Control Flow</span></div>
              <pre><code>{`let state = 0;
while (true) {
  switch (state) {
    case 0: doA(); state = 3; break;
    case 1: return result;
    case 2: doC(); state = 1; break;
    case 3: doB(); state = 2; break;
  }
}`}</code></pre>
            </div>

            <h3>Dead Code Injection</h3>
            <p>
              Meaningless code is added to confuse analysis. Look for code that never executes 
              or variables that are never used.
            </p>

            <h3>Proxy Functions</h3>
            <p>
              Simple operations are wrapped in functions to hide their purpose:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Proxy Function Example</span></div>
              <pre><code>{`// Instead of: a + b
function _0xabc(x, y) { return x + y; }
const result = _0xabc(a, b);`}</code></pre>
            </div>

            <h3>Packed JavaScript (p,a,c,k,e,d)</h3>
            <p>
              Common in embed pages. The code is compressed using a custom base encoding:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Unpacking PACKED JS</span></div>
              <pre><code>{`// Packed format:
eval(function(p,a,c,k,e,d){...}('encoded',base,count,'keywords'.split('|')))

// Unpacking algorithm:
// 1. Extract: encoded string, base, count, keywords array
// 2. For each keyword index (count-1 to 0):
//    - Convert index to base-N string (unbaser)
//    - Replace all occurrences in encoded string
// 3. Result is the original JavaScript`}</code></pre>
            </div>

            <h3>XOR Encryption</h3>
            <p>
              Simple but effective. Each character is XORed with a key byte:
            </p>
            <div className="code-block">
              <div className="code-header"><span>XOR Pattern</span></div>
              <pre><code>{`// Encryption/Decryption (same operation)
function xor(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key[i % key.length]
    );
  }
  return result;
}`}</code></pre>
            </div>

            <h3>Custom Base64 Alphabets</h3>
            <p>
              Standard Base64 uses <code>A-Za-z0-9+/</code>. Providers often shuffle this alphabet 
              to break standard decoders:
            </p>
            <div className="code-block">
              <div className="code-header"><span>Custom Alphabet Detection</span></div>
              <pre><code>{`// Standard: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
// PlayerJS: ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/
//           (first 26 chars swapped with next 26)

// Detection: Look for base64-like strings that don't decode properly
// Solution: Find the alphabet in their decoder function`}</code></pre>
            </div>
          </section>

          {/* Tools */}
          <section id="tools">
            <h2>Tools & Methods</h2>
            
            <h3>Essential Tools</h3>
            <div className="tools-grid">
              <div className="tool-card">
                <h4>Browser DevTools</h4>
                <p>Network tab for request analysis, Sources for debugging, Console for testing. Set breakpoints on XHR/fetch.</p>
              </div>
              <div className="tool-card">
                <h4>de4js</h4>
                <p>Online JavaScript deobfuscator. Good starting point for most obfuscation. Handles string array rotation.</p>
              </div>
              <div className="tool-card">
                <h4>AST Explorer</h4>
                <p>Visualize JavaScript AST. Essential for understanding code structure and writing transforms.</p>
              </div>
              <div className="tool-card">
                <h4>CyberChef</h4>
                <p>Swiss army knife for encoding/decoding. Base64, XOR, AES, hex, everything. Chain operations together.</p>
              </div>
              <div className="tool-card">
                <h4>Burp Suite / mitmproxy</h4>
                <p>Intercept and modify HTTP traffic. See exactly what the browser sends and receives.</p>
              </div>
              <div className="tool-card">
                <h4>Node.js REPL</h4>
                <p>Quick testing of decoding functions. Copy their code, run it locally, compare outputs.</p>
              </div>
            </div>

            <h3>Methodology</h3>
            <ol>
              <li><strong>Capture Traffic:</strong> Use DevTools Network tab to see all requests. Filter by XHR/Fetch.</li>
              <li><strong>Identify API Calls:</strong> Find requests that return stream data or encrypted blobs.</li>
              <li><strong>Trace Parameters:</strong> Work backwards from API call to find how params are generated.</li>
              <li><strong>Extract Keys:</strong> Search for crypto functions (<code>createCipheriv</code>, <code>CryptoJS</code>), find their inputs.</li>
              <li><strong>Replicate:</strong> Build your own implementation, compare outputs byte-by-byte.</li>
              <li><strong>Test Headers:</strong> If requests fail, compare headers with browser requests. <code>X-Requested-With</code> is often required.</li>
              <li><strong>Check IP/Origin:</strong> If still failing, the CDN might block datacenter IPs or Origin headers.</li>
            </ol>

            <h3>Common Pitfalls</h3>
            <ul>
              <li><strong>Missing Headers:</strong> APIs often require <code>X-Requested-With: XMLHttpRequest</code></li>
              <li><strong>Timing Issues:</strong> Some tokens are time-based, ensure your clock is synced</li>
              <li><strong>Session State:</strong> Some sites require cookies from initial page load</li>
              <li><strong>IP Restrictions:</strong> CDNs may block datacenter IPs, need residential proxy</li>
              <li><strong>Origin Header:</strong> Browser XHR adds Origin automatically, some CDNs reject it</li>
              <li><strong>User-Agent Mismatch:</strong> Decryption may be tied to the User-Agent that fetched the data</li>
              <li><strong>Rate Limiting:</strong> Implement exponential backoff, respect Retry-After headers</li>
            </ul>

            <h3>Debugging Tips</h3>
            <div className="code-block">
              <div className="code-header"><span>Useful DevTools Snippets</span></div>
              <pre><code>{`// Break on all XHR/fetch requests
const origFetch = window.fetch;
window.fetch = function(...args) {
  debugger;
  return origFetch.apply(this, args);
};

// Log all postMessage events (iframe communication)
window.addEventListener('message', e => console.log('postMessage:', e.data));

// Find where a string is constructed
// Set conditional breakpoint: result.includes('m3u8')`}</code></pre>
            </div>
          </section>

          {/* Contributing */}
          <section id="contribute">
            <h2>Contributing</h2>
            <p>
              Found a new provider? Cracked an obfuscation we haven&apos;t documented? We&apos;d love 
              to hear about it.
            </p>
            
            <h3>What We&apos;re Looking For</h3>
            <ul>
              <li>New provider extraction methods</li>
              <li>Updates when providers change their obfuscation</li>
              <li>Better/cleaner implementations of existing extractors</li>
              <li>Documentation improvements</li>
              <li>CDN bypass techniques</li>
            </ul>

            <h3>Guidelines</h3>
            <ul>
              <li>No Puppeteer/browser automation - pure HTTP only</li>
              <li>Document your methodology, not just the code</li>
              <li>Include the keys/constants you extracted</li>
              <li>Test with multiple content IDs to ensure reliability</li>
              <li>Note any rate limits or IP restrictions</li>
            </ul>

            <div className="cta-box">
              <p>
                This documentation is part of the Flyx project. Check out the full 
                <Link href="/about"> About page</Link> for the complete story of how we built 
                an ethical streaming platform by reverse engineering the unethical ones.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
