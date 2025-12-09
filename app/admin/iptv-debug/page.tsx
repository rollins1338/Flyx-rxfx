'use client';

import { useState, useCallback } from 'react';
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
  ExternalLink
} from 'lucide-react';

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
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  }, [portalUrl, macAddress]);

  const loadChannels = useCallback(async (genre: string = '*', page: number = 0) => {
    if (!testResult?.token) return;
    
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
          token: testResult.token,
          genre,
          page
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setChannels(data.channels.data || []);
        setTotalChannels(data.channels.total_items || 0);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  }, [testResult?.token, portalUrl, macAddress]);

  const getStream = useCallback(async (channel: Channel) => {
    if (!testResult?.token) return;
    
    setLoadingStream(true);
    setSelectedChannel(channel);
    setStreamUrl(null);
    
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
      if (data.success && data.streamUrl) {
        // Extract URL from ffmpeg command format
        let url = data.streamUrl;
        if (url.startsWith('ffmpeg ')) {
          url = url.replace('ffmpeg ', '');
        }
        setStreamUrl(url);
      }
    } catch (error) {
      console.error('Failed to get stream:', error);
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
                  color: testResult.profile.status === 1 ? '#22c55e' : '#ef4444',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  {testResult.profile.status === 1 ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.4)', 
                padding: '16px', 
                borderRadius: '12px' 
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Blocked</div>
                <div style={{ 
                  color: testResult.profile.blocked === '1' ? '#ef4444' : '#22c55e',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  {testResult.profile.blocked === '1' ? 'Yes' : 'No'}
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
                aspectRatio: '16/9'
              }}>
                <video
                  src={streamUrl}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%' }}
                  onError={() => {
                    console.log('Video playback error - stream may require HLS player');
                  }}
                />
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
                  {streamUrl}
                </code>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => copyToClipboard(streamUrl)}
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
                    href={streamUrl}
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

              <p style={{ color: '#64748b', fontSize: '12px', marginTop: '12px' }}>
                Note: Some streams may require an HLS-compatible player (like VLC) to play properly.
              </p>
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
