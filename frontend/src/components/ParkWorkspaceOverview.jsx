'use client';
import Icon    from './Icon';
import { useAuth } from '../lib/auth-context';

function KpiBox({ value, label, sub, warn, onClick }) {
  return (
    <div
      className="fin-kpi"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer', transition: 'box-shadow .15s, border-color .15s' } : {}}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = ''; }}
    >
      <div className="fin-kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {onClick && <Icon name="chevronR" size={10} color="var(--ink-5)"/>}
      </div>
      <div className="fin-kpi-val" style={warn ? { color: 'var(--red)' } : {}}>{value}</div>
      {sub && <div className="fin-kpi-sub">{sub}</div>}
    </div>
  );
}

function ChecklistItem({ label, done, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? 'var(--teal)' : 'var(--surface-2)',
        border: done ? 'none' : '1px solid var(--border)',
      }}>
        {done
          ? <Icon name="check" size={11} color="#fff"/>
          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-5)' }}/>
        }
      </div>
      <span style={{ flex: 1, fontSize: 13, color: done ? 'var(--ink-2)' : 'var(--ink-4)' }}>{label}</span>
      {!done && action && onAction && (
        <button className="btn btn-sm btn-ghost" onClick={onAction} style={{ fontSize: 11, padding: '3px 8px' }}>
          {action} →
        </button>
      )}
      {done && <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>Done</span>}
    </div>
  );
}

export default function ParkWorkspaceOverview({ parkId, park, counts, settings, onGoToSettings, onGoToTab }) {
  const { can } = useAuth();

  // Pricing is always "pending" until the pricing engine is implemented
  const pricingConfigured = false;

  const checklistItems = [
    {
      label:    'Capabilities configured',
      done:     !!(settings && (settings.supports_entry_tracking || settings.supports_devices || settings.supports_zones || settings.supports_shifts || settings.supports_gates)),
      action:   'Configure',
      onAction: onGoToSettings,
    },
    {
      label:    'Zone created',
      done:     (counts?.zones ?? 0) > 0,
      action:   'Add Zone',
      onAction: () => onGoToTab?.('operations', 'zones'),
    },
    {
      label:    'Gate configured',
      done:     (counts?.gates ?? 0) > 0,
      action:   'Add Gate',
      onAction: () => onGoToTab?.('operations', 'gates'),
    },
    {
      label:    'Counter created',
      done:     (counts?.counters ?? 0) > 0,
      action:   'Add Counter',
      onAction: () => onGoToTab?.('operations', 'counters'),
    },
    {
      label:    'Device assigned',
      done:     (counts?.devices ?? 0) > 0,
      action:   'Add Device',
      onAction: () => onGoToTab?.('operations', 'devices'),
    },
    {
      label:    'User assigned',
      done:     (counts?.users ?? 0) > 0,
      action:   'Assign User',
      onAction: () => onGoToTab?.('users'),
    },
    {
      label:    pricingConfigured ? 'Pricing configured' : 'Pricing pending',
      done:     pricingConfigured,
      action:   'View Pricing',
      onAction: () => onGoToTab?.('pricing'),
    },
  ];

  const doneCount = checklistItems.filter(s => s.done).length;
  const total     = checklistItems.length;
  const pct       = Math.round((doneCount / total) * 100);
  const allDone   = doneCount === total;

  return (
    <>
      {/* ── Setup progress banner ── */}
      <div style={{
        background: allDone ? 'var(--teal-50)' : 'var(--surface-2)',
        border: `1px solid ${allDone ? 'var(--teal-100)' : 'var(--border)'}`,
        borderRadius: 8, padding: '14px 16px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: allDone ? 0 : 10 }}>
          <Icon name={allDone ? 'checkCircle' : 'warning'} size={16} color={allDone ? 'var(--teal)' : '#D89614'}/>
          <span style={{ fontWeight: 600, fontSize: 13, color: allDone ? 'var(--teal)' : 'var(--ink-2)', flex: 1 }}>
            {allDone
              ? 'Park fully configured — all setup steps complete.'
              : `Setup ${pct}% complete — ${total - doneCount} step${total - doneCount > 1 ? 's' : ''} remaining`
            }
          </span>
          {!allDone && (
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 500 }}>{doneCount}/{total} done</span>
          )}
        </div>

        {!allDone && (
          <>
            {/* Progress bar */}
            <div style={{
              height: 6, borderRadius: 3, background: 'var(--border)',
              overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${pct}%`,
                background: pct >= 80 ? 'var(--teal)' : pct >= 50 ? '#D89614' : 'var(--ink-4)',
                transition: 'width .3s ease',
              }}/>
            </div>

            {/* Checklist */}
            <div>
              {checklistItems.map(item => (
                <ChecklistItem
                  key={item.label}
                  label={item.label}
                  done={item.done}
                  action={item.action}
                  onAction={item.onAction}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── KPI grid — clickable, navigate to operations sections ── */}
      <div className="fin-kpi-grid">
        <KpiBox
          value={counts?.zones    ?? '—'}
          label="Zones Configured"
          sub={counts ? `${counts.zones_active ?? 0} active` : null}
          onClick={() => onGoToTab?.('operations', 'zones')}
        />
        <KpiBox
          value={counts?.gates_active ?? '—'}
          label="Gates Active"
          sub={counts ? `${counts.gates ?? 0} total` : null}
          onClick={() => onGoToTab?.('operations', 'gates')}
        />
        <KpiBox
          value={counts?.counters_active ?? '—'}
          label="Counters Active"
          sub={counts ? `${counts.counters ?? 0} total` : null}
          onClick={() => onGoToTab?.('operations', 'counters')}
        />
        <KpiBox
          value={counts ? `${counts.devices_online ?? 0}/${counts.devices ?? 0}` : '—'}
          label="Devices Online"
          sub={counts && counts.devices_online < counts.devices ? 'Some offline' : counts ? 'All online' : null}
          warn={counts ? counts.devices_online < counts.devices : false}
          onClick={() => onGoToTab?.('operations', 'devices')}
        />
      </div>
    </>
  );
}
