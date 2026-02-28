'use client';

/**
 * Bot Filter Controls Component
 * Provides UI controls for bot filtering options in the admin panel
 * Self-contained — manages its own bot filter state via localStorage
 */

import { useState, useEffect, useCallback } from 'react';

interface BotFilterOptions {
  includeBots: boolean;
  confidenceThreshold: number;
  showBotMetrics: boolean;
}

const defaultBotFilterOptions: BotFilterOptions = {
  includeBots: false,
  confidenceThreshold: 70,
  showBotMetrics: true,
};

function loadBotFilterOptions(): BotFilterOptions {
  if (typeof window === 'undefined') return defaultBotFilterOptions;
  try {
    const stored = localStorage.getItem('admin_bot_filter_options');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        includeBots: typeof parsed.includeBots === 'boolean' ? parsed.includeBots : defaultBotFilterOptions.includeBots,
        confidenceThreshold: typeof parsed.confidenceThreshold === 'number' ? parsed.confidenceThreshold : defaultBotFilterOptions.confidenceThreshold,
        showBotMetrics: typeof parsed.showBotMetrics === 'boolean' ? parsed.showBotMetrics : defaultBotFilterOptions.showBotMetrics,
      };
    }
  } catch { /* ignore */ }
  return defaultBotFilterOptions;
}

export default function BotFilterControls() {
  const [botFilterOptions, setBotFilterOptionsState] = useState<BotFilterOptions>(defaultBotFilterOptions);

  useEffect(() => {
    setBotFilterOptionsState(loadBotFilterOptions());
  }, []);

  const setBotFilterOptions = useCallback((options: BotFilterOptions) => {
    setBotFilterOptionsState(options);
    try { localStorage.setItem('admin_bot_filter_options', JSON.stringify(options)); } catch { /* ignore */ }
  }, []);

  const handleIncludeBotsChange = (includeBots: boolean) => {
    setBotFilterOptions({ ...botFilterOptions, includeBots });
  };

  const handleThresholdChange = (threshold: number) => {
    setBotFilterOptions({ ...botFilterOptions, confidenceThreshold: threshold });
  };

  const handleShowMetricsChange = (showBotMetrics: boolean) => {
    setBotFilterOptions({ ...botFilterOptions, showBotMetrics });
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600', margin: 0 }}>
          🤖 Bot Detection & Filtering
        </h3>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '13px', cursor: 'pointer' }}>
          <input type="checkbox" checked={botFilterOptions.includeBots} onChange={(e) => handleIncludeBotsChange(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
          Include bot traffic in analytics
        </label>

        {!botFilterOptions.includeBots && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: '#e2e8f0', fontSize: '13px', whiteSpace: 'nowrap' }}>Bot confidence threshold:</label>
            <input type="range" min="30" max="95" step="5" value={botFilterOptions.confidenceThreshold} onChange={(e) => handleThresholdChange(parseInt(e.target.value))} style={{ width: '100px', accentColor: '#3b82f6' }} />
            <span style={{ color: '#94a3b8', fontSize: '12px', minWidth: '35px' }}>{botFilterOptions.confidenceThreshold}%</span>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '13px', cursor: 'pointer' }}>
          <input type="checkbox" checked={botFilterOptions.showBotMetrics} onChange={(e) => handleShowMetricsChange(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
          Show bot detection metrics
        </label>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#94a3b8',
        lineHeight: '1.4',
      }}>
        <strong>Bot filtering:</strong> When disabled, suspected bots above the confidence threshold are excluded from analytics.
        {!botFilterOptions.includeBots && (
          <span> Currently filtering bots with ≥{botFilterOptions.confidenceThreshold}% confidence.</span>
        )}
      </div>
    </div>
  );
}
