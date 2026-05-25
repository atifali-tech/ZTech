'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import Icon from './Icon';
import { downloadCSV } from '../lib/format';

const STATUS_CONFIG = {
  'Operational':        { color: '#1F8A4A', bg: 'rgba(31,138,74,.10)',  label: 'Operational'        },
  'Setup In Progress':  { color: '#D89614', bg: 'rgba(216,150,20,.10)', label: 'Setup In Progress'  },
  'Attention Required': { color: '#C53A2B', bg: 'rgba(197,58,43,.10)',  label: 'Attention Required' },
  'Draft':              { color: '#8A92A3', bg: 'rgba(138,146,163,.10)', label: 'Draft'             },
};

const STATUS_SCORE = { 'Operational': 100, 'Setup In Progress': 60, 'Draft': 20, 'Attention Required': 0 };

function computeSetupPct(counts) {
  const checks = [
    counts.zones > 0,
    counts.gates > 0,
    counts.counters > 0,
    counts.devices > 0,
    counts.pricing_rules > 0,
    counts.users > 0,
  ];
  return (checks.filter(Boolean).length / checks.length) * 100;
}

function classifyPark(counts, hasCriticalAlert) {
  if (hasCriticalAlert || counts.pricing_rules === 0 || counts.zones === 0 || counts.users === 0) {
    return 'Attention Required';
  }
  const pct = computeSetupPct(counts);
  if (pct >= 80) return 'Operational';
  if (pct >= 20) return 'Setup In Progress';
  return 'Draft';
}

function getIssues(counts, hasCriticalAlert) {
  const issues = [];
  if (hasCriticalAlert)        issues.push({ label: 'Critical Alert Open',    sev: 0 });
  if (counts.pricing_rules === 0) issues.push({ label: 'No Pricing Configured', sev: 1 });
  if (counts.zones === 0)      issues.push({ label: 'No Zones Configured',    sev: 2 });
  if (counts.users === 0)      issues.push({ label: 'No Users Assigned',      sev: 3 });
  if (counts.gates === 0)      issues.push({ label: 'No Gates Configured',    sev: 4 });
  if (counts.counters === 0)   issues.push({ label: 'No Counters Configured', sev: 5 });
  if (counts.devices === 0)    issues.push({ label: 'No Devices Configured',  sev: 6 });
  return issues;
}

export default function ParkHealthWidget({ parks = [], filters = {} }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRef = useRef(null);
  fetchRef.current = async (parkList) => {
    if (!parkList.length) { setRows([]); return; }
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        parkList.map(p =>
          Promise.allSettled([
            api.parkSummary(p.id),
            api.alerts({ park_id: p.id, status: 'open', severity: 'critical', limit: 1 }),
          ]).then(([sr, ar]) => ({
            park: p,
            counts: sr.status === 'fulfilled' ? sr.value.counts : null,
            hasCritical: ar.status === 'fulfilled' && Array.isArray(ar.value) && ar.value.length > 0,
          }))
        )
      );
      const parsed = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(r => r.counts !== null)
        .map(r => {
          const status = classifyPark(r.counts, r.hasCritical);
          const issues = getIssues(r.counts, r.hasCritical);
          return { park: r.park, status, issues, hasCritical: r.hasCritical };
        });
      setRows(parsed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Filter parks by applied filter scope (parks array, state, cities)
    let visible = parks;
    if (filters.parks && filters.parks.length > 0) {
      visible = parks.filter(p => filters.parks.includes(p.name));
    } else if (filters.state && filters.state !== 'All States') {
      visible = parks.filter(p => p.state === filters.state);
      if (filters.cities && filters.cities.length > 0) {
        visible = visible.filter(p => filters.cities.includes(p.city));
      }
    }
    fetchRef.current?.(visible);
  }, [parks, filters]);

  // Aggregate counts
  const counts = { 'Operational': 0, 'Setup In Progress': 0, 'Attention Required': 0, 'Draft': 0 };
  rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  const score = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + STATUS_SCORE[r.status], 0) / (rows.length * 100) * 100)
    : null;

  const scoreColor = score == null ? 'var(--ink-4)'
    : score >= 80 ? '#1F8A4A'
    : score >= 50 ? '#D89614'
    : '#C53A2B';

  const attentionParks = rows
    .filter(r => r.issues.length > 0)
    .sort((a, b) => a.issues[0].sev - b.issues[0].sev)
    .slice(0, 5);

  const handleExport = () => {
    downloadCSV(
      'park-health.csv',
      ['Park', 'Status', 'Primary Issue'],
      rows.map(r => [r.park.name, r.status, r.issues[0]?.label || '—'])
    );
  };

  return (
    <div className="sec" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div className="sec-head">
        <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="shield" size={13} color="var(--ink-3)"/>
          Park Health
        </div>
        <div className="sec-actions">
          <button className="btn btn-sm icon-btn" title="Download CSV" onClick={handleExport} disabled={!rows.length}>
            <Icon name="download" size={13}/>
          </button>
        </div>
      </div>

      {/* Status board */}
      <div style={{ padding: '10px 16px 0' }}>
        {loading && !rows.length ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12, padding: '16px 0' }}>Loading…</div>
        ) : !rows.length ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12, padding: '8px 0' }}>No parks in scope</div>
        ) : (
          <>
            {/* Status grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: cfg.bg, borderRadius: 6, padding: '6px 10px',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: cfg.color, flexShrink: 0,
                  }}/>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', flex: 1, lineHeight: 1.2 }}>{cfg.label}</span>
                  <span style={{
                    fontSize: 16, fontWeight: 700, color: cfg.color,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>{counts[key]}</span>
                </div>
              ))}
            </div>

            {/* Health score */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Overall Health Score
              </span>
              <span style={{
                fontSize: 20, fontWeight: 800, color: scoreColor,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {score != null ? `${score}%` : '—'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Attention Required section */}
      {attentionParks.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, padding: '8px 16px 12px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#C53A2B',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6,
          }}>
            Attention Required
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attentionParks.map(r => (
              <div key={r.park.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '4px 0',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: r.park.color || '#8A92A3',
                  flexShrink: 0, marginTop: 4,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.park.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {r.issues[0]?.label}
                    {r.issues.length > 1 && (
                      <span style={{ color: 'var(--ink-5)', marginLeft: 4 }}>
                        +{r.issues.length - 1} more
                      </span>
                    )}
                  </div>
                </div>
                {r.hasCritical && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#C53A2B',
                    background: 'rgba(197,58,43,.1)', borderRadius: 3,
                    padding: '1px 5px', flexShrink: 0,
                  }}>ALERT</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All good state */}
      {rows.length > 0 && attentionParks.length === 0 && (
        <div style={{
          borderTop: '1px solid var(--border)', marginTop: 4,
          padding: '10px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#1F8A4A', fontSize: 12,
        }}>
          <Icon name="check" size={13} color="#1F8A4A"/>
          All parks operational — no issues detected
        </div>
      )}

      {loading && rows.length > 0 && (
        <div style={{ padding: '4px 16px 8px', fontSize: 11, color: 'var(--ink-5)' }}>Refreshing…</div>
      )}
    </div>
  );
}
