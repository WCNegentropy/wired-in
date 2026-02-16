import { useState, useEffect, useCallback } from 'react';
import { useWiredInStore } from '../store';
import { BarChart3, ExternalLink, X, Download } from 'lucide-react';
import * as api from '../lib/api';

const platformColors: Record<string, string> = {
  reddit: '#ff4500',
  youtube: '#ff0000',
  x: '#1d9bf0',
  rss: '#ee802f',
  news: '#8b8b8b',
};

type Period = '7' | '30' | 'all';

const periodLabels: Record<Period, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  all: 'All time',
};

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AnalyticsPanel() {
  const {
    analyticsData,
    analyticsPanelOpen,
    setAnalyticsPanelOpen,
    loadAnalytics,
    activeWorkspaceId,
    addToast,
  } = useWiredInStore();

  const [period, setPeriod] = useState<Period>('30');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (analyticsPanelOpen && activeWorkspaceId) {
      loadAnalytics(activeWorkspaceId, period);
    }
  }, [analyticsPanelOpen, activeWorkspaceId, period, loadAnalytics]);

  const handlePeriodChange = useCallback((newPeriod: Period) => {
    setPeriod(newPeriod);
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setExporting(true);
    try {
      const blob = await api.exportAnalyticsCsv(activeWorkspaceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${activeWorkspaceId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Analytics exported', 'success');
    } catch (err) {
      addToast(
        `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setExporting(false);
    }
  }, [activeWorkspaceId, addToast]);

  if (!analyticsPanelOpen) return null;

  const data = analyticsData;
  const maxDailyCount = data?.dailyClicks
    ? Math.max(...data.dailyClicks.map((d) => d.count), 1)
    : 1;

  return (
    <>
      <div
        className="analytics-panel-overlay"
        onClick={() => setAnalyticsPanelOpen(false)}
      />
      <div className={`analytics-panel ${analyticsPanelOpen ? 'analytics-panel--open' : ''}`}>
        {/* Header */}
        <div className="analytics-panel__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} />
            <span className="analytics-panel__title">Content Analytics</span>
          </div>
          <button
            className="modal__close"
            onClick={() => setAnalyticsPanelOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Period Selector */}
        <div className="analytics-panel__section">
          <div className="analytics-panel__period-selector">
            {(['7', '30', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                className={`btn btn--sm ${period === p ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => handlePeriodChange(p)}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="analytics-panel__content">
          {!data ? (
            <div className="analytics-panel__empty">
              <BarChart3 size={32} />
              <p>No analytics data available</p>
              <p style={{ fontSize: '0.8rem' }}>
                Click on content items to start tracking engagement.
              </p>
            </div>
          ) : (
            <>
              {/* Total Clicks */}
              <div className="analytics-panel__section">
                <div className="analytics-panel__stat">
                  <span className="analytics-panel__stat-value">{data.totalClicks}</span>
                  <span className="analytics-panel__stat-label">Total Clicks</span>
                </div>
              </div>

              {/* Platform Breakdown */}
              <div className="analytics-panel__section">
                <h3 className="analytics-panel__section-title">Platform Breakdown</h3>
                {data.platformBreakdown.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No platform data yet.
                  </p>
                ) : (
                  <div className="analytics-panel__bars">
                    {data.platformBreakdown.map((pb) => (
                      <div key={pb.platform} className="analytics-bar">
                        <div className="analytics-bar__label">
                          <span
                            className="analytics-bar__platform"
                            style={{ color: platformColors[pb.platform] || 'var(--text-muted)' }}
                          >
                            {pb.platform}
                          </span>
                          <span className="analytics-bar__count">
                            {pb.count} ({pb.percentage}%)
                          </span>
                        </div>
                        <div className="analytics-bar__track">
                          <div
                            className="analytics-bar__fill"
                            style={{
                              width: `${pb.percentage}%`,
                              backgroundColor:
                                platformColors[pb.platform] || 'var(--accent)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Clicked Content */}
              <div className="analytics-panel__section">
                <h3 className="analytics-panel__section-title">Top Clicked Content</h3>
                {data.topContent.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No content clicks recorded yet.
                  </p>
                ) : (
                  <ol className="analytics-panel__top-list">
                    {data.topContent.map((item, index) => (
                      <li key={item.contentId} className="analytics-panel__top-item">
                        <span className="analytics-panel__top-rank">{index + 1}</span>
                        <div className="analytics-panel__top-body">
                          <div className="analytics-panel__top-title">
                            {item.title || 'Untitled'}
                          </div>
                          <div className="analytics-panel__top-meta">
                            <span
                              className="analytics-panel__badge"
                              style={{
                                backgroundColor:
                                  platformColors[item.platform] || 'var(--text-muted)',
                              }}
                            >
                              {item.platform}
                            </span>
                            <span className="analytics-panel__click-count">
                              {item.clickCount} click{item.clickCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tile-card__btn"
                          title="Open"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Daily Activity */}
              <div className="analytics-panel__section">
                <h3 className="analytics-panel__section-title">Daily Activity</h3>
                {data.dailyClicks.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No daily activity data.
                  </p>
                ) : (
                  <div className="analytics-panel__daily-chart">
                    {data.dailyClicks.map((day) => (
                      <div key={day.day} className="analytics-panel__daily-bar">
                        <div className="analytics-panel__daily-bar-wrapper">
                          <div
                            className="analytics-bar__fill"
                            style={{
                              height: `${(day.count / maxDailyCount) * 100}%`,
                              width: '100%',
                              backgroundColor: 'var(--accent)',
                            }}
                            title={`${formatDay(day.day)}: ${day.count} click${day.count !== 1 ? 's' : ''}`}
                          />
                        </div>
                        <span className="analytics-panel__daily-label">
                          {formatDay(day.day)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="analytics-panel__footer">
          <button
            className="btn btn--sm btn--ghost"
            onClick={handleExportCsv}
            disabled={exporting || !data}
            style={{ width: '100%' }}
          >
            <Download size={14} /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
    </>
  );
}
