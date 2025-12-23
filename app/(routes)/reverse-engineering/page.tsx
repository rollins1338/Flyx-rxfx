'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ReverseEngineering.module.css';

const sections = [
  { id: 'overview', title: 'Overview', icon: '🎯' },
  { id: 'philosophy', title: 'Philosophy', icon: '💭' },
  { id: 'dlhd', title: 'DLHD Live TV', icon: '📺' },
  { id: '111movies', title: '111movies', icon: '🎬' },
  { id: 'flixer', title: 'Flixer (WASM)', icon: '🔐' },
  { id: 'vidsrc', title: 'VidSrc', icon: '📡' },
  { id: 'videasy', title: 'Videasy', icon: '🌍' },
  { id: 'animekai', title: 'AnimeKai', icon: '🎌' },
  { id: 'proxy-architecture', title: 'Proxy Architecture', icon: '🔄' },
  { id: 'techniques', title: 'Techniques', icon: '🛠️' },
  { id: 'tools', title: 'Tools', icon: '🧰' },
  { id: 'contribute', title: 'Contributing', icon: '🤝' },
];

const providerStats = [
  { name: 'DLHD', status: 'working', type: 'Live TV', method: 'Bearer Token + Heartbeat' },
  { name: '111movies', status: 'working', type: 'Movies/TV', method: 'AES-256-CBC + XOR' },
  { name: 'Flixer', status: 'working', type: 'Movies/TV', method: 'WASM Bundling' },
  { name: 'VidSrc', status: 'working', type: 'Movies/TV', method: 'Static Decoders' },
  { name: 'Videasy', status: 'working', type: 'Multi-Lang', method: 'External API' },
  { name: 'AnimeKai', status: 'working', type: 'Anime', method: 'Residential Proxy' },
];

function CodeBlock({ title, code, id, copiedCode, onCopy }: { 
  title: string; 
  code: string; 
  id: string;
  copiedCode: string | null;
  onCopy: (code: string, id: string) => void;
}) {
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeTitle}>{title}</span>
        <button 
          onClick={() => onCopy(code, id)}
          className={`${styles.copyBtn} ${copiedCode === id ? styles.copied : ''}`}
        >
          {copiedCode === id ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className={styles.codeContent}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FlowStep({ num, title, description }: { num: number; title: string; description: string }) {
  return (
    <motion.div 
      className={styles.flowStep}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: num * 0.1 }}
    >
      <div className={styles.stepNum}>{num}</div>
      <div className={styles.stepContent}>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </motion.div>
  );
}

function ProviderCard({ name, type, method, delay }: { 
  name: string; 
  type: string; 
  method: string;
  delay: number;
}) {
  return (
    <motion.div 
      className={styles.providerCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -5 }}
    >
      <div className={styles.providerStatus}>
        <span className={styles.statusDot} />
        Working
      </div>
      <h3>{name}</h3>
      <div className={styles.providerMeta}>
        <span className={styles.providerType}>{type}</span>
        <span className={styles.providerMethod}>{method}</span>
      </div>
    </motion.div>
  );
}

export default function ReverseEngineeringPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [progress, setProgress] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  return (
    <div className={styles.page}>
      {/* Progress Bar */}
      <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      
      {/* Animated Background */}
      <div className={styles.bgEffects}>
        <div className={styles.bgOrb1} />
        <div className={styles.bgOrb2} />
        <div className={styles.bgOrb3} />
        <div className={styles.bgGrid} />
      </div>

      {/* Hero Section */}
      <header className={styles.hero}>
        <motion.div 
          className={styles.heroContent}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Link href="/about" className={styles.backLink}>
            <span>←</span> Back to About
          </Link>
          
          <motion.div 
            className={styles.badge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className={styles.badgeDot} />
            Technical Documentation • December 2025
          </motion.div>
          
          <h1 className={styles.heroTitle}>
            <span className={styles.titleGradient}>Reverse Engineering</span>
            <br />
            <span className={styles.titleSecondary}>Streaming Providers</span>
          </h1>
          
          <p className={styles.heroSubtitle}>
            A comprehensive guide to bypassing embed protections and extracting clean m3u8 streams 
            without ads, popups, or malware.
          </p>

          <motion.div 
            className={styles.warningBox}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className={styles.warningIcon}>⚠️</div>
            <div className={styles.warningContent}>
              <strong>Educational Purpose Only</strong>
              <p>
                This documentation demonstrates how streaming site protections work. 
                Use this knowledge responsibly.
              </p>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div 
            className={styles.quickStats}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className={styles.stat}>
              <span className={styles.statNum}>6</span>
              <span className={styles.statLabel}>Providers</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>100%</span>
              <span className={styles.statLabel}>Working</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>0</span>
              <span className={styles.statLabel}>Browser Automation</span>
            </div>
          </motion.div>
        </motion.div>
      </header>

      {/* Mobile Nav Toggle */}
      <button 
        className={styles.mobileNavToggle}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
      >
        <span className={styles.navIcon}>☰</span>
        <span>{sections.find(s => s.id === activeSection)?.title}</span>
        <span className={styles.navProgress}>{Math.round(progress)}%</span>
      </button>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div 
            className={styles.mobileNavOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.nav 
              className={styles.mobileNav}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.mobileNavHeader}>
                <span>Contents</span>
                <button onClick={() => setMobileNavOpen(false)}>✕</button>
              </div>
              {sections.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.mobileNavItem} ${activeSection === s.id ? styles.active : ''}`}
                  onClick={() => scrollToSection(s.id)}
                >
                  <span className={styles.navItemIcon}>{s.icon}</span>
                  {s.title}
                </button>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <div className={styles.layout}>
        {/* Desktop Sidebar */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            <div className={styles.sidebarHeader}>
              <span>Contents</span>
              <span className={styles.sidebarProgress}>{Math.round(progress)}%</span>
            </div>
            {sections.map((s, i) => (
              <button
                key={s.id}
                className={`${styles.navItem} ${activeSection === s.id ? styles.active : ''}`}
                onClick={() => scrollToSection(s.id)}
              >
                <span className={styles.navNum}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.navItemIcon}>{s.icon}</span>
                <span className={styles.navItemTitle}>{s.title}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className={styles.content} ref={contentRef}>

          {/* Overview Section */}
          <section id="overview" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🎯</span>
                Overview
              </h2>
              
              <p className={styles.lead}>
                Most &quot;free&quot; streaming sites wrap their content in layers of obfuscation, 
                aggressive advertising, and sometimes outright malware. But here&apos;s the thing: 
                the actual video streams are just standard HLS (m3u8) files.
              </p>
              
              <p>
                By reverse engineering these protections, we can extract the clean stream URLs and 
                play them in our own player—no ads, no popups, no cryptocurrency miners.
              </p>

              <div className={styles.providerGrid}>
                {providerStats.map((provider, i) => (
                  <ProviderCard key={provider.name} {...provider} delay={i * 0.1} />
                ))}
              </div>
            </motion.div>
          </section>

          {/* Philosophy Section */}
          <section id="philosophy" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>💭</span>
                Philosophy
              </h2>
              
              <h3>Why We Do This</h3>
              <p>
                The streaming sites we reverse engineer are not legitimate businesses. They profit 
                from content they don&apos;t own by wrapping it in exploitative monetization. We&apos;re 
                not stealing from creators—we&apos;re bypassing the middlemen who were already stealing.
              </p>
              
              <blockquote className={styles.quote}>
                <p>
                  &quot;We are not pirates. We are pirates who rob pirates. It&apos;s like being a 
                  vigilante, except instead of fighting crime we are fighting pop-up advertisements 
                  and cryptocurrency miners.&quot;
                </p>
              </blockquote>
              
              <h3>The Rules</h3>
              <div className={styles.rulesList}>
                <div className={styles.rule}>
                  <span className={styles.ruleIcon}>🚫</span>
                  <div>
                    <strong>No Puppeteer/Browser Automation</strong>
                    <p>Pure HTTP requests only. If we need a browser, we haven&apos;t cracked it properly.</p>
                  </div>
                </div>
                <div className={styles.rule}>
                  <span className={styles.ruleIcon}>🎬</span>
                  <div>
                    <strong>No Embedding Their Players</strong>
                    <p>Their players contain ads and tracking. We extract the stream and use our own player.</p>
                  </div>
                </div>
                <div className={styles.rule}>
                  <span className={styles.ruleIcon}>📝</span>
                  <div>
                    <strong>Document Everything</strong>
                    <p>Knowledge should be shared so others can build on it.</p>
                  </div>
                </div>
                <div className={styles.rule}>
                  <span className={styles.ruleIcon}>🔄</span>
                  <div>
                    <strong>Keep It Updated</strong>
                    <p>Providers change their obfuscation. We adapt.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* DLHD Section */}
          <section id="dlhd" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>📺</span>
                DLHD Live TV
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Fully Reverse Engineered - December 2025
              </div>
              
              <h3>Overview</h3>
              <p>
                DLHD (daddyhd.com) provides live TV streams using HLS with AES-128 encryption. The key 
                server initially appeared to block datacenter IPs, but reverse engineering their 
                obfuscated JavaScript player revealed the real protection: Bearer token authentication.
              </p>

              <h3>The Algorithm</h3>
              <div className={styles.flowContainer}>
                <FlowStep num={1} title="Get Server Key" description="Call server_lookup?channel_id=premium{channel} to get CDN server" />
                <FlowStep num={2} title="Fetch Auth Token" description="Get AUTH_TOKEN and CHANNEL_KEY from player page" />
                <FlowStep num={3} title="Establish Heartbeat Session" description="Call heartbeat endpoint with auth headers. Returns session expiry (~5 hours)" />
                <FlowStep num={4} title="Fetch M3U8 Playlist" description="Build URL: https://{server}new.kiko2.ru/{server}/premium{channel}/mono.css" />
                <FlowStep num={5} title="Fetch Key with Session" description="Request key with Authorization: Bearer {token} + X-Channel-Key headers" />
              </div>

              <h3>Token Extraction</h3>
              <CodeBlock 
                title="Token Extraction"
                id="dlhd-token"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// Fetch the player page
const playerUrl = \`https://epicplayplay.cfd/premiumtv/daddyhd.php?id=\${channel}\`;
const html = await fetch(playerUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 ...',
    'Referer': 'https://daddyhd.com/',
  }
}).then(r => r.text());

// Extract the auth token
const match = html.match(/AUTH_TOKEN\\s*=\\s*["']([^"']+)["']/);
const authToken = match[1];`}
              />

              <h3>Heartbeat Session (New in Dec 2025)</h3>
              <CodeBlock 
                title="Heartbeat Request"
                id="dlhd-heartbeat"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// Establish session before fetching keys
const heartbeatUrl = 'https://chevy.kiko2.ru/heartbeat';
const response = await fetch(heartbeatUrl, {
  method: 'GET',
  headers: {
    'Authorization': \`Bearer \${authToken}\`,
    'X-Channel-Key': channelKey,
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
  }
});

// Response: {"expiry":1765944911,"message":"Session created","status":"ok"}`}
              />

              <h3>Error Codes</h3>
              <div className={styles.errorCodes}>
                <div className={styles.errorCode}>
                  <span className={styles.errorBadge}>E2</span>
                  <div>
                    <code>&quot;Session must be created via heartbeat first&quot;</code>
                    <p>Call heartbeat endpoint before fetching keys</p>
                  </div>
                </div>
                <div className={styles.errorCode}>
                  <span className={styles.errorBadge}>E3</span>
                  <div>
                    <code>Token expired or invalid</code>
                    <p>Refresh auth token from player page</p>
                  </div>
                </div>
              </div>

              <blockquote className={styles.quote}>
                <p>
                  &quot;When requests fail from code but work in browser, don&apos;t assume IP blocking. 
                  Check what headers the browser is actually sending.&quot;
                </p>
                <cite>- Field Notes, December 2025</cite>
              </blockquote>
            </motion.div>
          </section>

          {/* 111movies Section */}
          <section id="111movies" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🎬</span>
                111movies (1movies)
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Fully Reverse Engineered - December 2025
              </div>
              
              <h3>Overview</h3>
              <p>
                111movies uses a Next.js frontend with a sophisticated encoding scheme to protect their 
                API endpoints. The encoding involves AES-256-CBC encryption, XOR obfuscation, and custom 
                alphabet substitution.
              </p>

              <h3>The Algorithm</h3>
              <div className={styles.flowContainer}>
                <FlowStep num={1} title="Extract Page Data" description="Fetch the page and extract __NEXT_DATA__.props.pageProps.data" />
                <FlowStep num={2} title="AES-256-CBC Encrypt" description="Encrypt the page data using static key and IV, output as hex string" />
                <FlowStep num={3} title="XOR Obfuscation" description="XOR each character with a 9-byte rotating key" />
                <FlowStep num={4} title="Base64 Encode" description="UTF-8 encode the XORed string, then Base64 with URL-safe characters" />
                <FlowStep num={5} title="Alphabet Substitution" description="Replace each character using a shuffled alphabet mapping" />
              </div>

              <h3>Extracted Keys</h3>
              <CodeBlock 
                title="AES Key (32 bytes)"
                id="111-aes"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`const AES_KEY = Buffer.from([
  3, 75, 207, 198, 39, 85, 65, 255,
  64, 89, 191, 251, 35, 214, 209, 210,
  62, 164, 155, 85, 247, 158, 167, 48,
  172, 84, 13, 18, 19, 166, 19, 57
]);`}
              />

              <CodeBlock 
                title="XOR Key (9 bytes)"
                id="111-xor"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`const XOR_KEY = Buffer.from([170, 162, 126, 126, 60, 255, 136, 130, 133]);`}
              />

              <CodeBlock 
                title="Alphabet Mapping"
                id="111-alphabet"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`const STANDARD = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";`}
              />

              <h3>CDN Proxy Requirement</h3>
              <p>
                The 1movies CDN (<code>p.XXXXX.workers.dev</code>) blocks datacenter IPs. Requests from 
                Cloudflare Workers, AWS, Vercel, etc. return 403. Solution: route through a residential 
                proxy.
              </p>
            </motion.div>
          </section>

          {/* Flixer Section */}
          <section id="flixer" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🔐</span>
                Flixer / Hexa - WASM Cracking
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Fully Reverse Engineered - December 21, 2025 (2 AM)
              </div>
              
              <h3>Overview</h3>
              <p>
                Flixer.sh represents the most sophisticated encryption we&apos;ve encountered. They use a 
                Rust-compiled WebAssembly module for key generation and AES-256-CTR encryption with HMAC 
                authentication. After a 12-hour reverse engineering session involving Ghidra, memory 
                forensics, and ~150 test scripts, we cracked it.
              </p>

              <h3>The Challenge</h3>
              <div className={styles.challengeGrid}>
                <div className={styles.challengeItem}>
                  <span className={styles.challengeIcon}>🔒</span>
                  <strong>WASM Encryption</strong>
                  <p>All API responses encrypted with AES-256-CTR</p>
                </div>
                <div className={styles.challengeItem}>
                  <span className={styles.challengeIcon}>🖥️</span>
                  <strong>Browser Fingerprinting</strong>
                  <p>Keys derived from screen, UA, timezone, canvas</p>
                </div>
                <div className={styles.challengeItem}>
                  <span className={styles.challengeIcon}>🔑</span>
                  <strong>Session Binding</strong>
                  <p>Each session generates unique 64-char hex key</p>
                </div>
                <div className={styles.challengeItem}>
                  <span className={styles.challengeIcon}>✅</span>
                  <strong>HMAC Authentication</strong>
                  <p>Requests require HMAC-SHA256 signatures</p>
                </div>
              </div>

              <h3>The WASM Binary</h3>
              <CodeBlock 
                title="WASM Analysis"
                id="flixer-wasm"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`File: img_data_bg.wasm
Size: 136,881 bytes
Functions: 377 total (52 imported, 325 defined)
Language: Compiled from Rust

Key Exports:
  get_img_key()                    → Returns 64-char hex session key
  process_img_data(encrypted, key) → Decrypts API responses

Rust Crates Identified (via Ghidra):
  - aes-0.8.4 (fixslice32.rs)     → AES-256 encryption
  - ctr-0.9.2 (ctr32.rs)          → CTR mode
  - hmac-0.12.1                    → HMAC authentication`}
              />

              <h3>The Breakthrough: WASM Bundling</h3>
              <p>
                Instead of cracking the algorithm, we bundle their WASM binary directly into our 
                Cloudflare Worker. The key insight: WASM runs anywhere that provides the expected 
                browser APIs. We mock those APIs server-side.
              </p>

              <CodeBlock 
                title="WASM Import Mocking"
                id="flixer-mock"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`const mockWindow = {
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
};`}
              />

              <h3>Critical Discovery: Header Blocking</h3>
              <CodeBlock 
                title="Headers That BLOCK Requests"
                id="flixer-headers"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// These headers cause Flixer to reject requests:

'bW90aGFmYWth': '1'     // Base64 for "mothafaka" - anti-scraping marker!
'Origin': '...'         // Browser adds this automatically
'sec-fetch-*': '...'    // Fetch metadata headers

// Solution: Don't send these headers from the Worker`}
              />

              <blockquote className={styles.quote}>
                <p>
                  &quot;Sometimes the best way to crack encryption is to not crack it at all. Just run 
                  their code in your environment with mocked inputs. If you can&apos;t beat the algorithm, 
                  become the algorithm.&quot;
                </p>
                <cite>- Field Notes, December 21, 2025, 2:00 AM</cite>
              </blockquote>
            </motion.div>
          </section>

          {/* VidSrc Section */}
          <section id="vidsrc" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>📡</span>
                VidSrc - Static Decoders
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Working - Primary Provider
              </div>
              
              <h3>Overview</h3>
              <p>
                VidSrc is our primary provider for movies and TV shows. We reverse engineered their 
                encoding schemes and implemented static decoders—no remote script execution required.
              </p>

              <h3>Encoding Formats</h3>
              <CodeBlock 
                title="HEX Format (Primary - December 2025)"
                id="vidsrc-hex"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// Algorithm: Reverse → Subtract 1 from each char → Hex decode
function decodeHexFormat(encoded) {
  // Step 1: Reverse the string
  const reversed = encoded.split('').reverse().join('');
  
  // Step 2: Subtract 1 from each character code
  let adjusted = '';
  for (let i = 0; i < reversed.length; i++) {
    adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  
  // Step 3: Remove non-hex characters
  const hexClean = adjusted.replace(/[^0-9a-fA-F]/g, '');
  
  // Step 4: Convert hex pairs to ASCII
  let decoded = '';
  for (let i = 0; i < hexClean.length; i += 2) {
    decoded += String.fromCharCode(parseInt(hexClean.substr(i, 2), 16));
  }
  return decoded;
}`}
              />

              <CodeBlock 
                title="ROT3 Format"
                id="vidsrc-rot3"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// Content starts with "eqqmp://" (https with -3 shift)
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
}`}
              />

              <div className={styles.warningNote}>
                <span>⚠️</span>
                <p>
                  VidSrc is <strong>disabled by default</strong> because the fallback dynamic decoder uses 
                  <code>new Function()</code> to execute remote scripts. Enable with <code>ENABLE_VIDSRC_PROVIDER=true</code>.
                </p>
              </div>
            </motion.div>
          </section>

          {/* Videasy Section */}
          <section id="videasy" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🌍</span>
                Videasy - Multi-Language
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Working - 17 Servers, 8 Languages
              </div>
              
              <h3>Available Servers</h3>
              <div className={styles.serverGrid}>
                <div className={styles.serverGroup}>
                  <h4>English Servers</h4>
                  <div className={styles.serverList}>
                    <span>Neon</span><span>Sage</span><span>Cypher</span><span>Yoru</span>
                    <span>Reyna</span><span>Omen</span><span>Breach</span><span>Vyse</span>
                  </div>
                </div>
                <div className={styles.serverGroup}>
                  <h4>International</h4>
                  <div className={styles.serverList}>
                    <span>🇩🇪 German</span><span>🇮🇹 Italian</span><span>🇫🇷 French</span>
                    <span>🇪🇸 Spanish</span><span>🇧🇷 Portuguese</span>
                  </div>
                </div>
              </div>

              <CodeBlock 
                title="API Flow"
                id="videasy-api"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// 1. Build API URL
const url = \`https://api.videasy.net/{endpoint}/sources-with-title
  ?title={title}&mediaType={type}&year={year}&tmdbId={tmdbId}\`;

// 2. Fetch encrypted response
const encrypted = await fetch(url).then(r => r.text());

// 3. Decrypt via external API
const decrypted = await fetch('https://enc-dec.app/api/dec-videasy', {
  method: 'POST',
  body: JSON.stringify({ text: encrypted, id: tmdbId })
}).then(r => r.json());

// 4. Extract stream URL
const streamUrl = decrypted.result.sources[0].url;`}
              />
            </motion.div>
          </section>

          {/* AnimeKai Section */}
          <section id="animekai" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🎌</span>
                AnimeKai - Anime Specialist
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Working - Sub/Dub Support
              </div>
              
              <h3>Complex Extraction Flow</h3>
              <div className={styles.flowContainer}>
                <FlowStep num={1} title="ID Mapping" description="Convert TMDB ID → MAL/AniList ID using ARM mapping API" />
                <FlowStep num={2} title="Search AnimeKai" description="Search database for anime, get content_id (kai_id)" />
                <FlowStep num={3} title="Get Episodes" description="Encrypt content_id → fetch episodes list → parse HTML" />
                <FlowStep num={4} title="Get Servers" description="Encrypt episode token → fetch servers (sub/dub)" />
                <FlowStep num={5} title="Get Embed" description="Encrypt server lid → fetch encrypted embed URL" />
                <FlowStep num={6} title="Decrypt Stream" description="Decrypt MegaUp embed → extract HLS stream URL" />
              </div>

              <h3>CDN Blocking</h3>
              <p>
                MegaUp CDN blocks ALL datacenter IPs and requests with Origin headers. This affects 
                Cloudflare Workers, AWS, Vercel, and any VPS. Solution: Route through Raspberry Pi 
                on residential internet.
              </p>
            </motion.div>
          </section>

          {/* Proxy Architecture Section */}
          <section id="proxy-architecture" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🔄</span>
                Proxy Architecture
              </h2>
              
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Production Ready
              </div>
              
              <h3>The Problem</h3>
              <p>
                Multiple CDNs block datacenter IPs. They also reject requests with Origin headers 
                (which browsers add automatically to XHR).
              </p>

              <h3>Multi-Layer Proxy Solution</h3>
              <div className={styles.architectureDiagram}>
                <div className={styles.archLayer}>
                  <span className={styles.archIcon}>🌐</span>
                  <span>Browser (XHR with Origin)</span>
                </div>
                <div className={styles.archArrow}>↓</div>
                <div className={styles.archLayer}>
                  <span className={styles.archIcon}>▲</span>
                  <span>Vercel API Route</span>
                </div>
                <div className={styles.archArrow}>↓</div>
                <div className={styles.archLayer}>
                  <span className={styles.archIcon}>☁️</span>
                  <span>Cloudflare Worker</span>
                </div>
                <div className={styles.archArrow}>↓</div>
                <div className={styles.archLayer + ' ' + styles.archHighlight}>
                  <span className={styles.archIcon}>🏠</span>
                  <span>Raspberry Pi (Residential IP)</span>
                </div>
                <div className={styles.archArrow}>↓</div>
                <div className={styles.archLayer}>
                  <span className={styles.archIcon}>📺</span>
                  <span>CDN → HLS Stream</span>
                </div>
              </div>

              <CodeBlock 
                title="CDN Detection"
                id="proxy-cdn"
                copiedCode={copiedCode}
                onCopy={copyCode}
                code={`// MegaUp CDN (AnimeKai)
function isMegaUpCdnUrl(url) {
  return url.includes('megaup') || 
         url.includes('hub26link') || 
         url.includes('app28base');
}

// 1movies CDN
function is1moviesCdnUrl(url) {
  return url.match(/p\\.\\d+\\.workers\\.dev/);
}

// Route decision
if (isAnimeKai || isMegaUpCdn || is1moviesCdn) {
  return getAnimeKaiProxyUrl(url); // → RPI
} else {
  return getStreamProxyUrl(url);   // → direct
}`}
              />
            </motion.div>
          </section>

          {/* Techniques Section */}
          <section id="techniques" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🛠️</span>
                Common Techniques
              </h2>
              
              <div className={styles.techniqueGrid}>
                <div className={styles.techniqueCard}>
                  <h4>String Array Obfuscation</h4>
                  <p>Strings stored in array, accessed via index. Array often rotated or encoded.</p>
                  <code>const a = atob(_0x1234[0]);</code>
                </div>
                <div className={styles.techniqueCard}>
                  <h4>Control Flow Flattening</h4>
                  <p>Code restructured into switch inside while loop, hard to follow execution.</p>
                  <code>while(true) switch(state) ...</code>
                </div>
                <div className={styles.techniqueCard}>
                  <h4>XOR Encryption</h4>
                  <p>Each character XORed with key byte. Simple but effective.</p>
                  <code>char ^ key[i % key.length]</code>
                </div>
                <div className={styles.techniqueCard}>
                  <h4>Custom Base64</h4>
                  <p>Standard alphabet shuffled to break decoders.</p>
                  <code>ABCDEFGHIJKLMabc... → shuffled</code>
                </div>
                <div className={styles.techniqueCard}>
                  <h4>Packed JavaScript</h4>
                  <p>Code compressed using custom base encoding (p,a,c,k,e,d).</p>
                  <code>eval(function(p,a,c,k,e,d)...)</code>
                </div>
                <div className={styles.techniqueCard}>
                  <h4>Proxy Functions</h4>
                  <p>Simple operations wrapped in functions to hide purpose.</p>
                  <code>_0xabc(a, b) → a + b</code>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Tools Section */}
          <section id="tools" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🧰</span>
                Tools & Methods
              </h2>
              
              <h3>Essential Tools</h3>
              <div className={styles.toolsGrid}>
                <div className={styles.toolCard}>
                  <div className={styles.toolIcon}>🔍</div>
                  <h4>Browser DevTools</h4>
                  <p>Network tab, Sources debugging, Console testing. Set breakpoints on XHR/fetch.</p>
                </div>
                <div className={styles.toolCard}>
                  <div className={styles.toolIcon}>🧹</div>
                  <h4>de4js</h4>
                  <p>Online JavaScript deobfuscator. Good starting point for most obfuscation.</p>
                </div>
                <div className={styles.toolCard}>
                  <div className={styles.toolIcon}>🌳</div>
                  <h4>AST Explorer</h4>
                  <p>Visualize JavaScript AST. Essential for understanding code structure.</p>
                </div>
                <div className={styles.toolCard}>
                  <div className={styles.toolIcon}>🍳</div>
                  <h4>CyberChef</h4>
                  <p>Swiss army knife for encoding/decoding. Base64, XOR, AES, hex, everything.</p>
                </div>
                <div className={styles.toolCard}>
                  <div className={styles.toolIcon}>🔌</div>
                  <h4>Burp Suite</h4>
                  <p>Intercept and modify HTTP traffic. See exactly what browser sends.</p>
                </div>
                <div className={styles.toolCard}>
                  <div className={styles.toolIcon}>💻</div>
                  <h4>Node.js REPL</h4>
                  <p>Quick testing of decoding functions. Copy their code, run locally.</p>
                </div>
              </div>

              <h3>Methodology</h3>
              <div className={styles.methodologyList}>
                <div className={styles.methodStep}>
                  <span>1</span>
                  <div>
                    <strong>Capture Traffic</strong>
                    <p>Use DevTools Network tab to see all requests. Filter by XHR/Fetch.</p>
                  </div>
                </div>
                <div className={styles.methodStep}>
                  <span>2</span>
                  <div>
                    <strong>Identify API Calls</strong>
                    <p>Find requests that return stream data or encrypted blobs.</p>
                  </div>
                </div>
                <div className={styles.methodStep}>
                  <span>3</span>
                  <div>
                    <strong>Trace Parameters</strong>
                    <p>Work backwards from API call to find how params are generated.</p>
                  </div>
                </div>
                <div className={styles.methodStep}>
                  <span>4</span>
                  <div>
                    <strong>Extract Keys</strong>
                    <p>Search for crypto functions, find their inputs.</p>
                  </div>
                </div>
                <div className={styles.methodStep}>
                  <span>5</span>
                  <div>
                    <strong>Replicate</strong>
                    <p>Build your own implementation, compare outputs byte-by-byte.</p>
                  </div>
                </div>
              </div>

              <h3>Common Pitfalls</h3>
              <div className={styles.pitfallsList}>
                <div className={styles.pitfall}>
                  <span className={styles.pitfallIcon}>⚠️</span>
                  <strong>Missing Headers</strong> - APIs often require <code>X-Requested-With: XMLHttpRequest</code>
                </div>
                <div className={styles.pitfall}>
                  <span className={styles.pitfallIcon}>⏰</span>
                  <strong>Timing Issues</strong> - Some tokens are time-based, ensure clock is synced
                </div>
                <div className={styles.pitfall}>
                  <span className={styles.pitfallIcon}>🌐</span>
                  <strong>IP Restrictions</strong> - CDNs may block datacenter IPs, need residential proxy
                </div>
                <div className={styles.pitfall}>
                  <span className={styles.pitfallIcon}>🔗</span>
                  <strong>Origin Header</strong> - Browser XHR adds Origin automatically, some CDNs reject it
                </div>
              </div>
            </motion.div>
          </section>

          {/* Contributing Section */}
          <section id="contribute" className={styles.section}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🤝</span>
                Contributing
              </h2>
              
              <p>
                Found a new provider? Cracked an obfuscation we haven&apos;t documented? We&apos;d love 
                to hear about it.
              </p>
              
              <h3>What We&apos;re Looking For</h3>
              <div className={styles.contributionList}>
                <div className={styles.contributionItem}>
                  <span>✨</span> New provider extraction methods
                </div>
                <div className={styles.contributionItem}>
                  <span>🔄</span> Updates when providers change their obfuscation
                </div>
                <div className={styles.contributionItem}>
                  <span>🧹</span> Better/cleaner implementations of existing extractors
                </div>
                <div className={styles.contributionItem}>
                  <span>📝</span> Documentation improvements
                </div>
                <div className={styles.contributionItem}>
                  <span>🔓</span> CDN bypass techniques
                </div>
              </div>

              <h3>Guidelines</h3>
              <div className={styles.guidelinesList}>
                <div className={styles.guideline}>
                  <span className={styles.guidelineIcon}>🚫</span>
                  No Puppeteer/browser automation - pure HTTP only
                </div>
                <div className={styles.guideline}>
                  <span className={styles.guidelineIcon}>📖</span>
                  Document your methodology, not just the code
                </div>
                <div className={styles.guideline}>
                  <span className={styles.guidelineIcon}>🔑</span>
                  Include the keys/constants you extracted
                </div>
                <div className={styles.guideline}>
                  <span className={styles.guidelineIcon}>🧪</span>
                  Test with multiple content IDs to ensure reliability
                </div>
              </div>

              <div className={styles.ctaBox}>
                <p>
                  This documentation is part of the Flyx project. Check out the full{' '}
                  <Link href="/about" className={styles.ctaLink}>About page</Link> for the complete 
                  story of how we built an ethical streaming platform by reverse engineering the 
                  unethical ones.
                </p>
              </div>
            </motion.div>
          </section>
        </main>
      </div>
    </div>
  );
}
