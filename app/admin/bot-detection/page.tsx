'use client';

/**
 * Bot Detection Management Page
 * Comprehensive bot detection system with confidence scoring, manual review workflow,
 * detection criteria transparency, and filtering options throughout analytics displays
 */

import { useState, useEffect, useCallback } from 'react';
import BotFilterControls from '../components/BotFilterControls';
import { useStats } from '../context/StatsContext';

interface BotDetection {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  confidenceScore: number;
  detectionReasons: string[];
  status: 'suspected' | 'confirmed_bot' | 'confirmed_human' | 'pending_review';
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface DetectionCriteria {
  requestFrequency: {
    threshold: number;
    weight: number;
  };
  userAgentPatterns: {
    knownBots: string[];
    suspiciousPatterns: string[];
    weight: number;
  };
  behaviorPatterns: {
    noJavaScript: { weight: number };
    rapidNavigation: { threshold: number; weight: number };
    unusualViewingPatterns: { weight: number };
  };
  ipAnalysis: {
    datacenterIPs: { weight: number };
    vpnDetection: { weight: number };
    geographicAnomalies: { weight: number };
  };
}

interface BotDetectionMetrics {
  totalDetections: number;
  suspectedBots: number;
  confirmedBots: number;
  pendingReview: number;
  avgConfidenceScore: number;
  maxConfidenceScore: number;
}

interface ReviewHistoryItem {
  detectionId: string;
  reviewerId: string;
  decision: string;
  confidence: number;
  notes: string | null;
  accuracyImprovement: number;
  reviewedAt: number;
  detection: {
    userId: string;
    ipAddress: string;
    originalConfidence: number;
    currentStatus: string;
  };
}

interface ReviewStatistics {
  totalReviews: number;
  confirmedBots: number;
  confirmedHumans: number;
  needsMoreData: number;
  avgReviewerConfidence: number;
  avgAccuracyImprovement: number;
}

// Bot traffic data from CF worker
interface BotTrafficData {
  summary: {
    totalHits: number;
    todayHits: number;
    uniqueUserAgents: number;
    uniqueCountries: number;
    uniquePaths: number;
    avgConfidence: number;
    maxConfidence: number;
    minConfidence: number;
  };
  byCategory: Array<{ category: string; hitCount: number; uniqueBots: number; avgConfidence: number }>;
  byName: Array<{ name: string; category: string; hitCount: number; avgConfidence: number; lastSeen: number }>;
  byCountry: Array<{ country: string; hitCount: number; uniqueBots: number }>;
  byHour: Array<{ hour: number; hitCount: number }>;
  byPath: Array<{ path: string; hitCount: number; uniqueBots: number }>;
  recentHits: Array<{
    id: string;
    botName: string;
    category: string;
    userAgent: string;
    country: string;
    city: string;
    path: string;
    referrer: string;
    confidence: number;
    hitTime: number;
  }>;
  topUserAgents: Array<{ userAgent: string; botName: string; category: string; hitCount: number; avgConfidence: number }>;
  ipPatterns: Array<{ country: string; city: string; hitCount: number; uniqueBots: number; botNames: string[] }>;
  dailyTrend: Array<{ date: string; hitCount: number; uniqueBots: number }>;
}

export default function BotDetectionPage() {
  const [detections, setDetections] = useState<BotDetection[]>([]);
  const [metrics, setMetrics] = useState<BotDetectionMetrics | null>(null);
  const [criteria, setCriteria] = useState<DetectionCriteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDetection, setSelectedDetection] = useState<BotDetection | null>(null);
  const [detailViewDetection, setDetailViewDetection] = useState<BotDetection | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'confirm_bot' | 'confirm_human' | 'needs_more_data'>('confirm_bot');
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'detections' | 'criteria' | 'review'>('overview');
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStatistics | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  
  // Bot traffic data from CF worker
  const [botTraffic, setBotTraffic] = useState<BotTrafficData | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficDays, setTrafficDays] = useState(7);
  const [selectedBotHit, setSelectedBotHit] = useState<BotTrafficData['recentHits'][0] | null>(null);
  
  // Use StatsContext for global bot filter settings
  const { refresh: refreshStats } = useStats();

  useEffect(() => {
    fetchBotDetectionData();
    fetchBotTrafficData();
  }, []);

  const fetchBotDetectionData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/bot-detection');
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.metrics);
        setDetections(data.recentDetections || []);
        setCriteria(data.detectionCriteria);
      }
    } catch (error) {
      console.error('Failed to fetch bot detection data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBotTrafficData = useCallback(async () => {
    try {
      setTrafficLoading(true);
      // Try CF worker first, fallback to unified-stats
      const cfWorkerUrl = process.env.NEXT_PUBLIC_CF_ANALYTICS_URL || 'https://flyx-analytics.vynx.workers.dev';
      const response = await fetch(`${cfWorkerUrl}/admin/bot-stats?days=${trafficDays}&limit=100`);
      const data = await response.json();
      
      if (data.success) {
        setBotTraffic(data);
      }
    } catch (error) {
      console.error('Failed to fetch bot traffic data:', error);
    } finally {
      setTrafficLoading(false);
    }
  }, [trafficDays]);

  // Refetch traffic data when days change
  useEffect(() => {
    if (activeTab === 'traffic') {
      fetchBotTrafficData();
    }
  }, [trafficDays, activeTab, fetchBotTrafficData]);

  const fetchReviewHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/bot-detection/review');
      const data = await response.json();
      
      if (data.success) {
        setReviewHistory(data.reviewHistory || []);
        setReviewStats(data.statistics || null);
      }
    } catch (error) {
      console.error('Failed to fetch review history:', error);
    }
  }, []);

  // Fetch review history when switching to review tab
  useEffect(() => {
    if (activeTab === 'review') {
      fetchReviewHistory();
    }
  }, [activeTab, fetchReviewHistory]);

  const submitManualReview = async (detection: BotDetection) => {
    try {
      setSubmittingReview(true);
      setReviewError(null);
      setReviewSuccess(null);
      
      const reviewData = {
        detectionId: detection.id,
        decision: reviewDecision,
        notes: reviewNotes,
        confidence: 90, // Default high confidence for manual reviews
      };

      const response = await fetch('/api/admin/bot-detection/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh data after successful review
        await fetchBotDetectionData();
        await fetchReviewHistory();
        // Also refresh global stats
        await refreshStats();
        
        setSelectedDetection(null);
        setReviewNotes('');
        setReviewSuccess(`Review submitted successfully. Status changed to: ${data.feedback?.newStatus || reviewDecision}`);
        
        // Clear success message after 3 seconds
        setTimeout(() => setReviewSuccess(null), 3000);
      } else {
        setReviewError(data.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      setReviewError('Network error. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed_bot': return '#ef4444';
      case 'confirmed_human': return '#22c55e';
      case 'suspected': return '#f59e0b';
      case 'pending_review': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 30) return '#3b82f6';
    return '#22c55e';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: '#94a3b8',
      }}>
        Loading bot detection data...
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
    }}>
      <div style={{
        marginBottom: '24px',
      }}>
        <h1 style={{
          color: '#f1f5f9',
          fontSize: '28px',
          fontWeight: '700',
          margin: '0 0 8px 0',
        }}>
          🤖 Bot Detection System
        </h1>
        <p style={{
          color: '#94a3b8',
          fontSize: '16px',
          margin: 0,
        }}>
          Comprehensive bot detection with confidence scoring, manual review workflow, and transparent criteria
        </p>
      </div>

      {/* Bot Filter Controls */}
      <BotFilterControls />

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '2px',
        marginBottom: '24px',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '8px',
        padding: '4px',
      }}>
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'traffic', label: '🚦 Bot Traffic' },
          { key: 'detections', label: '🔍 Recent Detections' },
          { key: 'criteria', label: '⚙️ Detection Criteria' },
          { key: 'review', label: '👥 Manual Review' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === tab.key ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeTab === tab.key ? '#60a5fa' : '#94a3b8',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && metrics && (
        <div>
          {/* Main Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '20px',
            }}>
              <h3 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                Total Detections
              </h3>
              <div style={{
                color: '#60a5fa',
                fontSize: '32px',
                fontWeight: '700',
                marginBottom: '8px',
              }}>
                {metrics.totalDetections.toLocaleString()}
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                Last 7 days
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '20px',
            }}>
              <h3 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                Suspected Bots
              </h3>
              <div style={{
                color: '#f59e0b',
                fontSize: '32px',
                fontWeight: '700',
                marginBottom: '8px',
              }}>
                {metrics.suspectedBots.toLocaleString()}
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                Confidence ≥ 50%
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '20px',
            }}>
              <h3 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                Confirmed Bots
              </h3>
              <div style={{
                color: '#ef4444',
                fontSize: '32px',
                fontWeight: '700',
                marginBottom: '8px',
              }}>
                {metrics.confirmedBots.toLocaleString()}
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                Confidence ≥ 80%
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '20px',
            }}>
              <h3 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                Pending Review
              </h3>
              <div style={{
                color: '#3b82f6',
                fontSize: '32px',
                fontWeight: '700',
                marginBottom: '8px',
              }}>
                {metrics.pendingReview.toLocaleString()}
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                Awaiting manual review
              </div>
            </div>
          </div>

          {/* Additional Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: '500',
                margin: '0 0 8px 0',
              }}>
                Average Confidence Score
              </h4>
              <div style={{
                color: getConfidenceColor(metrics.avgConfidenceScore),
                fontSize: '24px',
                fontWeight: '700',
              }}>
                {metrics.avgConfidenceScore}%
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: '500',
                margin: '0 0 8px 0',
              }}>
                Max Confidence Score
              </h4>
              <div style={{
                color: getConfidenceColor(metrics.maxConfidenceScore),
                fontSize: '24px',
                fontWeight: '700',
              }}>
                {metrics.maxConfidenceScore}%
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: '500',
                margin: '0 0 8px 0',
              }}>
                Bot Detection Rate
              </h4>
              <div style={{
                color: '#f1f5f9',
                fontSize: '24px',
                fontWeight: '700',
              }}>
                {metrics.totalDetections > 0 
                  ? Math.round(((metrics.confirmedBots + metrics.suspectedBots) / metrics.totalDetections) * 100)
                  : 0}%
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: '500',
                margin: '0 0 8px 0',
              }}>
                Review Completion
              </h4>
              <div style={{
                color: '#22c55e',
                fontSize: '24px',
                fontWeight: '700',
              }}>
                {metrics.totalDetections > 0 
                  ? Math.round(((metrics.totalDetections - metrics.pendingReview) / metrics.totalDetections) * 100)
                  : 100}%
              </div>
            </div>
          </div>

          {/* Real-time Bot Traffic Summary */}
          {botTraffic && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}>
                <h3 style={{
                  color: '#f1f5f9',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0,
                }}>
                  🚦 Real-time Bot Traffic (Last 7 Days)
                </h3>
                <button
                  onClick={() => setActiveTab('traffic')}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    color: '#ef4444',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  View Details →
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px',
              }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Total Bot Hits</div>
                  <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: '700' }}>
                    {botTraffic.summary.totalHits.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Today</div>
                  <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>
                    {botTraffic.summary.todayHits.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Unique Bots</div>
                  <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>
                    {botTraffic.summary.uniqueUserAgents}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Countries</div>
                  <div style={{ color: '#22c55e', fontSize: '24px', fontWeight: '700' }}>
                    {botTraffic.summary.uniqueCountries}
                  </div>
                </div>
              </div>
              {botTraffic.byName.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>Top Bots:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {botTraffic.byName.slice(0, 5).map((bot, i) => (
                      <span
                        key={i}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#f87171',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {bot.name} ({bot.hitCount})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px',
          }}>
            <h3 style={{
              color: '#f1f5f9',
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 16px 0',
            }}>
              Quick Actions
            </h3>
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setActiveTab('traffic')}
                style={{
                  padding: '10px 20px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
              >
                🚦 View Bot Traffic
              </button>
              <button
                onClick={() => setActiveTab('review')}
                style={{
                  padding: '10px 20px',
                  background: metrics.pendingReview > 0 ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: metrics.pendingReview > 0 ? 'pointer' : 'default',
                  transition: 'background-color 0.2s ease',
                }}
              >
                Review Pending ({metrics.pendingReview})
              </button>
              <button
                onClick={() => setActiveTab('detections')}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                View All Detections
              </button>
              <button
                onClick={() => setActiveTab('criteria')}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                View Detection Criteria
              </button>
              <button
                onClick={() => {
                  fetchBotDetectionData();
                  fetchBotTrafficData();
                }}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                🔄 Refresh All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Traffic Tab - Real-time bot traffic from CF Worker */}
      {activeTab === 'traffic' && (
        <div>
          {/* Time Range Selector */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
            }}>
              {[1, 7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTrafficDays(days)}
                  style={{
                    padding: '8px 16px',
                    background: trafficDays === days ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: trafficDays === days ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: trafficDays === days ? '#60a5fa' : '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {days === 1 ? 'Today' : `${days} Days`}
                </button>
              ))}
            </div>
            <button
              onClick={fetchBotTrafficData}
              disabled={trafficLoading}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '13px',
                cursor: trafficLoading ? 'not-allowed' : 'pointer',
                opacity: trafficLoading ? 0.6 : 1,
              }}
            >
              {trafficLoading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {trafficLoading && !botTraffic ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              color: '#94a3b8',
            }}>
              Loading bot traffic data...
            </div>
          ) : botTraffic ? (
            <>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Total Bot Hits</div>
                  <div style={{ color: '#ef4444', fontSize: '28px', fontWeight: '700' }}>
                    {botTraffic.summary.totalHits.toLocaleString()}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    Today: {botTraffic.summary.todayHits.toLocaleString()}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Unique Bots</div>
                  <div style={{ color: '#f59e0b', fontSize: '28px', fontWeight: '700' }}>
                    {botTraffic.summary.uniqueUserAgents.toLocaleString()}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    User agents detected
                  </div>
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Countries</div>
                  <div style={{ color: '#3b82f6', fontSize: '28px', fontWeight: '700' }}>
                    {botTraffic.summary.uniqueCountries}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    Geographic spread
                  </div>
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Avg Confidence</div>
                  <div style={{ color: '#22c55e', fontSize: '28px', fontWeight: '700' }}>
                    {botTraffic.summary.avgConfidence}%
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    Detection accuracy
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                marginBottom: '24px',
              }}>
                {/* By Category */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
                    🏷️ By Category
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {botTraffic.byCategory.slice(0, 8).map((cat, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '4px',
                      }}>
                        <span style={{ color: '#f1f5f9', fontSize: '13px' }}>{cat.category || 'Unknown'}</span>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{cat.uniqueBots} bots</span>
                          <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>
                            {cat.hitCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {botTraffic.byCategory.length === 0 && (
                      <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                        No bot traffic data
                      </div>
                    )}
                  </div>
                </div>

                {/* By Country */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
                    🌍 By Country
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {botTraffic.byCountry.slice(0, 8).map((country, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '4px',
                      }}>
                        <span style={{ color: '#f1f5f9', fontSize: '13px' }}>{country.country || 'Unknown'}</span>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{country.uniqueBots} bots</span>
                          <span style={{ color: '#3b82f6', fontSize: '14px', fontWeight: '600' }}>
                            {country.hitCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {botTraffic.byCountry.length === 0 && (
                      <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                        No geographic data
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hourly Pattern */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
              }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
                  ⏰ Hourly Bot Activity Pattern
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '4px',
                  height: '120px',
                  padding: '0 8px',
                }}>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const hourData = botTraffic.byHour.find(h => h.hour === hour);
                    const maxHits = Math.max(...botTraffic.byHour.map(h => h.hitCount), 1);
                    const height = hourData ? (hourData.hitCount / maxHits) * 100 : 0;
                    return (
                      <div
                        key={hour}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title={`${hour}:00 - ${hourData?.hitCount || 0} hits`}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(height, 2)}%`,
                            background: height > 50 ? '#ef4444' : height > 25 ? '#f59e0b' : '#3b82f6',
                            borderRadius: '2px 2px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                        <span style={{ color: '#64748b', fontSize: '9px' }}>
                          {hour}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Bots Table */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '24px',
              }}>
                <div style={{
                  padding: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    🤖 Top Bots by Activity
                  </h3>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>Bot Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>Category</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>Hits</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>Confidence</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {botTraffic.byName.slice(0, 20).map((bot, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '13px' }}>{bot.name || 'Unknown'}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#60a5fa',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}>
                              {bot.category || 'unknown'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>
                            {bot.hitCount.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#f59e0b', fontSize: '13px' }}>
                            {bot.avgConfidence}%
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontSize: '12px' }}>
                            {new Date(bot.lastSeen).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {botTraffic.byName.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      No bot data available
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Bot Hits */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    📋 Recent Bot Hits (Click to inspect)
                  </h3>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {botTraffic.recentHits.map((hit, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedBotHit(hit)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        background: selectedBotHit?.id === hit.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div>
                          <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>{hit.botName || 'Unknown Bot'}</span>
                          <span style={{
                            marginLeft: '8px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                          }}>
                            {hit.category || 'unknown'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {hit.country}{hit.city ? `, ${hit.city}` : ''}
                          </span>
                          <span style={{
                            color: hit.confidence >= 80 ? '#ef4444' : hit.confidence >= 50 ? '#f59e0b' : '#3b82f6',
                            fontSize: '13px',
                            fontWeight: '600',
                          }}>
                            {hit.confidence}%
                          </span>
                        </div>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                        {hit.path} • {new Date(hit.hitTime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {botTraffic.recentHits.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      No recent bot hits
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              color: '#94a3b8',
            }}>
              Failed to load bot traffic data. Click refresh to try again.
            </div>
          )}
        </div>
      )}

      {/* Bot Hit Detail Modal */}
      {selectedBotHit && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedBotHit(null)}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 }}>
                🔍 Bot Hit Details
              </h2>
              <button
                onClick={() => setSelectedBotHit(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'grid',
              gap: '16px',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Bot Name</div>
                  <div style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600' }}>
                    {selectedBotHit.botName || 'Unknown'}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Confidence</div>
                  <div style={{
                    color: selectedBotHit.confidence >= 80 ? '#ef4444' : selectedBotHit.confidence >= 50 ? '#f59e0b' : '#3b82f6',
                    fontSize: '24px',
                    fontWeight: '700',
                  }}>
                    {selectedBotHit.confidence}%
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '16px',
              }}>
                <h4 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>
                  Request Details
                </h4>
                <div style={{ display: 'grid', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
                  <div><strong style={{ color: '#f1f5f9' }}>Category:</strong> {selectedBotHit.category || 'Unknown'}</div>
                  <div><strong style={{ color: '#f1f5f9' }}>Path:</strong> <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px' }}>{selectedBotHit.path}</code></div>
                  <div><strong style={{ color: '#f1f5f9' }}>Country:</strong> {selectedBotHit.country || 'Unknown'}</div>
                  <div><strong style={{ color: '#f1f5f9' }}>City:</strong> {selectedBotHit.city || 'Unknown'}</div>
                  <div><strong style={{ color: '#f1f5f9' }}>Time:</strong> {new Date(selectedBotHit.hitTime).toLocaleString()}</div>
                  {selectedBotHit.referrer && (
                    <div><strong style={{ color: '#f1f5f9' }}>Referrer:</strong> {selectedBotHit.referrer}</div>
                  )}
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '16px',
              }}>
                <h4 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>
                  User Agent
                </h4>
                <div style={{
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  lineHeight: '1.5',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '12px',
                  borderRadius: '4px',
                }}>
                  {selectedBotHit.userAgent}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBotHit(null)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px 20px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Recent Detections Tab */}
      {activeTab === 'detections' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{
              color: '#f1f5f9',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0,
            }}>
              Recent Bot Detections
            </h3>
            <span style={{
              color: '#94a3b8',
              fontSize: '13px',
            }}>
              Click on a detection to view details
            </span>
          </div>
          
          <div style={{
            maxHeight: '600px',
            overflowY: 'auto',
          }}>
            {detections.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#94a3b8',
              }}>
                No recent bot detections found
              </div>
            ) : (
              detections.map((detection) => (
                <div
                  key={detection.id}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onClick={() => setDetailViewDetection(detection)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}>
                    <div>
                      <div style={{
                        color: '#f1f5f9',
                        fontSize: '14px',
                        fontWeight: '500',
                        marginBottom: '4px',
                      }}>
                        User: {detection.userId} • IP: {detection.ipAddress}
                      </div>
                      <div style={{
                        color: '#94a3b8',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        marginBottom: '8px',
                      }}>
                        {detection.userAgent.length > 80 
                          ? detection.userAgent.substring(0, 80) + '...'
                          : detection.userAgent
                        }
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <div style={{
                        color: getConfidenceColor(detection.confidenceScore),
                        fontSize: '16px',
                        fontWeight: '700',
                      }}>
                        {detection.confidenceScore}%
                      </div>
                      <div style={{
                        background: getStatusColor(detection.status),
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                      }}>
                        {detection.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}>
                    {detection.detectionReasons.map((reason, index) => (
                      <span
                        key={index}
                        style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#60a5fa',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                        }}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Detection Detail Modal */}
      {detailViewDetection && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDetailViewDetection(null)}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h2 style={{
                color: '#f1f5f9',
                fontSize: '20px',
                fontWeight: '700',
                margin: 0,
              }}>
                Detection Details
              </h2>
              <button
                onClick={() => setDetailViewDetection(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Status and Confidence */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '20px',
            }}>
              <div style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Status</div>
                <div style={{
                  background: getStatusColor(detailViewDetection.status),
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  display: 'inline-block',
                }}>
                  {detailViewDetection.status.replace(/_/g, ' ')}
                </div>
              </div>
              <div style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Confidence Score</div>
                <div style={{
                  color: getConfidenceColor(detailViewDetection.confidenceScore),
                  fontSize: '28px',
                  fontWeight: '700',
                }}>
                  {detailViewDetection.confidenceScore}%
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                Basic Information
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                color: '#94a3b8',
                fontSize: '13px',
              }}>
                <div>
                  <strong style={{ color: '#f1f5f9' }}>Detection ID:</strong>
                  <div style={{ fontFamily: 'monospace', marginTop: '2px' }}>{detailViewDetection.id}</div>
                </div>
                <div>
                  <strong style={{ color: '#f1f5f9' }}>User ID:</strong>
                  <div style={{ fontFamily: 'monospace', marginTop: '2px' }}>{detailViewDetection.userId}</div>
                </div>
                <div>
                  <strong style={{ color: '#f1f5f9' }}>IP Address:</strong>
                  <div style={{ fontFamily: 'monospace', marginTop: '2px' }}>{detailViewDetection.ipAddress}</div>
                </div>
                <div>
                  <strong style={{ color: '#f1f5f9' }}>Created:</strong>
                  <div style={{ marginTop: '2px' }}>{new Date(detailViewDetection.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* User Agent */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: '600',
                margin: '0 0 8px 0',
              }}>
                User Agent
              </h4>
              <div style={{
                color: '#94a3b8',
                fontSize: '12px',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                lineHeight: '1.5',
              }}>
                {detailViewDetection.userAgent}
              </div>
            </div>

            {/* Detection Reasons */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                Detection Reasons ({detailViewDetection.detectionReasons.length})
              </h4>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {detailViewDetection.detectionReasons.map((reason, index) => (
                  <div
                    key={index}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    {reason}
                  </div>
                ))}
              </div>
            </div>

            {/* Review Info (if reviewed) */}
            {detailViewDetection.reviewedBy && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}>
                <h4 style={{
                  color: '#22c55e',
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: '0 0 8px 0',
                }}>
                  ✓ Reviewed
                </h4>
                <div style={{
                  color: '#94a3b8',
                  fontSize: '13px',
                }}>
                  <div>Reviewed by: {detailViewDetection.reviewedBy}</div>
                  {detailViewDetection.reviewedAt && (
                    <div>Reviewed at: {new Date(detailViewDetection.reviewedAt).toLocaleString()}</div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '20px',
            }}>
              {detailViewDetection.status === 'pending_review' && (
                <button
                  onClick={() => {
                    setSelectedDetection(detailViewDetection);
                    setDetailViewDetection(null);
                    setActiveTab('review');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  Review This Detection
                </button>
              )}
              <button
                onClick={() => setDetailViewDetection(null)}
                style={{
                  flex: detailViewDetection.status === 'pending_review' ? 'none' : 1,
                  padding: '12px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detection Criteria Tab */}
      {activeTab === 'criteria' && criteria && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '24px',
        }}>
          <h3 style={{
            color: '#f1f5f9',
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '20px',
          }}>
            Detection Criteria Transparency
          </h3>
          
          <div style={{
            display: 'grid',
            gap: '20px',
          }}>
            {/* Request Frequency */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                🚀 Request Frequency Analysis
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                <div>
                  <strong>Threshold:</strong> {criteria.requestFrequency.threshold} requests/min
                </div>
                <div>
                  <strong>Weight:</strong> {criteria.requestFrequency.weight} points
                </div>
              </div>
            </div>

            {/* User Agent Patterns */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                🕷️ User Agent Pattern Analysis
              </h4>
              <div style={{
                marginBottom: '12px',
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                <strong>Weight:</strong> {criteria.userAgentPatterns.weight} points
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}>
                <div>
                  <div style={{
                    color: '#f1f5f9',
                    fontSize: '13px',
                    fontWeight: '500',
                    marginBottom: '6px',
                  }}>
                    Known Bot Patterns:
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                  }}>
                    {criteria.userAgentPatterns.knownBots.map((pattern, index) => (
                      <span
                        key={index}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#f87171',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{
                    color: '#f1f5f9',
                    fontSize: '13px',
                    fontWeight: '500',
                    marginBottom: '6px',
                  }}>
                    Suspicious Patterns:
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                  }}>
                    {criteria.userAgentPatterns.suspiciousPatterns.map((pattern, index) => (
                      <span
                        key={index}
                        style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          color: '#fbbf24',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Behavior Patterns */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                🎭 Behavior Pattern Analysis
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '12px',
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                <div>
                  <strong>No JavaScript:</strong> {criteria.behaviorPatterns.noJavaScript.weight} points
                </div>
                <div>
                  <strong>Rapid Navigation:</strong> &gt;{criteria.behaviorPatterns.rapidNavigation.threshold} pages/min 
                  ({criteria.behaviorPatterns.rapidNavigation.weight} points)
                </div>
                <div>
                  <strong>Unusual Viewing:</strong> {criteria.behaviorPatterns.unusualViewingPatterns.weight} points
                </div>
              </div>
            </div>

            {/* IP Analysis */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              padding: '16px',
            }}>
              <h4 style={{
                color: '#f1f5f9',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
              }}>
                🌐 IP Address Analysis
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                <div>
                  <strong>Datacenter IPs:</strong> {criteria.ipAnalysis.datacenterIPs.weight} points
                </div>
                <div>
                  <strong>VPN Detection:</strong> {criteria.ipAnalysis.vpnDetection.weight} points
                </div>
                <div>
                  <strong>Geographic Anomalies:</strong> {criteria.ipAnalysis.geographicAnomalies.weight} points
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '6px',
            color: '#94a3b8',
            fontSize: '14px',
            lineHeight: '1.5',
          }}>
            <strong>Scoring System:</strong> Each detection criterion contributes points based on its weight. 
            The total score (0-100) determines the bot classification:
            <br />
            • <strong style={{ color: '#22c55e' }}>0-29:</strong> Confirmed Human
            • <strong style={{ color: '#3b82f6' }}>30-49:</strong> Pending Review
            • <strong style={{ color: '#f59e0b' }}>50-79:</strong> Suspected Bot
            • <strong style={{ color: '#ef4444' }}>80-100:</strong> Confirmed Bot
          </div>
        </div>
      )}

      {/* Manual Review Tab */}
      {activeTab === 'review' && (
        <div>
          {/* Success/Error Messages */}
          {reviewSuccess && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '6px',
              color: '#22c55e',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              ✓ {reviewSuccess}
            </div>
          )}
          {reviewError && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              ✗ {reviewError}
            </div>
          )}

          {/* Review Statistics */}
          {reviewStats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Total Reviews</div>
                <div style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: '700' }}>{reviewStats.totalReviews}</div>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Confirmed Bots</div>
                <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: '700' }}>{reviewStats.confirmedBots}</div>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Confirmed Humans</div>
                <div style={{ color: '#22c55e', fontSize: '20px', fontWeight: '700' }}>{reviewStats.confirmedHumans}</div>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Avg Confidence</div>
                <div style={{ color: '#60a5fa', fontSize: '20px', fontWeight: '700' }}>{reviewStats.avgReviewerConfidence}%</div>
              </div>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedDetection ? '1fr 400px' : '1fr',
            gap: '24px',
          }}>
            {/* Pending Reviews List */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                <h3 style={{
                  color: '#f1f5f9',
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: 0,
                }}>
                  Pending Manual Reviews
                </h3>
              </div>
              
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
              }}>
                {detections.filter(d => d.status === 'pending_review').length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#94a3b8',
                  }}>
                    No detections pending review
                  </div>
                ) : (
                  detections
                    .filter(d => d.status === 'pending_review')
                    .map((detection) => (
                      <div
                        key={detection.id}
                        style={{
                          padding: '16px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          background: selectedDetection?.id === detection.id 
                            ? 'rgba(59, 130, 246, 0.1)' 
                            : 'transparent',
                          transition: 'background-color 0.2s ease',
                        }}
                        onClick={() => setSelectedDetection(detection)}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}>
                          <div style={{
                            color: '#f1f5f9',
                            fontSize: '14px',
                            fontWeight: '500',
                          }}>
                            {detection.userId}
                          </div>
                          <div style={{
                            color: getConfidenceColor(detection.confidenceScore),
                            fontSize: '16px',
                            fontWeight: '700',
                          }}>
                            {detection.confidenceScore}%
                          </div>
                        </div>
                        
                        <div style={{
                          color: '#94a3b8',
                          fontSize: '12px',
                          marginBottom: '8px',
                        }}>
                          {detection.ipAddress} • {new Date(detection.createdAt).toLocaleDateString()}
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                        }}>
                          {detection.detectionReasons.slice(0, 2).map((reason, index) => (
                            <span
                              key={index}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#60a5fa',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                              }}
                            >
                              {reason.length > 30 ? reason.substring(0, 30) + '...' : reason}
                            </span>
                          ))}
                          {detection.detectionReasons.length > 2 && (
                            <span style={{
                              color: '#94a3b8',
                              fontSize: '10px',
                              padding: '2px 6px',
                            }}>
                              +{detection.detectionReasons.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Review Panel */}
            {selectedDetection && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '20px',
                height: 'fit-content',
              }}>
                <h3 style={{
                  color: '#f1f5f9',
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '16px',
                }}>
                  Manual Review
                </h3>
                
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '6px',
                }}>
                  <div style={{
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                  }}>
                    Detection Details
                  </div>
                  <div style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    lineHeight: '1.5',
                  }}>
                    <div><strong>User ID:</strong> {selectedDetection.userId}</div>
                    <div><strong>IP Address:</strong> {selectedDetection.ipAddress}</div>
                    <div><strong>Confidence:</strong> {selectedDetection.confidenceScore}%</div>
                    <div><strong>Created:</strong> {new Date(selectedDetection.createdAt).toLocaleString()}</div>
                  </div>
                  
                  <div style={{
                    marginTop: '12px',
                  }}>
                    <div style={{
                      color: '#f1f5f9',
                      fontSize: '13px',
                      fontWeight: '500',
                      marginBottom: '6px',
                    }}>
                      Detection Reasons:
                    </div>
                    {selectedDetection.detectionReasons.map((reason, index) => (
                      <div
                        key={index}
                        style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#60a5fa',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          marginBottom: '4px',
                        }}
                      >
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{
                  marginBottom: '16px',
                }}>
                  <label style={{
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'block',
                    marginBottom: '8px',
                  }}>
                    Review Decision:
                  </label>
                  <select
                    value={reviewDecision}
                    onChange={(e) => setReviewDecision(e.target.value as 'confirm_bot' | 'confirm_human' | 'needs_more_data')}
                    disabled={submittingReview}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      opacity: submittingReview ? 0.6 : 1,
                    }}
                  >
                    <option value="confirm_bot">Confirm as Bot</option>
                    <option value="confirm_human">Confirm as Human</option>
                    <option value="needs_more_data">Needs More Data</option>
                  </select>
                </div>

                <div style={{
                  marginBottom: '20px',
                }}>
                  <label style={{
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'block',
                    marginBottom: '8px',
                  }}>
                    Review Notes (Optional):
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add any additional context or reasoning for this review..."
                    disabled={submittingReview}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      resize: 'vertical',
                      opacity: submittingReview ? 0.6 : 1,
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                }}>
                  <button
                    onClick={() => submitManualReview(selectedDetection)}
                    disabled={submittingReview}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: submittingReview ? '#1e40af' : '#3b82f6',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: submittingReview ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s ease',
                      opacity: submittingReview ? 0.7 : 1,
                    }}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button
                    onClick={() => setSelectedDetection(null)}
                    disabled={submittingReview}
                    style={{
                      padding: '10px 16px',
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: submittingReview ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: submittingReview ? 0.7 : 1,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Review History */}
          {reviewHistory.length > 0 && (
            <div style={{
              marginTop: '24px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                <h3 style={{
                  color: '#f1f5f9',
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: 0,
                }}>
                  Recent Review History
                </h3>
              </div>
              
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
              }}>
                {reviewHistory.map((review, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{
                        color: '#f1f5f9',
                        fontSize: '13px',
                        fontWeight: '500',
                        marginBottom: '4px',
                      }}>
                        {review.detection.userId} • {review.detection.ipAddress}
                      </div>
                      <div style={{
                        color: '#94a3b8',
                        fontSize: '11px',
                      }}>
                        Reviewed by {review.reviewerId} • {new Date(review.reviewedAt).toLocaleString()}
                      </div>
                      {review.notes && (
                        <div style={{
                          color: '#64748b',
                          fontSize: '11px',
                          fontStyle: 'italic',
                          marginTop: '4px',
                        }}>
                          "{review.notes}"
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <div style={{
                        color: '#94a3b8',
                        fontSize: '12px',
                      }}>
                        {review.detection.originalConfidence}% → {review.confidence}%
                      </div>
                      <div style={{
                        background: review.decision === 'confirm_bot' ? '#ef4444' 
                          : review.decision === 'confirm_human' ? '#22c55e' 
                          : '#3b82f6',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                      }}>
                        {review.decision.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}