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
  Trash2
} from 'lucide-react';
import type Hls from 'hls.js';
import type mpegts from 'mpegts.js';

// Cloudflare Worker proxy URL for IPTV streams
// This bypasses CORS and SSL issues that browsers have with IPTV CDNs
const CF_PROXY_URL = process.env.NEXT_PUBLIC_CF_PROXY_URL || 'https://media-proxy.vynx.workers.dev';

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

export default function IPTVDebugPage() {
  const [portalUrl, setPortalUrl] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('*');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [rawStreamUrl, setRawStreamUrl] = useState<string | null>(null);
  const [streamDebug, setStreamDebug] = useState<any>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [playerError, setPlayerError] = useState<string | null>(null);
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

  // Setup player when stream URL changes
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
    const isHLS = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
    const isTS = streamUrl.includes('extension=ts') || streamUrl.endsWith('.ts') || streamUrl.includes('live.php');
    
    console.log('Stream type detection:', { isHLS, isTS, streamUrl });

    // Dynamic import and setup
    const setupPlayer = async () => {
      if (isHLS) {
        // Dynamically import HLS.js
        const HlsModule = await import('hls.js');
        const Hls = HlsModule.default;
        
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
          });
          
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(console.error);
          });
          
          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.error('HLS error:', data);
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
          
          // Use Cloudflare Worker proxy to bypass CORS/SSL issues
          const rawUrl = rawStreamUrl || streamUrl;
          const cfProxyUrl = `${CF_PROXY_URL}/iptv/stream?url=${encodeURIComponent(rawUrl)}`;
          
          console.log('mpegts using CF proxy URL:', cfProxyUrl);
          
          const player = mpegtsLib.createPlayer({
            type: 'mpegts',
            isLive: true,
            url: cfProxyUrl,
          }, {
            enableWorker: false,
            enableStashBuffer: false,
            stashInitialSize: 128,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 1.5,
            liveBufferLatencyMinRemain: 0.3,
          });
          
          player.attachMediaElement(video);
          player.load();
          
          player.on(mpegtsLib.Events.ERROR, (errorType: string, errorDetail: string) => {
            console.error('mpegts error:', errorType, errorDetail);
            if (errorDetail.includes('403') || errorDetail.includes('HttpStatusCodeInvalid')) {
              setPlayerError(`Portal blocked cloud IP (403). IPTV providers block datacenter IPs. Use VLC with the URL below.`);
            } else if (errorDetail.includes('SSL') || errorDetail.includes('fetch') || errorDetail.includes('Network')) {
              setPlayerError(`Network Error: Stream may have expired. Click Refresh and try VLC.`);
            } else {
              setPlayerError(`MPEG-TS Error: ${errorType}. Use VLC to play this stream.`);
            }
          });
          
          player.on(mpegtsLib.Events.LOADING_COMPLETE, () => {
            console.log('mpegts loading complete');
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
        // Fallback - try direct playback
        console.log('Attempting direct playback');
        setPlayerError('Browser may not support this stream format. Use VLC instead.');
        video.src = streamUrl;
        video.play().catch((err) => {
          console.error('Direct playback failed:', err);
          setPlayerError(`Playback failed: ${err.message}. Use VLC to play this stream.`);
        });
      }
    };

    setupPlayer().catch((err) => {
      console.error('Failed to setup player:', err);
      setPlayerError(`Failed to load player: ${err.message}`);
    })

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
  }, [streamUrl, rawStreamUrl]);

  // Load channels - accepts optional token override for immediate use after connection
  const loadChannels = useCallback(async (genre: string = '*', page: number = 0, tokenOverride?: string) => {
    const token = tokenOverride || testResult?.token;
    if (!token) return;
    
    setLoadingChannels(true);
    setSelectedGenre(genre);
    setCurrentPage(page);
    
    try {
      const response = await fetch('/api/admin/iptv-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'channels', 
          portalUrl, 
          macAddress, 
          token,
          genre,
          page
        })
      });
      
      const data = await response.json();
      console.log('Channels response:', data);
      if (data.success) {
        setChannels(data.channels?.data || []);
        setTotalChannels(data.channels?.total_items || 0);
      } else {
        console.error('Failed to load channels:', data);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
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
        
        // Auto-load first page of all channels
        await loadChannels('*', 0, data.token);
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  }, [portalUrl, macAddress, loadChannels]);

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
        setStreamUrl(proxiedUrl);
      }
    } catch (error) {
      console.error('Failed to get stream:', error);
      setStreamDebug({ error: String(error) });
    } finally {
      setLoadingStream(false);
    }
  }, [testResult?.token, portalUrl, macAddress]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
          
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
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
          </div>
        </div>
      </div>

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

      {/* Genres & Channels Browser */}
      {testResult?.success && genres.length > 0 && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ color: '#f8fafc', margin: '0 0 20px 0', fontSize: '16px' }}>
            Channel Browser
          </h3>

          {/* Genre Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
              Category
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => loadChannels('*', 0)}
                style={{
                  padding: '8px 16px',
                  background: selectedGenre === '*' ? 'rgba(120, 119, 198, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                  border: selectedGenre === '*' ? '1px solid #7877c6' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: selectedGenre === '*' ? '#fff' : '#94a3b8',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                All ({testResult.content?.itv || 0})
              </button>
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => loadChannels(genre.id, 0)}
                  style={{
                    padding: '8px 16px',
                    background: selectedGenre === genre.id ? 'rgba(120, 119, 198, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    border: selectedGenre === genre.id ? '1px solid #7877c6' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: selectedGenre === genre.id ? '#fff' : '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {genre.title}
                </button>
              ))}
            </div>
          </div>

          {/* Channels List */}
          {loadingChannels ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <Loader2 size={32} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              Loading channels...
            </div>
          ) : channels.length > 0 ? (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    onClick={() => getStream(channel)}
                    style={{
                      background: selectedChannel?.id === channel.id 
                        ? 'rgba(120, 119, 198, 0.2)' 
                        : 'rgba(15, 23, 42, 0.6)',
                      border: selectedChannel?.id === channel.id 
                        ? '1px solid #7877c6' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {channel.logo ? (
                      <img 
                        src={channel.logo} 
                        alt="" 
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '8px',
                          objectFit: 'contain',
                          background: 'rgba(255,255,255,0.1)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
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
                    )}
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
                    <Play size={16} color="#7877c6" />
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalChannels > 14 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  marginTop: '16px' 
                }}>
                  <button
                    onClick={() => loadChannels(selectedGenre, Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: currentPage === 0 ? '#475569' : '#94a3b8',
                      fontSize: '13px',
                      cursor: currentPage === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ 
                    padding: '8px 16px', 
                    color: '#94a3b8', 
                    fontSize: '13px' 
                  }}>
                    Page {currentPage + 1} of {Math.ceil(totalChannels / 14)}
                  </span>
                  <button
                    onClick={() => loadChannels(selectedGenre, currentPage + 1)}
                    disabled={(currentPage + 1) * 14 >= totalChannels}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: (currentPage + 1) * 14 >= totalChannels ? '#475569' : '#94a3b8',
                      fontSize: '13px',
                      cursor: (currentPage + 1) * 14 >= totalChannels ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Select a category to browse channels
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
          <h3 style={{ color: '#f8fafc', margin: '0 0 20px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Play size={20} />
            {selectedChannel?.name || 'Stream'}
          </h3>

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
              <div style={{
                background: '#000',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '16px',
                aspectRatio: '16/9',
                position: 'relative'
              }}>
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
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
                <details style={{ marginTop: '12px' }}>
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
