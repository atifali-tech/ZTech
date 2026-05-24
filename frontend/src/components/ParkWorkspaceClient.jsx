'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter }              from 'next/navigation';
import Sidebar                    from './Sidebar';
import Topbar                     from './Topbar';
import Icon                       from './Icon';
import Toast                      from './Toast';
import { useAuth }                from '../lib/auth-context';

import ParkWorkspaceOverview      from './ParkWorkspaceOverview';
import ParkWorkspaceOperations    from './ParkWorkspaceOperations';
import ParkWorkspacePricing       from './ParkWorkspacePricing';
import ParkWorkspaceUsers         from './ParkWorkspaceUsers';
import ParkWorkspaceFinance       from './ParkWorkspaceFinance';
import ParkWorkspaceAnalytics     from './ParkWorkspaceAnalytics';
import ParkWorkspaceSettings      from './ParkWorkspaceSettings';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: 'grid'     },
  { id: 'operations',  label: 'Operations',  icon: 'activity' },
  { id: 'pricing',     label: 'Pricing',     icon: 'ticket'   },
  { id: 'users',       label: 'Users',       icon: 'users'    },
  { id: 'finance',     label: 'Finance',     icon: 'money'    },
  { id: 'analytics',   label: 'Analytics',   icon: 'chart'    },
  { id: 'settings',    label: 'Settings',    icon: 'cog'      },
];

const QUICK_ACTIONS = [
  { label: 'Add Zone',          icon: 'map',      tab: 'operations', section: 'zones'      },
  { label: 'Add Gate',          icon: 'activity', tab: 'operations', section: 'gates'      },
  { label: 'Add Counter',       icon: 'grid',     tab: 'operations', section: 'counters'   },
  { label: 'Add Device',        icon: 'shield',   tab: 'operations', section: 'devices'    },
  { label: 'Assign User',       icon: 'users',    tab: 'users',      section: null         },
  { label: 'Pricing',           icon: 'ticket',   tab: 'pricing',    section: null         },
];

// Derive a health status from setup % and alert presence
function getHealthStatus(pct, hasAlerts) {
  if (hasAlerts) return { label: 'Attention Required', color: 'var(--red)',    bg: 'rgba(226,75,74,.10)'  };
  if (pct <= 20)  return { label: 'Draft',             color: 'var(--ink-4)', bg: 'var(--surface-2)'     };
  if (pct <= 80)  return { label: 'Setup In Progress', color: '#D89614',      bg: 'rgba(216,150,20,.10)' };
  return              { label: 'Operational',          color: 'var(--teal)',  bg: 'var(--teal-50)'       };
}

export default function ParkWorkspaceClient({ parkId }) {
  const router = useRouter();
  const { can } = useAuth();

  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [tab,     setTab]       = useState('overview');
  // section: string | null — used by Operations to auto-scroll
  const [section, setSection]   = useState(null);
  const [toast,   setToast]     = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/parks/${parkId}/summary`);
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId]);

  // Navigate to a tab, optionally scrolling to a named section within it
  const goToTab = (tabId, sectionId = null) => {
    setSection(sectionId);
    setTab(tabId);
  };

  const handleParkSaved = (saved) => {
    setSummary(prev => prev ? { ...prev, park: { ...prev.park, ...saved } } : prev);
    showToast('Park details saved');
  };

  const handleSettingsSaved = (saved) => {
    setSummary(prev => prev ? { ...prev, settings: saved } : prev);
    showToast('Settings saved');
  };

  const park        = summary?.park;
  const counts      = summary?.counts;
  const settings    = summary?.settings;
  const parkManager = summary?.park_manager;

  // Setup % for health badge (7 checklist items)
  const pricingConfigured = (counts?.pricing_rules ?? 0) > 0;
  const checklistDone = [
    !!(settings && (settings.supports_entry_tracking || settings.supports_devices || settings.supports_zones || settings.supports_shifts || settings.supports_gates)),
    (counts?.zones    ?? 0) > 0,
    (counts?.gates    ?? 0) > 0,
    (counts?.counters ?? 0) > 0,
    (counts?.devices  ?? 0) > 0,
    (counts?.users    ?? 0) > 0,
    pricingConfigured,
  ].filter(Boolean).length;
  const setupPct = summary ? Math.round((checklistDone / 7) * 100) : 0;
  const health   = getHealthStatus(setupPct, false);

  if (loading) {
    return (
      <div className="app">
        <Sidebar active="parks"/>
        <div className="main">
          <Topbar current="Park Workspace" icon="map"/>
          <div className="canvas">
            <div className="page-loading">
              <div className="page-loading-spinner"/>
              <span className="page-loading-text">Loading workspace…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <Sidebar active="parks"/>
        <div className="main">
          <Topbar current="Park Workspace" icon="map"/>
          <div className="canvas">
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Icon name="warning" size={32} color="var(--red)"/>
              <div style={{ marginTop: 12, fontSize: 14, color: 'var(--red)' }}>{error}</div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }}
                onClick={() => router.push('/admin/parks')}>
                ← Back to Parks
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar active="parks"/>
      <div className="main">

        {/* ── Sticky workspace header ── */}
        <div style={{
          borderBottom: '1px solid var(--border)',
          padding: '16px 24px 0',
          background: 'var(--surface)',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: 'var(--ink-4)' }}>
            <button
              onClick={() => router.push('/admin/parks')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 0, fontSize: 12 }}>
              Parks
            </button>
            <span>›</span>
            <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{park?.name}</span>
          </div>

          {/* Park identity + KPIs row + Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            {/* Colour dot */}
            <div style={{
              width: 40, height: 40, borderRadius: 8, flexShrink: 0,
              background: park?.color_hex || '#8A92A3',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="map" size={18} color="#fff"/>
            </div>

            {/* Name + location + badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{park?.name}</span>
                <span className="mono" style={{
                  fontSize: 11, color: 'var(--ink-4)',
                  background: 'var(--surface-2)', padding: '2px 6px',
                  borderRadius: 4, border: '1px solid var(--border)',
                }}>{park?.id}</span>

                {/* Health badge */}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  color: health.color, background: health.bg,
                  border: `1px solid ${health.color}30`,
                }}>
                  {health.label}
                </span>

                {(counts?.shifts_open ?? 0) > 0 && (
                  <span className="tag green" style={{ fontSize: 10 }}>
                    {counts.shifts_open} shift{counts.shifts_open > 1 ? 's' : ''} open
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                {[park?.city, park?.state].filter(Boolean).join(', ')}
                {park?.capacity ? ` · Capacity ${park.capacity.toLocaleString()}` : ''}
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
              {[
                { label: 'Zones',    val: counts?.zones    ?? '—' },
                { label: 'Counters', val: counts?.counters ?? '—' },
                { label: 'Devices',  val: counts?.devices  ?? '—' },
                { label: 'Users',    val: counts?.users    ?? '—' },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Quick Actions — permission-gated */}
            {can('parks.edit') && (
              <div style={{
                display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0,
                borderLeft: '1px solid var(--border)', paddingLeft: 16,
              }}>
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.label}
                    className="btn btn-ghost btn-sm"
                    title={a.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', fontSize: 12 }}
                    onClick={() => goToTab(a.tab, a.section)}
                  >
                    <Icon name={a.icon} size={12} color="var(--ink-3)"/>
                    <span style={{ whiteSpace: 'nowrap' }}>{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tab nav */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => goToTab(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 16px',
                  fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--teal)' : 'var(--ink-3)',
                  borderBottom: tab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'color .15s',
                }}
              >
                <Icon name={t.icon} size={13} color={tab === t.id ? 'var(--teal)' : 'var(--ink-4)'}/>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="canvas" style={{ paddingTop: 20 }}>
          {tab === 'overview'   && (
            <ParkWorkspaceOverview
              parkId={parkId} park={park} counts={counts} settings={settings}
              parkManager={parkManager}
              pricingConfigured={pricingConfigured}
              onGoToSettings={() => goToTab('settings')}
              onGoToTab={goToTab}
            />
          )}
          {tab === 'operations' && (
            <ParkWorkspaceOperations parkId={parkId} scrollToSection={section}/>
          )}
          {tab === 'pricing'    && <ParkWorkspacePricing    parkId={parkId}/>}
          {tab === 'users'      && <ParkWorkspaceUsers      parkId={parkId}/>}
          {tab === 'finance'    && <ParkWorkspaceFinance    parkId={parkId}/>}
          {tab === 'analytics'  && <ParkWorkspaceAnalytics  parkId={parkId} park={park}/>}
          {tab === 'settings'   && (
            <ParkWorkspaceSettings
              parkId={parkId} park={park} settings={settings}
              onParkSaved={handleParkSaved}
              onSettingsSaved={handleSettingsSaved}
            />
          )}
        </div>
      </div>

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
