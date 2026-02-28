'use client';

/**
 * ContentPerformanceBreakdown - DETAILED CONTENT PERFORMANCE
 * 
 * Provides granular content performance analytics including:
 * - Individual content performance with detailed metrics
 * - Completion rate analysis
 * - Content type performance comparison
 * - Viewer engagement patterns
 * - Content ranking and trends
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, Card, Grid, ProgressBar, gradients } from './ui';

interface ContentPerformance {
  contentId: string;
  contentTitle: string;
  contentType: string;
  views: number;
  totalWatchTime: number;
  avgCompletion: number;
  uniqueViewers: number;
}

interface ContentAnalytics {
  contentPerformance: ContentPerformance[];
  overview: {
    totalViews: number;
    totalWatchTime: number;
    uniqueSessions: number;
    uniqueUsers: number;
    avgSessionDuration: number;
  };
}

export default function ContentPerformanceBreakdown() {
  const [data, setData] = useState<ContentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'views' | 'watchTime' | 'completion' | 'viewers'>('views');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv' | 'live'>('all');
  const [period, setPeriod] = useState('week');

  const fetchContentPerformance = useCallback(async () => {
    try {
      setError(null);
      
      const cfWorkerUrl = process.env.NEXT_PUBLIC_CF_SYNC_URL || 'https://flyx-sync.vynx.workers.dev';
      const response = await fetch(`${cfWorkerUrl}/admin/stats?slices=content&range=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch content performance');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to fetch content performance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchContentPerformance();
  }, [fetchContentPerformance]);

  if (loading && !data) {
    return (
      <Card title="🎬 Content Performance Breakdown" icon="">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.text.muted }}>
          Loading content performance...
        </div>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card title="🎬 Content Performance Breakdown" icon="">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.danger }}>
          Error: {error}
        </div>
      </Card>
    );
  }

  if (!data || !data.contentPerformance) return null;

  // Filter and sort content
  let filteredContent = data.contentPerformance.filter(content => {
    if (filterType === 'all') return true;
    return content.contentType?.toLowerCase().includes(filterType);
  });

  filteredContent = filteredContent.sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return b.views - a.views;
      case 'watchTime':
        return b.totalWatchTime - a.totalWatchTime;
      case 'completion':
        return (b.avgCompletion || 0) - (a.avgCompletion || 0);
      case 'viewers':
        return b.uniqueViewers - a.uniqueViewers;
      default:
        return b.views - a.views;
    }
  });

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getContentTypeIcon = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('movie')) return '🎬';
    if (lowerType.includes('tv') || lowerType.includes('series')) return '📺';
    if (lowerType.includes('live')) return '🔴';
    return '🎥';
  };

  const getCompletionColor = (completion: number) => {
    if (completion >= 80) return colors.success;
    if (completion >= 60) return colors.warning;
    if (completion >= 40) return colors.info;
    return colors.danger;
  };

  const getPerformanceScore = (content: ContentPerformance) => {
    // Calculate a performance score based on multiple factors
    const viewsScore = Math.min(content.views / 100, 1) * 30; // Max 30 points for views
    const completionScore = (content.avgCompletion || 0) / 100 * 40; // Max 40 points for completion
    const engagementScore = Math.min(content.totalWatchTime / 1000, 1) * 30; // Max 30 points for watch time
    return Math.round(viewsScore + completionScore + engagementScore);
  };

  // Calculate content type statistics
  const contentTypeStats = data.contentPerformance.reduce((acc, content) => {
    const type = content.contentType || 'unknown';
    if (!acc[type]) {
      acc[type] = { count: 0, totalViews: 0, totalWatchTime: 0, avgCompletion: 0 };
    }
    acc[type].count++;
    acc[type].totalViews += content.views;
    acc[type].totalWatchTime += content.totalWatchTime;
    acc[type].avgCompletion += (content.avgCompletion || 0);
    return acc;
  }, {} as Record<string, { count: number; totalViews: number; totalWatchTime: number; avgCompletion: number }>);

  // Calculate averages for content types
  Object.keys(contentTypeStats).forEach(type => {
    contentTypeStats[type].avgCompletion = contentTypeStats[type].avgCompletion / contentTypeStats[type].count;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, color: colors.text.primary, fontSize: '18px', fontWeight: '600' }}>
            🎬 Content Performance Breakdown
          </h3>
          <p style={{ margin: '4px 0 0 0', color: colors.text.muted, fontSize: '13px' }}>
            Detailed analysis of individual content performance and engagement
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: colors.text.primary,
              fontSize: '12px',
            }}
          >
            <option value="all">All Types</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
            <option value="live">Live TV</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: colors.text.primary,
              fontSize: '12px',
            }}
          >
            <option value="views">Sort by Views</option>
            <option value="watchTime">Sort by Watch Time</option>
            <option value="completion">Sort by Completion</option>
            <option value="viewers">Sort by Unique Viewers</option>
          </select>
          
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: colors.text.primary,
              fontSize: '12px',
            }}
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Content Type Overview */}
      {Object.keys(contentTypeStats).length > 0 && (
        <Card title="📊 Content Type Performance" icon="">
          <Grid cols="auto-fit" minWidth="200px" gap="16px">
            {Object.entries(contentTypeStats).map(([type, stats]) => (
              <div key={type} style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{getContentTypeIcon(type)}</span>
                  <div>
                    <div style={{ color: colors.text.primary, fontSize: '14px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {type}
                    </div>
                    <div style={{ color: colors.text.muted, fontSize: '12px' }}>
                      {stats.count} items
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text.secondary, fontSize: '12px' }}>Total Views</span>
                    <span style={{ color: colors.primary, fontWeight: '600', fontSize: '12px' }}>
                      {stats.totalViews.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text.secondary, fontSize: '12px' }}>Watch Time</span>
                    <span style={{ color: colors.success, fontWeight: '600', fontSize: '12px' }}>
                      {formatDuration(stats.totalWatchTime)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text.secondary, fontSize: '12px' }}>Avg Completion</span>
                    <span style={{ color: getCompletionColor(stats.avgCompletion), fontWeight: '600', fontSize: '12px' }}>
                      {Math.round(stats.avgCompletion)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </Grid>
        </Card>
      )}

      {/* Individual Content Performance */}
      <Card title="🏆 Individual Content Rankings" icon="">
        {filteredContent.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredContent.slice(0, 20).map((content, index) => {
              const performanceScore = getPerformanceScore(content);
              const isTopPerformer = index < 3;
              
              return (
                <div key={content.contentId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: isTopPerformer ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  border: isTopPerformer ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  {/* Rank */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isTopPerformer 
                      ? ['#ffd700', '#c0c0c0', '#cd7f32'][index] 
                      : 'rgba(255,255,255,0.1)',
                    color: isTopPerformer ? '#000' : colors.text.secondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>

                  {/* Content Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>{getContentTypeIcon(content.contentType)}</span>
                      <div style={{ 
                        color: colors.text.primary, 
                        fontSize: '14px', 
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {content.contentTitle || content.contentId}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ color: colors.text.muted, fontSize: '12px' }}>
                        {content.contentType}
                      </span>
                      
                      {/* Performance Score */}
                      <div style={{
                        padding: '2px 8px',
                        background: performanceScore >= 70 ? 'rgba(16,185,129,0.2)' : 
                                   performanceScore >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: performanceScore >= 70 ? colors.success : 
                               performanceScore >= 50 ? colors.warning : colors.danger
                      }}>
                        Score: {performanceScore}/100
                      </div>
                    </div>

                    {/* Completion Rate Bar */}
                    {content.avgCompletion > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: colors.text.muted, fontSize: '11px' }}>Completion Rate</span>
                          <span style={{ color: getCompletionColor(content.avgCompletion), fontSize: '11px', fontWeight: '600' }}>
                            {Math.round(content.avgCompletion)}%
                          </span>
                        </div>
                        <ProgressBar 
                          value={content.avgCompletion} 
                          max={100} 
                          gradient={gradients.mixed} 
                          height={4} 
                        />
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'right', minWidth: '120px' }}>
                    <div>
                      <div style={{ color: colors.primary, fontSize: '16px', fontWeight: '700' }}>
                        {content.views.toLocaleString()}
                      </div>
                      <div style={{ color: colors.text.muted, fontSize: '11px' }}>views</div>
                    </div>
                    
                    <div>
                      <div style={{ color: colors.success, fontSize: '13px', fontWeight: '600' }}>
                        {formatDuration(content.totalWatchTime)}
                      </div>
                      <div style={{ color: colors.text.muted, fontSize: '11px' }}>watch time</div>
                    </div>
                    
                    <div>
                      <div style={{ color: colors.info, fontSize: '13px', fontWeight: '600' }}>
                        {content.uniqueViewers.toLocaleString()}
                      </div>
                      <div style={{ color: colors.text.muted, fontSize: '11px' }}>unique viewers</div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredContent.length > 20 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '16px', 
                color: colors.text.muted, 
                fontSize: '13px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                marginTop: '8px'
              }}>
                Showing top 20 of {filteredContent.length} items
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: colors.text.muted, textAlign: 'center', padding: '40px' }}>
            No content data available for the selected filters
          </div>
        )}
      </Card>
    </div>
  );
}