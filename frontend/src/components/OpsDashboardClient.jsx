'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import Icon    from './Icon';
import Toast   from './Toast';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const SEV_TAG = {
  critical: 'tag sev-critical',
  high:     'tag sev-high',
  medium:   'tag sev-medium',
  low:      'tag sev-low',
  info:     'tag sev-info',
};
const SEV_DOT = {
  critical: '#D51D1D',
  high:     '#D89614',
  medium:   '#1677ff',
  low:      'var(--ink-4)',
  info:     'var(--ink-4)',
};
const STATUS_COLOR = {
  normal:          'var(--green)',
  warning:         '#D89614',
  critical:        '#D51D1D',
  disabled:        'var(--ink-5)',
  no_capacity_set: 'var(--ink-4)',
  unknown:         'var(--ink-4)',
};

const EVT_LABELS = {
  shift_opened:              { label: 'Shift Opened',       icon: 'lock',      color: 'var(--green)' },
  shift_closed:              { label: 'Shift Closed',       icon: 'lock',      color: 'var(--ink-4)' },
  shift_reconciled:          { label: 'Reconciled',         icon: 'check',     color: 'var(--green)' },
  shift_variance_flagged:    { label: 'Variance Flagged',   icon: 'warning',   color: '#D51D1D'      },
  device_assigned:           { label: 'Device Assigned',    icon: 'shield',    color: 'var(--green)' },
  device_unassigned:         { label: 'Device Unassigned',  icon: 'shield',    color: 'var(--ink-4)' },
  device_blocked:            { label: 'Device Blocked',     icon: 'shield',    color: '#D51D1D'      },
  device_maintenance:        { label: 'Device Maintenance', icon: 'cog',       color: '#D89614'      },
  gate_enabled:              { label: 'Gate Enabled',       icon: 'ticket',    color: 'var(--green)' },
  gate_disabled:             { label: 'Gate Disabled',      icon: 'ticket',    color: 'var(--ink-4)' },
  gate_congested:            { label: 'Gate Congested',     icon: 'warning',   color: '#D89614'      },
  gate_maintenance:          { label: 'Gate Maintenance',   icon: 'cog',       color: '#D89614'      },
  counter_activated:         { label: 'Counter Active',     icon: 'grid',      color: 'var(--green)' },
  counter_deactivated:       { label: 'Counter Deactivated',icon: 'grid',      color: 'var(--ink-4)' },
  counter_maintenance:       { label: 'Counter Maintenance',icon: 'cog',       color: '#D89614'      },
  occupancy_entry_recorded:  { label: 'Entry',              icon: 'arrowDown', color: 'var(--green)' },
  occupancy_exit_recorded:   { label: 'Exit',               icon: 'arrowUp',   color: 'var(--ink-4)' },
  incident_created:          { label: 'Incident Created',   icon: 'xCircle',   color: '#D51D1D'      },
  incident_resolved:         { label: 'Incident Resolved',  icon: 'check',     color: 'var(--green)' },
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmtCurrency(n) {
  const v = parseFloat(n) || 0;
  return v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v.toFixed(0)}`;
}

function tsLabel(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function KpiChip({ label, value, color = 'var(--ink)', sub, danger, warn }) {
  const bg = danger ? 'rgba(213,29,29,.07)' : warn ? 'rgba(216,150,20,.08)' : 'var(--surface)';
  const fg = danger ? '#D51D1D' : warn ? '#B87313' : color;
  return (
    <div style={{ background: bg, border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: fg, lineHeight: 1.1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>
      {children}
    </div>
  );
}

function OccupancyBar({ pct, status }) {
  const fill = STATUS_COLOR[status] || 'var(--ink-4)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--canvas)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct || 0)}%`, height: '100%', background: fill, borderRadius: 3, transition: 'width .4s' }}/>
      </div>
      <span style={{ fontSize: 11, color: fill, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
        {pct != null ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

function SkeletonKpi({ cols = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 70, borderRadius: 8 }}/>
      ))}
    </div>
  );
}

export default function OpsDashboardClient() {
  useAuth();
  const [data,       setData]       = useState(null);
  const [parks,      setParks]      = useState([]);
  const [parkFilter, setParkFilter] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast,      setToast]      = useState({ msg: null, type: 'ok' });

  const showToast = (msg, type = 'error') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const qs = parkFilter ? `?park_id=${encodeURIComponent(parkFilter)}` : '';
      const [d, p] = await Promise.all([
        apiFetch(`/api/operations/dashboard${qs}`),
        apiFetch('/api/parks'),
      ]);
      setData(d); setParks(p);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkFilter]);

  useEffect(() => {
    const id = setInterval(() => { fetchRef.current?.(true); }, 60000);
    return () => clearInterval(id);
  }, []);

  const c  = data?.counters      || {};
  const s  = data?.shifts        || {};
  const dv = data?.devices       || {};
  const g  = data?.gates         || {};
  const as = data?.alert_summary || {};
  const alerts    = data?.alerts           || [];
  const incidents = data?.incidents        || [];
  const occupancy = data?.occupancy        || [];
  const activity  = data?.recent_activity  || [];

  const hasIssues = parseInt(as.critical) > 0 || parseInt(as.high) > 0
    || parseInt(dv.offline_devices) > 0 || parseInt(s.variance_flagged) > 0;

  return (
    <div className="app">
      <Sidebar active="op-dashboard"/>
      <div className="main">
        <Topbar current="Operations Command Center" icon="activity"/>
        <div className="canvas">

          {/* Header bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {hasIssues && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                background: 'rgba(213,29,29,.08)', border: '1px solid rgba(213,29,29,.25)',
                borderRadius: 6, fontSize: 12, color: '#D51D1D', fontWeight: 600,
              }}>
                <Icon name="warning" size={13} color="#D51D1D"/>
                {parseInt(as.critical) > 0
                  ? `${as.critical} critical alert${as.critical > 1 ? 's' : ''} require attention`
                  : 'Issues detected — review alerts'}
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {refreshing && <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Refreshing…</span>}
              <select className="filter-select" style={{ width: 180 }}
                value={parkFilter} onChange={e => setParkFilter(e.target.value)}>
                <option value="">All Parks</option>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => fetchRef.current?.(true)}>
                <Icon name="activity" size={12}/> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SkeletonKpi cols={4}/>
              <SkeletonKpi cols={5}/>
              <SkeletonKpi cols={4}/>
            </div>
          ) : (
            <>
              {/* Revenue + Transaction summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 0 }}>
                <KpiChip label="Revenue Today"     value={fmtCurrency(s.revenue_today)} color="var(--green)"/>
                <KpiChip label="Live Transactions" value={s.live_transactions}          color="var(--ink)"/>
                <KpiChip label="Closed Today"      value={s.closed_today}               color="var(--ink)"/>
                <KpiChip label="Reconciled Today"  value={s.reconciled_today}           color="var(--green)"/>
              </div>

              <SectionLabel>Counters</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
                <KpiChip label="Active"       value={c.active_counters}      color="var(--green)"/>
                <KpiChip label="Shift Open"   value={c.shift_open_counters}  color="var(--green)"/>
                <KpiChip label="Idle"         value={c.idle_counters}        warn={parseInt(c.idle_counters) > 2}/>
                <KpiChip label="Maintenance"  value={c.maintenance_counters} danger={parseInt(c.maintenance_counters) > 0}/>
                <KpiChip label="Total Active" value={c.total_active}         color="var(--ink)"/>
              </div>

              <SectionLabel>Shifts</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                <KpiChip label="Open Shifts"      value={s.open_shifts}      color="var(--green)"/>
                <KpiChip label="Variance Flagged" value={s.variance_flagged} danger={parseInt(s.variance_flagged) > 0}/>
                <KpiChip label="Closed Today"     value={s.closed_today}     color="var(--ink)"/>
                <KpiChip label="Reconciled Today" value={s.reconciled_today} color="var(--green)"/>
              </div>

              <SectionLabel>Devices</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
                <KpiChip label="Online"      value={dv.online_devices}      color="var(--green)"/>
                <KpiChip label="Offline"     value={dv.offline_devices}     danger={parseInt(dv.offline_devices) > 0}/>
                <KpiChip label="Stale"       value={dv.stale_devices}       warn={parseInt(dv.stale_devices) > 0}/>
                <KpiChip label="Blocked"     value={dv.blocked_devices}     danger={parseInt(dv.blocked_devices) > 0}/>
                <KpiChip label="Maintenance" value={dv.maintenance_devices} warn={parseInt(dv.maintenance_devices) > 0}/>
                <KpiChip label="Outdated"    value={dv.outdated_devices}    warn={parseInt(dv.outdated_devices) > 0}/>
              </div>

              <SectionLabel>Gates</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                <KpiChip label="Active"           value={g.active_gates}           color="var(--green)"/>
                <KpiChip label="Inactive"         value={g.inactive_gates}         warn={parseInt(g.inactive_gates) > 0}/>
                <KpiChip label="Congested"        value={g.congested_gates}        danger={parseInt(g.congested_gates) > 0}/>
                <KpiChip label="Maintenance"      value={g.maintenance_gates}      warn={parseInt(g.maintenance_gates) > 0}/>
                <KpiChip label="Throughput Today" value={g.total_throughput_today} color="var(--ink)"/>
              </div>

              {/* Alerts | Incidents | Occupancy */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginTop: 20 }}>

                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="warning" size={13} color={parseInt(as.critical) > 0 ? '#D51D1D' : 'var(--ink-4)'}/>
                      Alerts
                      {parseInt(as.critical) > 0 && <span className="tag sev-critical">{as.critical} critical</span>}
                      {!parseInt(as.critical) && parseInt(as.high) > 0 && <span className="tag sev-high">{as.high} high</span>}
                    </div>
                    <a href="/admin/operations/alerts" style={{ fontSize: 11, color: 'var(--teal)' }}>View all</a>
                  </div>
                  <div className="sec-body" style={{ padding: '0 16px' }}>
                    {alerts.length === 0 ? (
                      <div className="empty-state" style={{ padding: '20px 0' }}>
                        <div className="empty-state-icon"><Icon name="checkCircle" size={24} color="var(--green)"/></div>
                        <div className="empty-state-title">No active alerts</div>
                      </div>
                    ) : alerts.slice(0, 8).map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: SEV_DOT[a.severity] || 'var(--ink-4)', marginTop: 5, flexShrink: 0 }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{a.alert_type.replace(/_/g, ' ')} · {tsLabel(a.created_at)}</div>
                        </div>
                        <span className={SEV_TAG[a.severity] || 'tag'}>{a.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="xCircle" size={13} color={incidents.length > 0 ? '#D51D1D' : 'var(--ink-4)'}/>
                      Incidents
                      {incidents.length > 0 && <span className="tag red">{incidents.length} open</span>}
                    </div>
                    <a href="/admin/operations/incidents" style={{ fontSize: 11, color: 'var(--teal)' }}>View all</a>
                  </div>
                  <div className="sec-body" style={{ padding: '0 16px' }}>
                    {incidents.length === 0 ? (
                      <div className="empty-state" style={{ padding: '20px 0' }}>
                        <div className="empty-state-icon"><Icon name="checkCircle" size={24} color="var(--green)"/></div>
                        <div className="empty-state-title">No active incidents</div>
                      </div>
                    ) : incidents.slice(0, 8).map(inc => (
                      <div key={inc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: SEV_DOT[inc.severity] || 'var(--ink-4)', marginTop: 5, flexShrink: 0 }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inc.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>
                            {inc.incident_type.replace(/_/g, ' ')}{inc.assigned_to_name ? ` · ${inc.assigned_to_name}` : ''}
                          </div>
                        </div>
                        <span className={inc.status === 'investigating' ? 'tag blue' : 'tag red'}>{inc.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="users" size={13} color="var(--ink-4)"/>
                      Occupancy
                    </div>
                  </div>
                  <div className="sec-body" style={{ padding: '0 16px' }}>
                    {occupancy.length === 0 ? (
                      <div className="empty-state" style={{ padding: '20px 0' }}>
                        <div className="empty-state-title">No occupancy data</div>
                        <div className="empty-state-sub">Enable occupancy tracking in park settings</div>
                      </div>
                    ) : occupancy.map(o => (
                      <div key={o.park_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                            {parks.find(p => p.id === o.park_id)?.name || o.park_id}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[o.status] || 'var(--ink-4)' }}>
                            {o.current_occupancy}{o.capacity > 0 ? ` / ${o.capacity}` : ''}
                          </span>
                        </div>
                        <OccupancyBar pct={o.occupancy_pct} status={o.status}/>
                        <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 3 }}>
                          {o.entries_today} entries · {o.exits_today} exits · {o.tracking_mode} mode
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="sec" style={{ marginTop: 14 }}>
                <div className="sec-head">
                  <div className="sec-title">Recent Operational Activity</div>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Last {activity.length} events</span>
                </div>
                <div className="sec-body" style={{ padding: 0 }}>
                  {activity.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon"><Icon name="clock" size={28}/></div>
                      <div className="empty-state-title">No recent activity</div>
                      <div className="empty-state-sub">Operational events will appear here as they occur</div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Park</th>
                            <th>Target</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.map((ev, i) => {
                            const meta = EVT_LABELS[ev.event_type] || { label: ev.event_type, icon: 'activity', color: 'var(--ink-4)' };
                            return (
                              <tr key={i}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Icon name={meta.icon} size={12} color={meta.color}/>
                                    <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{ev.park_id || '—'}</td>
                                <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                                  {ev.target_type && ev.target_id ? `${ev.target_type} ${String(ev.target_id).slice(0, 8)}…` : '—'}
                                </td>
                                <td style={{ fontSize: 11, color: 'var(--ink-5)' }}>{tsLabel(ev.recorded_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
