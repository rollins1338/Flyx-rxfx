'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Wifi, 
  Play, 
  Tv, 
  Radio, 
  Film, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Copy,
  ExternalLink,
  Upload,
  Star,
  Trash2,
  RotateCcw,
  Square,
  Zap,
  Server
} from 'lucide-react';
import type Hls from 'hls.js';
import type mpegts from 'mpegts.js';

// Proxy URLs for IPTV streams
// RPi proxy (residential IP) is preferred - bypasses datacenter IP blocking
// CF proxy is fallback but often gets 403'd by IPTV providers
const RPI_PROXY_URL = process.env.NEXT_PUBLIC_RPI_PROXY_URL;
const CF_PROXY_URL = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL || process.env.NEXT_PUBLIC_CF_PROXY_URL || 'https://media-proxy.vynx.workers.dev';
const RPI_PROXY_KEY = process.env.NEXT_PUBLIC_RPI_PROXY_KEY;

interface SavedAccount {
  portal: string;
  mac: string;
  channels: number;
  status: number | string;
  blocked: string | number;
  addedAt: string;
}

interface TestResult {
  success: boolean;
  token?: string;
  profile?: any;
  content?: { itv: number; radio: number; vod: number };
  error?: string;
}

interface Channel {
  id: string;
  name: string;
  number: number;
  cmd: string;
  logo?: string;
  tv_genre_id?: string;
}

interface Genre {
  id: string;
  title: string;
  alias?: string;
}

interface AutoCycleResult {
  portal: string;
  mac: string;
  success: boolean;
  canStream: boolean;
  channels: number;
  error?: string;
  testedAt: string;
}

export default function IPTVDebugPage() {
  const [portalUrl, setPortalUrl] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [rawStreamUrl, setRawStreamUrl] = useState<string | null>(null);
  const [streamDebug, setStreamDebug] = useState<any>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [autoCycleRunning, setAutoCycleRunning] = useState(false);
  const [autoCycleResults, setAutoCycleResults] = useState<AutoCycleResult[]>([]);
  const [autoCycleProgress, setAutoCycleProgress] = useState({ current: 0, total: 0, currentAccount: '' });
  const [testStreamDuringCycle, setTestStreamDuringCycle] = useState(false);
  const [debugSourcesResult, setDebugSourcesResult] = useState<any>(null);
  const [debugSourcesLoading, setDebugSourcesLoading] = useState(false);
  const [dlhdChannels, setDlhdChannels] = useState<{ id: string; name: string }[]>([]);
  const [filterByDlhd, setFilterByDlhd] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const autoCycleAbortRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved accounts from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('iptv-debug-accounts');
    if (saved) {
      try {
        setSavedAccounts(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Load DLHD channels for filtering
  useEffect(() => {
    const loadDlhdChannels = async () => {
      try {
        const res = await fetch('/api/livetv/channels?limit=1000');
        const data = await res.json();
        if (data.success && data.channels) {
          setDlhdChannels(data.channels.map((ch: any) => ({ 
            id: ch.streamId || ch.id, 
            name: ch.name 
          })));
        }
      } catch (err) {
        console.error('Failed to load DLHD channels:', err);
      }
    };
    loadDlhdChannels();
  }, []);

  // Save accounts to localStorage when they change
  useEffect(() => {
    if (savedAccounts.length > 0) {
      localStorage.setItem('iptv-debug-accounts', JSON.stringify(savedAccounts));
    }
  }, [savedAccounts]);

  // Import accounts from JSON file
  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const accounts = data.accounts || data;
        
        // Filter for usable accounts - prioritize having channels over status
        // Many open portals return status=0 but still work
        const usable = accounts
          .filter((acc: any) => {
            const notBlocked = acc.profile?.blocked !== '1' && acc.profile?.blocked !== 1;
            const hasChannels = (acc.content?.itv || 0) > 0;
            // Account is usable if it has channels and isn't blocked
            return acc.success && notBlocked && hasChannels;
          })
          .map((acc: any) => ({
            portal: acc.portal,
            mac: acc.mac,
            channels: acc.content?.itv || 0,
            status: acc.profile?.status,
            blocked: acc.profile?.blocked,
            addedAt: new Date().toISOString(),
          }))
          // Sort by channel count descending
          .sort((a: SavedAccount, b: SavedAccount) => b.channels - a.channels);

        if (usable.length > 0) {
          setSavedAccounts(prev => {
            // Merge, avoiding duplicates
            const existing = new Set(prev.map(a => `${a.portal}|${a.mac}`));
            const newAccounts = usable.filter((a: SavedAccount) => !existing.has(`${a.portal}|${a.mac}`));
            return [...prev, ...newAccounts];
          });
          alert(`Imported ${usable.length} usable accounts (not blocked, with channels). Sorted by channel count.`);
        } else {
          alert('No usable accounts found in file. Accounts must not be blocked and have channels (itv > 0).');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Load a saved account into the form
  const loadAccount = useCallback((account: SavedAccount) => {
    setPortalUrl(account.portal);
    setMacAddress(account.mac);
    // Reset state
    setTestResult(null);
    setGenres([]);
    setChannels([]);
    setStreamUrl(null);
  }, []);

  // Remove a saved account
  const removeAccount = useCallback((portal: string, mac: string) => {
    setSavedAccounts(prev => prev.filter(a => !(a.portal === portal && a.mac === mac)));
  }, []);

  // Save current account if it's usable
  const saveCurrentAccount = useCallback(() => {
    if (!testResult?.success || !portalUrl || !macAddress) return;
    
    const notBlocked = testResult.profile?.blocked !== '1' && testResult.profile?.blocked !== 1;
    const hasChannels = (testResult.content?.itv || 0) > 0;
    
    // Only require not blocked and has channels - status doesn't matter for open portals
    if (!notBlocked || !hasChannels) {
      alert('Cannot save: Account must not be blocked and have channels');
      return;
    }

    const newAccount: SavedAccount = {
      portal: portalUrl,
      mac: macAddress,
      channels: testResult.content?.itv || 0,
      status: testResult.profile?.status,
      blocked: testResult.profile?.blocked,
      addedAt: new Date().toISOString(),
    };

    setSavedAccounts(prev => {
      const exists = prev.some(a => a.portal === portalUrl && a.mac === macAddress);
      if (exists) return prev;
      return [...prev, newAccount];
    });
  }, [testResult, portalUrl, macAddress]);

  // Auto-cycle through accounts to test which ones can access streams
  const startAutoCycle = useCallback(async () => {
    if (savedAccounts.length === 0) {
      alert('No saved accounts to test');
      return;
    }

    setAutoCycleRunning(true);
    setAutoCycleResults([]);
    autoCycleAbortRef.current = false;
    setAutoCycleProgress({ current: 0, total: savedAccounts.length, currentAccount: '' });

    const results: AutoCycleResult[] = [];

    for (let i = 0; i < savedAccounts.length; i++) {
      if (autoCycleAbortRef.current) break;

      const account = savedAccounts[i];
      setAutoCycleProgress({ 
        current: i + 1, 
        total: savedAccounts.length, 
        currentAccount: `${account.mac} @ ${new URL(account.portal).hostname}` 
      });

      const result: AutoCycleResult = {
        portal: account.portal,
        mac: account.mac,
        success: false,
        canStream: false,
        channels: 0,
        testedAt: new Date().toISOString(),
      };

      try {
        // Test connection
        const response = await fetch('/api/admin/iptv-debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test', portalUrl: account.portal, macAddress: account.mac })
        });
        
        const data = await response.json();
        
        if (data.success && data.token) {
          result.success = true;
          result.channels = data.content?.itv || 0;
          
          // Optionally test stream access
          if (testStreamDuringCycle && result.channels > 0) {
            try {
              // Get first channel
              const channelsRes = await fetch('/api/admin/iptv-debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'channels', 
                  portalUrl: account.portal, 
                  macAddress: account.mac, 
                  token: data.token,
                  genre: '*',
                  page: 0
                })
              });
              const channelsData = await channelsRes.json();
              
              if (channelsData.success && channelsData.channels?.data?.length > 0) {
                const firstChannel = channelsData.channels.data[0];
                
                // Try to get stream URL
                const streamRes = await fetch('/api/admin/iptv-debug', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    action: 'stream', 
                    portalUrl: account.portal, 
                    macAddress: account.mac, 
                    token: data.token,
                    cmd: firstChannel.cmd
                  })
                });
                const streamData = await streamRes.json();
                
                if (streamData.success && streamData.streamUrl) {
                  result.canStream = true;
                }
              }
            } catch (streamErr) {
              // Stream test failed, but connection worked
            }
          } else if (!testStreamDuringCycle) {
            // If not testing streams, assume it can stream if connected
            result.canStream = result.channels > 0;
          }
        } else {
          result.error = data.error || 'Connection failed';
        }
      } catch (err: any) {
        result.error = err.message || 'Request failed';
      }

      results.push(result);
      setAutoCycleResults([...results]);

      // Small delay between tests to avoid rate limiting
      if (i < savedAccounts.length - 1 && !autoCycleAbortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setAutoCycleRunning(false);
  }, [savedAccounts, testStreamDuringCycle]);

  const stopAutoCycle = useCallback(() => {
    autoCycleAbortRef.current = true;
  }, []);

  // Setup player when stream URL changes
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    // Cleanup previous instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
    setPlayerError(null);

    const video = videoRef.current;
    
    // Check if this is an HLS stream (m3u8) or raw TS stream
    // Use rawStreamUrl for detection since streamUrl is the proxied URL
    const urlToCheck = rawStreamUrl || streamUrl;
    const isHLS = urlToCheck.includes('.m3u8') || urlToCheck.includes('m3u8');
    // Most IPTV Stalker streams are raw MPEG-TS, detect common patterns
    const isTS = urlToCheck.includes('extension=ts') || 
                 urlToCheck.endsWith('.ts') || 
                 urlToCheck.includes('live.php') || 
                 urlToCheck.includes('/play/') ||
                 urlToCheck.includes('/live/') ||
                 urlToCheck.includes('stream=') ||
                 // If not HLS and has typical IPTV URL patterns, assume TS
                 (!isHLS && (urlToCheck.includes('/c/') || urlToCheck.includes('token=')));
    
    console.log('[IPTV Debug] Stream type detection:', { isHLS, isTS, urlToCheck: urlToCheck.substring(0, 100) });

    // Dynamic import and setup
    const setupPlayer = async () => {
      if (isHLS) {
        // Dynamically import HLS.js
        const HlsModule = await import('hls.js');
        const Hls = HlsModule.default;
        
        if (Hls.isSupported()) {
          console.log('[IPTV Debug] Setting up HLS.js player with URL:', streamUrl.substring(0, 100));
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            xhrSetup: (xhr) => {
              xhr.withCredentials = false; // Don't send credentials to avoid CORS issues
            },
          });
          
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[IPTV Debug] HLS manifest parsed, starting playback');
            video.play().catch((e) => console.error('[IPTV Debug] Play failed:', e));
          });
          
          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.error('[IPTV Debug] HLS error:', data.type, data.details, data);
            setPlayerError(`HLS Error: ${data.type} - ${data.details}`);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('Network error, trying to recover...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('Media error, trying to recover...');
                  hls.recoverMediaError();
                  break;
                default:
                  console.log('Fatal error, destroying HLS instance');
                  hls.destroy();
                  break;
              }
            }
          });
          
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          video.src = streamUrl;
          video.play().catch(console.error);
        }
      } else if (isTS) {
        // Dynamically import mpegts.js
        const mpegtsModule = await import('mpegts.js');
        const mpegtsLib = mpegtsModule.default;
        
        if (mpegtsLib.isSupported()) {
          console.log('Using mpegts.js for TS stream');
          
          // Use RPi proxy (residential IP) if available, otherwise fall back to CF proxy
          // RPi proxy bypasses datacenter IP blocking that IPTV providers use
          const rawUrl = rawStreamUrl || streamUrl;
          let proxyUrl: string;
          
          // Build proxy URL with MAC for proper STB headers
          const proxyParams = new URLSearchParams({ url: rawUrl });
          if (macAddress) proxyParams.set('mac', macAddress);
          
          if (RPI_PROXY_URL) {
            if (RPI_PROXY_KEY) proxyParams.set('key', RPI_PROXY_KEY);
            proxyUrl = `${RPI_PROXY_URL}/iptv/stream?${proxyParams.toString()}`;
            console.log('mpegts using RPi proxy (residential IP):', proxyUrl.substring(0, 100));
          } else {
            // CF_PROXY_URL might have /tv suffix, strip it for /iptv routes
            const cfBase = CF_PROXY_URL.replace(/\/tv\/?$/, '').replace(/\/+$/, '');
            proxyUrl = `${cfBase}/iptv/stream?${proxyParams.toString()}`;
            console.log('mpegts using CF proxy (may get 403):', proxyUrl.substring(0, 100));
          }
          
          const player = mpegtsLib.createPlayer({
            type: 'mpegts',
            isLive: true,
            url: proxyUrl,
          }, {
            enableWorker: true,
            enableStashBuffer: true,
            stashInitialSize: 384 * 1024, // 384KB initial buffer
            liveBufferLatencyChasing: false, // Disable aggressive latency chasing
            liveBufferLatencyMaxLatency: 5.0, // Allow up to 5 seconds latency
            liveBufferLatencyMinRemain: 1.0, // Keep at least 1 second buffer
            lazyLoad: false,
            lazyLoadMaxDuration: 3 * 60, // 3 minutes
            lazyLoadRecoverDuration: 30,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 3 * 60,
            autoCleanupMinBackwardDuration: 2 * 60,
          });
          
          player.attachMediaElement(video);
          player.load();
          
          player.on(mpegtsLib.Events.ERROR, (errorType: string, errorDetail: string, info: any) => {
            console.error('mpegts error:', { errorType, errorDetail, info });
            if (errorDetail.includes('403') || errorDetail.includes('HttpStatusCodeInvalid')) {
              const hint = RPI_PROXY_URL 
                ? 'Portal may have blocked this IP. Try VLC with the URL below.'
                : 'Portal blocked datacenter IP (403). Configure RPI proxy or use VLC.';
              setPlayerError(hint);
            } else if (errorDetail.includes('SSL') || errorDetail.includes('fetch') || errorDetail.includes('Network')) {
              setPlayerError(`Network Error: ${errorDetail}. Try VLC.`);
            } else {
              setPlayerError(`MPEG-TS Error: ${errorType} - ${errorDetail}`);
            }
          });
          
          player.on(mpegtsLib.Events.LOADING_COMPLETE, () => {
            console.log('mpegts loading complete');
          });

          player.on(mpegtsLib.Events.MEDIA_INFO, (info: any) => {
            console.log('mpegts media info:', info);
          });

          player.on(mpegtsLib.Events.STATISTICS_INFO, (stats: any) => {
            console.log('mpegts stats:', stats);
          });
          
          video.play().catch((err) => {
            console.error('Play failed:', err);
            setPlayerError(`Play failed: ${err.message}`);
          });
          
          mpegtsRef.current = player;
        } else {
          setPlayerError('Browser does not support MPEG-TS playback. Use VLC instead.');
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = streamUrl;
        video.play().catch(console.error);
      } else {
        // Fallback - try mpegts.js for unknown stream types (most IPTV streams are TS)
        console.log('Unknown stream type, trying mpegts.js as fallback');
        
        const mpegtsModule = await import('mpegts.js');
        const mpegtsLib = mpegtsModule.default;
        
        if (mpegtsLib.isSupported()) {
          // Use RPi proxy for residential IP
          const rawUrl = rawStreamUrl || streamUrl;
          let proxyUrl: string;
          
          const proxyParams = new URLSearchParams({ url: rawUrl });
          if (macAddress) proxyParams.set('mac', macAddress);
          
          if (RPI_PROXY_URL) {
            if (RPI_PROXY_KEY) proxyParams.set('key', RPI_PROXY_KEY);
            proxyUrl = `${RPI_PROXY_URL}/iptv/stream?${proxyParams.toString()}`;
            console.log('Fallback mpegts using RPi proxy:', proxyUrl.substring(0, 100));
          } else {
            // CF_PROXY_URL might have /tv suffix, strip it for /iptv routes
            const cfBase = CF_PROXY_URL.replace(/\/tv\/?$/, '').replace(/\/+$/, '');
            proxyUrl = `${cfBase}/iptv/stream?${proxyParams.toString()}`;
            console.log('Fallback mpegts using CF proxy:', proxyUrl.substring(0, 100));
          }
          
          const player = mpegtsLib.createPlayer({
            type: 'mpegts',
            isLive: true,
            url: proxyUrl,
          }, {
            enableWorker: true,
            enableStashBuffer: true,
            stashInitialSize: 384 * 1024,
          });
          
          player.attachMediaElement(video);
          player.load();
          
          player.on(mpegtsLib.Events.ERROR, (errorType: string, errorDetail: string) => {
            console.error('Fallback mpegts error:', { errorType, errorDetail });
            setPlayerError(`Stream Error: ${errorType} - ${errorDetail}. Try VLC.`);
          });
          
          video.play().catch((err) => {
            console.error('Fallback play failed:', err);
            setPlayerError(`Play failed: ${err.message}. Use VLC.`);
          });
          
          mpegtsRef.current = player;
        } else {
          setPlayerError('Browser does not support this stream format. Use VLC instead.');
        }
      }
    };

    setupPlayer().catch((err) => {
      console.error('[IPTV Debug] Failed to setup player:', err);
      setPlayerError(`Failed to load player: ${err?.message || String(err)}`);
    });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
    };
  }, [streamUrl, rawStreamUrl, macAddress]);

  // Load ALL channels at once - fetches from all pages
  const loadAllChannels = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride || testResult?.token;
    if (!token) return;
    
    setLoadingChannels(true);
    setChannels([]);
    
    try {
      const response = await fetch('/api/admin/iptv-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'all_channels', 
          portalUrl, 
          macAddress, 
          token
        })
      });
      
      const data = await response.json();
      console.log('All channels response:', data);
      if (data.success) {
        setChannels(data.channels || []);
        setTotalChannels(data.total || 0);
      } else {
        console.error('Failed to load all channels:', data);
      }
    } catch (error) {
      console.error('Failed to load all channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  }, [testResult?.token, portalUrl, macAddress]);

  const testConnection = useCallback(async () => {
    if (!portalUrl || !macAddress) return;
    
    setLoading(true);
    setTestResult(null);
    setGenres([]);
    setChannels([]);
    setStreamUrl(null);
    
    try {
      const response = await fetch('/api/admin/iptv-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', portalUrl, macAddress })
      });
      
      const data = await response.json();
      setTestResult(data);
      
      if (data.success && data.token) {
        // Load genres
        const genresRes = await fetch('/api/admin/iptv-debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'genres', portalUrl, macAddress, token: data.token })
        });
        const genresData = await genresRes.json();
        if (genresData.success) {
          setGenres(genresData.genres || []);
        }
        
        // Auto-load ALL channels at once (not paginated)
        await loadAllChannels(data.token);
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  }, [portalUrl, macAddress, loadAllChannels]);

  const getStream = useCallback(async (channel: Channel) => {
    if (!testResult?.token) return;
    
    setLoadingStream(true);
    setSelectedChannel(channel);
    setStreamUrl(null);
    setRawStreamUrl(null);
    setStreamDebug(null);
    
    try {
      const response = await fetch('/api/admin/iptv-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'stream', 
          portalUrl, 
          macAddress, 
          token: testResult.token,
          cmd: channel.cmd
        })
      });
      
      const data = await response.json();
      // Include the channel cmd in debug info
      setStreamDebug({ ...data, channelCmd: channel.cmd, channelName: channel.name });
      
      if (data.success && data.streamUrl) {
        const url = data.streamUrl;
        
        // Save raw URL for display/copy
        setRawStreamUrl(url);
        
        // Create proxied URL through our API
        const proxiedUrl = `/api/admin/iptv-debug/stream?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(macAddress)}&token=${encodeURIComponent(testResult.token)}`;
        console.log('[IPTV Debug] Setting stream URL:', proxiedUrl.substring(0, 100));
        setStreamUrl(proxiedUrl);
      } else {
        console.error('[IPTV Debug] No stream URL returned:', data);
        setStreamDebug({ ...data, error: data.error || 'No stream URL returned' });
      }
    } catch (error) {
      console.error('[IPTV Debug] Failed to get stream:', error);
      setStreamDebug({ error: String(error) });
    } finally {
      setLoadingStream(false);
    }
  }, [testResult?.token, portalUrl, macAddress]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Get stream URL via Cloudflare proxy (direct, no RPi)
  // This tests if CF can access the portal directly now that free tier limits are resolved
  const getStreamViaCF = useCallback(async (channel: Channel) => {
    if (!portalUrl || !macAddress) return;
    
    setLoadingStream(true);
    setSelectedChannel(channel);
    setStreamUrl(null);
    setRawStreamUrl(null);
    setStreamDebug(null);
    
    try {
      // Normalize portal URL
      let baseUrl = portalUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'http://' + baseUrl;
      }
      baseUrl = baseUrl.replace(/\/+$/, '');
      if (baseUrl.endsWith('/c')) baseUrl = baseUrl.slice(0, -2);
      
      // Step 1: Get token via CF proxy (handshake)
      const handshakeUrl = new URL('/portal.php', baseUrl);
      handshakeUrl.searchParams.set('type', 'stb');
      handshakeUrl.searchParams.set('action', 'handshake');
      handshakeUrl.searchParams.set('token', '');
      handshakeUrl.searchParams.set('JsHttpRequest', '1-xml');
      
      const cfBaseUrl = CF_PROXY_URL.replace(/\/tv\/?$/, '').replace(/\/+$/, '');
      
      console.log('[CF Stream] Step 1: Getting token via CF proxy');
      const tokenParams = new URLSearchParams({ url: handshakeUrl.toString(), mac: macAddress });
      const tokenRes = await fetch(`${cfBaseUrl}/iptv/api?${tokenParams.toString()}`);
      const tokenText = await tokenRes.text();
      const tokenClean = tokenText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
      const tokenData = JSON.parse(tokenClean);
      
      if (!tokenData?.js?.token) {
        throw new Error('Failed to get token from CF proxy');
      }
      
      const cfToken = tokenData.js.token;
      console.log('[CF Stream] Got token:', cfToken.substring(0, 20) + '...');
      
      // Step 2: Get stream URL via CF proxy (create_link)
      const createLinkUrl = new URL('/portal.php', baseUrl);
      createLinkUrl.searchParams.set('type', 'itv');
      createLinkUrl.searchParams.set('action', 'create_link');
      createLinkUrl.searchParams.set('cmd', channel.cmd);
      createLinkUrl.searchParams.set('series', '');
      createLinkUrl.searchParams.set('forced_storage', 'undefined');
      createLinkUrl.searchParams.set('disable_ad', '0');
      createLinkUrl.searchParams.set('download', '0');
      createLinkUrl.searchParams.set('JsHttpRequest', '1-xml');
      
      console.log('[CF Stream] Step 2: Getting stream URL via CF proxy');
      const streamParams = new URLSearchParams({ 
        url: createLinkUrl.toString(), 
        mac: macAddress,
        token: cfToken
      });
      const streamRes = await fetch(`${cfBaseUrl}/iptv/api?${streamParams.toString()}`);
      const streamText = await streamRes.text();
      const streamClean = streamText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
      const streamData = JSON.parse(streamClean);
      
      // Extract URL from ffmpeg command format
      let streamUrl = streamData?.js?.cmd || null;
      if (streamUrl) {
        const prefixes = ['ffmpeg ', 'ffrt ', 'ffrt2 ', 'ffrt3 ', 'ffrt4 '];
        for (const prefix of prefixes) {
          if (streamUrl.startsWith(prefix)) {
            streamUrl = streamUrl.substring(prefix.length);
            break;
          }
        }
        streamUrl = streamUrl.trim();
      }
      
      const usedMethod = streamRes.headers.get('X-Used-Method') || 'unknown';
      
      setStreamDebug({ 
        success: !!streamUrl,
        streamUrl,
        channelCmd: channel.cmd, 
        channelName: channel.name,
        cfToken: cfToken.substring(0, 20) + '...',
        usedMethod,
        rawResponse: streamData,
        note: 'Stream obtained via Cloudflare proxy (direct)'
      });
      
      if (streamUrl) {
        // Save raw URL for display/copy
        setRawStreamUrl(streamUrl);
        
        // Create proxied URL through CF worker for playback
        const playbackParams = new URLSearchParams({ url: streamUrl, mac: macAddress });
        const proxiedUrl = `${cfBaseUrl}/iptv/stream?${playbackParams.toString()}`;
        console.log('[CF Stream] Setting proxied stream URL:', proxiedUrl.substring(0, 100));
        setStreamUrl(proxiedUrl);
      } else {
        console.error('[CF Stream] No stream URL returned:', streamData);
        setStreamDebug((prev: any) => ({ ...prev, error: 'No stream URL in response' }));
      }
    } catch (error) {
      console.error('[CF Stream] Failed:', error);
      setStreamDebug({ error: String(error), note: 'CF stream test failed' });
    } finally {
      setLoadingStream(false);
    }
  }, [portalUrl, macAddress]);

  // Debug which IP sources work for this portal
  const debugSources = useCallback(async () => {
    if (!portalUrl || !macAddress) return;
    
    setDebugSourcesLoading(true);
    setDebugSourcesResult(null);
    
    try {
      const response = await fetch('/api/admin/iptv-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'debug_sources', 
          portalUrl, 
          macAddress 
        })
      });
      
      const data = await response.json();
      setDebugSourcesResult(data);
    } catch (error) {
      setDebugSourcesResult({ error: String(error) });
    } finally {
      setDebugSourcesLoading(false);
    }
  }, [portalUrl, macAddress]);

  // Test client IP forwarding mode - makes CF worker forward YOUR IP to the portal
  // If this works, the token is bound to YOUR IP and you can stream directly!
  const testClientIpMode = useCallback(async () => {
    if (!portalUrl || !macAddress) return;
    
    setDebugSourcesLoading(true);
    
    // Normalize portal URL
    let baseUrl = portalUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'http://' + baseUrl;
    }
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (baseUrl.endsWith('/c')) baseUrl = baseUrl.slice(0, -2);
    
    // Build handshake URL
    const handshakeUrl = new URL('/portal.php', baseUrl);
    handshakeUrl.searchParams.set('type', 'stb');
    handshakeUrl.searchParams.set('action', 'handshake');
    handshakeUrl.searchParams.set('token', '');
    handshakeUrl.searchParams.set('JsHttpRequest', '1-xml');
    
    const testUrl = handshakeUrl.toString();
    
    try {
      // Test through CF worker with forward_ip=true
      // CF_PROXY_URL might have /tv suffix, we need base URL for /iptv/api
      let cfBaseUrl = CF_PROXY_URL.replace(/\/tv\/?$/, '').replace(/\/+$/, '');
      
      const cfParams = new URLSearchParams({ 
        url: testUrl, 
        mac: macAddress, 
        forward_ip: 'true'  // This tells CF worker to forward our IP!
      });
      const cfFullUrl = `${cfBaseUrl}/iptv/api?${cfParams.toString()}`;
      
      console.log('[Client IP Test] Testing:', cfFullUrl.substring(0, 100));
      
      const startTime = Date.now();
      const cfRes = await fetch(cfFullUrl);
      const cfText = await cfRes.text();
      const latency = Date.now() - startTime;
      
      console.log('[Client IP Test] Response:', cfRes.status, cfText.substring(0, 200));
      
      // Parse response
      const cfClean = cfText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
      let cfData;
      try { cfData = JSON.parse(cfClean); } catch { cfData = null; }
      
      const usedMethod = cfRes.headers.get('X-Used-Method');
      
      if (cfRes.ok && cfData?.js?.token) {
        setDebugSourcesResult({
          success: true,
          results: {
            clientIpMode: {
              source: 'CF Worker (Client IP Forwarding)',
              status: cfRes.status,
              success: true,
              token: cfData.js.token.substring(0, 20) + '...',
              latency,
              usedMethod,
              hint: '🎉 Token is bound to YOUR IP! You can stream directly without proxy!',
            }
          },
          summary: {
            recommendation: 'Client IP forwarding works! The token is bound to your IP. Try streaming directly.',
            note: 'If streaming works, this is the best mode - no proxy bandwidth costs!',
          },
          testUrl,
        });
      } else {
        setDebugSourcesResult({
          success: false,
          results: {
            clientIpMode: {
              source: 'CF Worker (Client IP Forwarding)',
              status: cfRes.status,
              success: false,
              latency,
              usedMethod,
              error: !cfRes.ok ? `HTTP ${cfRes.status}` : 'No token in response',
              rawResponse: cfText.substring(0, 300),
              hint: 'Portal may not respect X-Forwarded-For headers. Try RPi proxy instead.',
            }
          },
          summary: {
            recommendation: 'Client IP forwarding failed. Portal ignores forwarded IP headers.',
          },
          testUrl,
        });
      }
    } catch (error) {
      setDebugSourcesResult({ 
        error: String(error),
        summary: { recommendation: 'Test failed - check CF worker URL' }
      });
    } finally {
      setDebugSourcesLoading(false);
    }
  }, [portalUrl, macAddress]);

  return (
    <div>
      <div style={{
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h2 style={{
          margin: 0,
          color: '#f8fafc',
          fontSize: '24px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Tv size={28} />
          IPTV Stalker Debug
        </h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>
          Test and debug STB portal connections
        </p>
      </div>

      {/* Connection Form */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{ color: '#f8fafc', margin: '0 0 20px 0', fontSize: '16px' }}>
          Portal Connection
        </h3>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
              Portal URL
            </label>
            <input
              type="text"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="http://example.com/c"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
              MAC Address
            </label>
            <input
              type="text"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              placeholder="00:1A:79:XX:XX:XX"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button
              onClick={testConnection}
              disabled={loading || !portalUrl || !macAddress}
              style={{
                padding: '12px 24px',
                background: loading ? 'rgba(120, 119, 198, 0.3)' : 'linear-gradient(135deg, #7877c6 0%, #9333ea 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={18} />}
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={debugSources}
              disabled={debugSourcesLoading || !portalUrl || !macAddress}
              style={{
                padding: '12px 16px',
                background: debugSourcesLoading ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.2)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                color: '#fbbf24',
                fontSize: '14px',
                fontWeight: '600',
                cursor: debugSourcesLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title="Test which IP sources (Vercel, Cloudflare, RPi) can connect to this portal"
            >
              {debugSourcesLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Server size={18} />}
              Debug Sources
            </button>
            <button
              onClick={testClientIpMode}
              disabled={debugSourcesLoading || !portalUrl || !macAddress}
              style={{
                padding: '12px 16px',
                background: debugSourcesLoading ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                color: '#22c55e',
                fontSize: '14px',
                fontWeight: '600',
                cursor: debugSourcesLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title="Test if portal respects X-Forwarded-For - if yes, token binds to YOUR IP!"
            >
              {debugSourcesLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={18} />}
              Test Client IP
            </button>
          </div>
        </div>
      </div>

      {/* Debug Sources Results */}
      {debugSourcesResult && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(251, 191, 36, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#fbbf24', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} />
              IP Source Debug Results
            </h3>
            <button
              onClick={() => setDebugSourcesResult(null)}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ×
            </button>
          </div>
          
          {debugSourcesResult.summary && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#f8fafc',
              fontSize: '14px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Recommendation:</strong> {debugSourcesResult.summary.recommendation}
              </div>
              {debugSourcesResult.summary.note && (
                <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                  ⚠️ {debugSourcesResult.summary.note}
                </div>
              )}
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {debugSourcesResult.results && Object.entries(debugSourcesResult.results).map(([key, result]: [string, any]) => (
              <div 
                key={key}
                style={{
                  background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${result.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '8px',
                  padding: '12px 16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '13px' }}>{result.source}</span>
                  <span style={{ 
                    color: result.success ? '#22c55e' : '#ef4444',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {result.success ? '✓ Works' : '✗ Blocked'}
                  </span>
                </div>
                {result.status && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                    HTTP Status: {result.status}
                  </div>
                )}
                {result.latency && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                    Latency: {result.latency}ms
                  </div>
                )}
                {result.error && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '4px' }}>
                    Error: {result.error}
                  </div>
                )}
                {result.token && (
                  <div style={{ color: '#22c55e', fontSize: '11px', fontFamily: 'monospace', marginBottom: '4px' }}>
                    Token: {result.token}
                  </div>
                )}
                {result.usedRpi !== undefined && (
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>
                    Used RPi: {result.usedRpi ? 'Yes' : 'No (direct)'}
                  </div>
                )}
                {result.rpiHealthy !== undefined && (
                  <div style={{ color: result.rpiHealthy ? '#22c55e' : '#ef4444', fontSize: '11px', marginBottom: '4px' }}>
                    RPi Health: {result.rpiHealthy ? '✓ Reachable' : '✗ Unreachable'}
                  </div>
                )}
                {result.hint && (
                  <div style={{ color: '#fbbf24', fontSize: '11px', marginBottom: '4px' }}>
                    💡 {result.hint}
                  </div>
                )}
                {result.rawResponse && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ color: '#64748b', fontSize: '11px', cursor: 'pointer' }}>
                      Raw Response
                    </summary>
                    <pre style={{ 
                      color: '#94a3b8', 
                      fontSize: '10px', 
                      fontFamily: 'monospace',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '8px',
                      borderRadius: '4px',
                      marginTop: '4px',
                      overflow: 'auto',
                      maxHeight: '100px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {result.rawResponse}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Accounts */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} />
            Saved Accounts ({savedAccounts.length})
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 16px',
                background: 'rgba(120, 119, 198, 0.2)',
                border: '1px solid rgba(120, 119, 198, 0.3)',
                borderRadius: '8px',
                color: '#7877c6',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Upload size={14} /> Import JSON
            </button>
            {testResult?.success && (testResult.content?.itv || 0) > 0 && (
              <button
                onClick={saveCurrentAccount}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px',
                  color: '#22c55e',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Star size={14} /> Save Current
              </button>
            )}
          </div>
        </div>

        {/* Auto-Cycle Controls */}
        {savedAccounts.length > 0 && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Zap size={18} color="#fbbf24" />
                <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>Auto-Cycle Test</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={testStreamDuringCycle}
                    onChange={(e) => setTestStreamDuringCycle(e.target.checked)}
                    disabled={autoCycleRunning}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>Test stream access</span>
                </label>
                
                {!autoCycleRunning ? (
                  <button
                    onClick={startAutoCycle}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#000',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RotateCcw size={14} /> Start Cycle Test
                  </button>
                ) : (
                  <button
                    onClick={stopAutoCycle}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(239, 68, 68, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Square size={14} /> Stop
                  </button>
                )}
              </div>
            </div>
            
            {/* Progress */}
            {autoCycleRunning && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Loader2 size={14} color="#fbbf24" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: '#fbbf24', fontSize: '13px' }}>
                    Testing {autoCycleProgress.current}/{autoCycleProgress.total}: {autoCycleProgress.currentAccount}
                  </span>
                </div>
                <div style={{
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(autoCycleProgress.current / autoCycleProgress.total) * 100}%`,
                    background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
            
            {/* Results Summary */}
            {autoCycleResults.length > 0 && !autoCycleRunning && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} color="#22c55e" />
                  <span style={{ color: '#22c55e', fontSize: '13px' }}>
                    {autoCycleResults.filter(r => r.canStream).length} working
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontSize: '13px' }}>
                    {autoCycleResults.filter(r => r.success && !r.canStream).length} connected (no stream)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} color="#ef4444" />
                  <span style={{ color: '#ef4444', fontSize: '13px' }}>
                    {autoCycleResults.filter(r => !r.success).length} failed
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auto-Cycle Results */}
        {autoCycleResults.length > 0 && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>Test Results</span>
              <button
                onClick={() => setAutoCycleResults([])}
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: '#64748b',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {autoCycleResults.map((result, idx) => (
                <div
                  key={`${result.portal}-${result.mac}-${idx}`}
                  onClick={() => {
                    setPortalUrl(result.portal);
                    setMacAddress(result.mac);
                    setTestResult(null);
                    setGenres([]);
                    setChannels([]);
                    setStreamUrl(null);
                  }}
                  style={{
                    background: result.canStream 
                      ? 'rgba(34, 197, 94, 0.1)' 
                      : result.success 
                        ? 'rgba(251, 191, 36, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${result.canStream ? 'rgba(34, 197, 94, 0.3)' : result.success ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    {result.canStream ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : result.success ? (
                      <AlertCircle size={16} color="#fbbf24" />
                    ) : (
                      <AlertCircle size={16} color="#ef4444" />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: '500' }}>
                        {result.mac}
                      </div>
                      <div style={{ 
                        color: '#64748b', 
                        fontSize: '11px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {new URL(result.portal).hostname}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      color: result.canStream ? '#22c55e' : result.success ? '#fbbf24' : '#ef4444', 
                      fontSize: '11px', 
                      fontWeight: '500' 
                    }}>
                      {result.canStream ? 'Working' : result.success ? 'Connected' : 'Failed'}
                    </div>
                    {result.channels > 0 && (
                      <div style={{ color: '#64748b', fontSize: '10px' }}>
                        {result.channels} ch
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {savedAccounts.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            No saved accounts. Import a results JSON file or save a working account.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {savedAccounts.map((account, idx) => (
              <div
                key={`${account.portal}-${account.mac}-${idx}`}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '500' }}>
                    {account.mac}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {account.portal} • {account.channels.toLocaleString()} channels
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => loadAccount(account)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(120, 119, 198, 0.2)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#7877c6',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => removeAccount(account.portal, account.mac)}
                    style={{
                      padding: '6px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div style={{
          background: testResult.success 
            ? 'rgba(34, 197, 94, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            {testResult.success ? (
              <CheckCircle size={24} color="#22c55e" />
            ) : (
              <AlertCircle size={24} color="#ef4444" />
            )}
            <h3 style={{ 
              color: testResult.success ? '#22c55e' : '#ef4444', 
              margin: 0, 
              fontSize: '18px' 
            }}>
              {testResult.success ? 'Connection Successful' : 'Connection Failed'}
            </h3>
          </div>

          {testResult.error && (
            <p style={{ color: '#ef4444', margin: '0 0 16px 0' }}>{testResult.error}</p>
          )}

          {testResult.success && testResult.profile && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px' 
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Status</div>
                <div style={{ 
                  color: (testResult.profile.status === 1 || testResult.profile.status === '1') ? '#22c55e' : '#ef4444',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  {(testResult.profile.status === 1 || testResult.profile.status === '1') ? 'Active' : `Inactive (${testResult.profile.status})`}
                </div>
              </div>
              
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px' 
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Blocked</div>
                <div style={{ 
                  color: (testResult.profile.blocked === '1' || testResult.profile.blocked === 1) ? '#ef4444' : '#22c55e',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  {(testResult.profile.blocked === '1' || testResult.profile.blocked === 1) ? 'Yes' : 'No'}
                </div>
              </div>

              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Tv size={20} color="#7877c6" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Live TV</div>
                  <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>
                    {testResult.content?.itv?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Radio size={20} color="#7877c6" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Radio</div>
                  <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>
                    {testResult.content?.radio?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Film size={20} color="#7877c6" />
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>VOD</div>
                  <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>
                    {testResult.content?.vod?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px' 
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Stream Limit</div>
                <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>
                  {testResult.profile.playback_limit || 'N/A'}
                </div>
              </div>
            </div>
          )}

          {testResult.success && testResult.token && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '12px 16px', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Token: </span>
                  <code style={{ color: '#7877c6', fontSize: '12px' }}>{testResult.token}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(testResult.token!)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Channels Browser - Shows ALL channels loaded at once */}
      {testResult?.success && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ color: '#f8fafc', margin: '0 0 20px 0', fontSize: '16px' }}>
            Channel Browser ({totalChannels} channels loaded)
          </h3>

          {/* Reload button */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => loadAllChannels()}
              disabled={loadingChannels}
              style={{
                padding: '8px 16px',
                background: loadingChannels ? 'rgba(120, 119, 198, 0.3)' : 'rgba(120, 119, 198, 0.2)',
                border: '1px solid rgba(120, 119, 198, 0.3)',
                borderRadius: '8px',
                color: '#7877c6',
                fontSize: '13px',
                cursor: loadingChannels ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {loadingChannels ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={14} />}
              {loadingChannels ? 'Loading all channels...' : 'Reload All Channels'}
            </button>
            {/* Genre info - just for display */}
            {genres.length > 0 && (
              <div style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
                Categories: {genres.map(g => g.title).join(', ')}
              </div>
            )}
          </div>

          {/* Channel Filters */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search channels..."
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                width: '200px',
                outline: 'none'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterByDlhd}
                onChange={(e) => setFilterByDlhd(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                Only show channels matching our Live TV ({dlhdChannels.length} channels)
              </span>
            </label>
          </div>

          {/* Channels List */}
          {loadingChannels ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <Loader2 size={32} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              Loading channels...
            </div>
          ) : channels.length > 0 ? (
            (() => {
              // Apply filters
              let filteredChannels = channels;
              
              // Search filter
              if (channelSearch) {
                const searchLower = channelSearch.toLowerCase();
                filteredChannels = filteredChannels.filter(ch => 
                  ch.name.toLowerCase().includes(searchLower)
                );
              }
              
              // DLHD matching filter - fuzzy match channel names
              if (filterByDlhd && dlhdChannels.length > 0) {
                const dlhdNamesLower = dlhdChannels.map(ch => ch.name.toLowerCase());
                filteredChannels = filteredChannels.filter(ch => {
                  const chNameLower = ch.name.toLowerCase();
                  // Check for exact match or partial match
                  return dlhdNamesLower.some(dlhdName => 
                    chNameLower.includes(dlhdName) || 
                    dlhdName.includes(chNameLower) ||
                    // Also check without common suffixes like HD, FHD, etc
                    chNameLower.replace(/\s*(hd|fhd|uhd|4k|\+)$/i, '').trim() === dlhdName.replace(/\s*(hd|fhd|uhd|4k|\+)$/i, '').trim()
                  );
                });
              }
              
              return (
            <>
              <div style={{ marginBottom: '8px', color: '#64748b', fontSize: '12px' }}>
                Showing {filteredChannels.length} of {channels.length} channels
                {filterByDlhd && ` (filtered to match ${dlhdChannels.length} Live TV channels)`}
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {filteredChannels.map((channel) => (
                  <div
                    key={channel.id}
                    style={{
                      background: selectedChannel?.id === channel.id 
                        ? 'rgba(120, 119, 198, 0.2)' 
                        : 'rgba(15, 23, 42, 0.6)',
                      border: selectedChannel?.id === channel.id 
                        ? '1px solid #7877c6' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Skip HTTP logos to avoid mixed content warnings */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'rgba(120, 119, 198, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Tv size={20} color="#7877c6" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        color: '#f8fafc', 
                        fontSize: '14px', 
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {channel.name}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>
                        #{channel.number}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); getStream(channel); }}
                        disabled={loadingStream}
                        title="Play via Vercel API"
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(120, 119, 198, 0.2)',
                          border: '1px solid rgba(120, 119, 198, 0.3)',
                          borderRadius: '6px',
                          color: '#7877c6',
                          fontSize: '11px',
                          cursor: loadingStream ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Play size={12} /> API
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); getStreamViaCF(channel); }}
                        disabled={loadingStream}
                        title="Play via Cloudflare (direct)"
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(249, 115, 22, 0.2)',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          borderRadius: '6px',
                          color: '#f97316',
                          fontSize: '11px',
                          cursor: loadingStream ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Zap size={12} /> CF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              {loadingChannels ? 'Loading all channels...' : 'Click "Reload All Channels" to load channels'}
            </div>
          )}
        </div>
      )}

      {/* Stream Player */}
      {(loadingStream || streamUrl) && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Play size={20} />
              {selectedChannel?.name || 'Stream'}
            </h3>
            <div style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              background: RPI_PROXY_URL ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)',
              color: RPI_PROXY_URL ? '#22c55e' : '#fbbf24',
              border: `1px solid ${RPI_PROXY_URL ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
            }}>
              {RPI_PROXY_URL ? '🏠 RPi Proxy (Residential)' : '☁️ CF Proxy (Datacenter)'}
            </div>
          </div>

          {/* Show channel cmd for debugging */}
          {selectedChannel && (
            <div style={{ 
              background: 'rgba(15, 23, 42, 0.6)', 
              padding: '12px 16px', 
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Channel CMD:</div>
              <code style={{ color: '#7877c6', fontSize: '11px', wordBreak: 'break-all' }}>
                {selectedChannel.cmd || '(empty)'}
              </code>
            </div>
          )}

          {loadingStream ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <Loader2 size={32} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              Getting stream URL...
            </div>
          ) : streamUrl ? (
            <>
              <div 
                style={{
                  background: '#000',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '16px',
                  aspectRatio: '16/9',
                  position: 'relative'
                }}
              >
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%' }}
                />
                {playerError && (
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    right: '10px',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}>
                    {playerError}
                  </div>
                )}
              </div>

              <div style={{ 
                background: 'rgba(15, 23, 42, 0.6)', 
                padding: '12px 16px', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <code style={{ 
                  color: '#7877c6', 
                  fontSize: '12px',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {rawStreamUrl || streamUrl}
                </code>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedChannel && (
                    <button
                      onClick={() => getStream(selectedChannel)}
                      disabled={loadingStream}
                      style={{
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: 'none',
                        color: '#22c55e',
                        cursor: loadingStream ? 'not-allowed' : 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px'
                      }}
                      title="Get fresh stream URL with new token"
                    >
                      {loadingStream ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '🔄'} Refresh
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(rawStreamUrl || streamUrl || '')}
                    style={{
                      background: 'rgba(120, 119, 198, 0.2)',
                      border: 'none',
                      color: '#7877c6',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <a
                    href={rawStreamUrl || streamUrl || ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(120, 119, 198, 0.2)',
                      border: 'none',
                      color: '#7877c6',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={14} /> Open
                  </a>
                </div>
              </div>

              <div style={{ 
                background: 'rgba(251, 191, 36, 0.1)', 
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginTop: '12px'
              }}>
                <p style={{ color: '#fbbf24', fontSize: '13px', margin: '0 0 8px 0', fontWeight: '500' }}>
                  ⚠️ Stream not playing? This is normal for IPTV streams!
                </p>
                <p style={{ color: '#d4a', fontSize: '12px', margin: '0 0 8px 0' }}>
                  Most IPTV portals serve raw MPEG-TS streams which browsers cannot play directly.
                </p>
                <ol style={{ color: '#fbbf24', fontSize: '12px', margin: 0, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '4px' }}><strong>Use VLC:</strong> Copy the URL and paste into VLC (File → Open Network Stream)</li>
                  <li style={{ marginBottom: '4px' }}><strong>Use the VLC command:</strong> Click "Copy VLC Command" below and paste in terminal</li>
                  <li>The stream URL is valid - it just needs a proper MPEG-TS player</li>
                </ol>
                {rawStreamUrl && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        // Copy URL to clipboard
                        navigator.clipboard.writeText(rawStreamUrl);
                        alert('URL copied! Paste into VLC: File → Open Network Stream\n\nNote: Tokens expire quickly - paste immediately!');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(34, 197, 94, 0.3)',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                        borderRadius: '6px',
                        color: '#22c55e',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      📋 Copy URL for VLC (Recommended)
                    </button>
                    <button
                      onClick={() => {
                        // Generate VLC command
                        const vlcCmd = `vlc "${rawStreamUrl}"`;
                        navigator.clipboard.writeText(vlcCmd);
                        alert('VLC command copied!\n\nPaste in terminal immediately - tokens expire fast!');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(251, 191, 36, 0.2)',
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        borderRadius: '6px',
                        color: '#fbbf24',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Copy VLC Command
                    </button>
                    <button
                      onClick={() => {
                        // Try playing directly without proxy
                        if (videoRef.current && hlsRef.current) {
                          hlsRef.current.destroy();
                        }
                        setStreamUrl(rawStreamUrl);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(100, 100, 100, 0.2)',
                        border: '1px solid rgba(100, 100, 100, 0.4)',
                        borderRadius: '6px',
                        color: '#94a3b8',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Try Direct (Usually Fails)
                    </button>
                  </div>
                )}
              </div>

              {/* Stream Debug Info */}
              {streamDebug && (
                <div style={{ marginTop: '12px' }}>
                  {/* Method indicator */}
                  {streamDebug.usedMethod && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      padding: '8px 12px',
                      background: streamDebug.usedMethod === 'direct' 
                        ? 'rgba(249, 115, 22, 0.1)' 
                        : 'rgba(120, 119, 198, 0.1)',
                      border: `1px solid ${streamDebug.usedMethod === 'direct' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(120, 119, 198, 0.3)'}`,
                      borderRadius: '6px'
                    }}>
                      <Zap size={14} color={streamDebug.usedMethod === 'direct' ? '#f97316' : '#7877c6'} />
                      <span style={{ 
                        color: streamDebug.usedMethod === 'direct' ? '#f97316' : '#7877c6', 
                        fontSize: '12px', 
                        fontWeight: '500' 
                      }}>
                        Stream via: {streamDebug.usedMethod === 'direct' ? 'Cloudflare (Direct)' : streamDebug.usedMethod}
                      </span>
                      {streamDebug.cfToken && (
                        <span style={{ color: '#64748b', fontSize: '11px', marginLeft: 'auto' }}>
                          CF Token: {streamDebug.cfToken}
                        </span>
                      )}
                    </div>
                  )}
                  {streamDebug.note && (
                    <div style={{
                      padding: '8px 12px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      color: '#22c55e',
                      fontSize: '12px'
                    }}>
                      💡 {streamDebug.note}
                    </div>
                  )}
                  <details>
                    <summary style={{ 
                      color: '#94a3b8', 
                      cursor: 'pointer', 
                      padding: '8px',
                      background: 'rgba(30, 41, 59, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}>
                      View Stream API Response
                    </summary>
                    <pre style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: '12px',
                      borderRadius: '0 0 6px 6px',
                      overflow: 'auto',
                      maxHeight: '200px',
                      color: '#94a3b8',
                      fontSize: '11px',
                      margin: 0
                    }}>
                      {JSON.stringify(streamDebug, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Raw Profile Data */}
      {testResult?.success && testResult.profile && (
        <details style={{ marginTop: '24px' }}>
          <summary style={{ 
            color: '#94a3b8', 
            cursor: 'pointer', 
            padding: '12px',
            background: 'rgba(30, 41, 59, 0.3)',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            View Raw Profile Data
          </summary>
          <pre style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '16px',
            borderRadius: '0 0 8px 8px',
            overflow: 'auto',
            maxHeight: '400px',
            color: '#94a3b8',
            fontSize: '12px',
            margin: 0
          }}>
            {JSON.stringify(testResult.profile, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
