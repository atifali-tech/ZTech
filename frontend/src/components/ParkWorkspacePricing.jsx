'use client';
import Icon from './Icon';

// Placeholder for the future pricing engine.
// When the pricing backend is implemented, this component should:
//   - Load ticket types:    GET /api/parks/:id/ticket-types
//   - Load pricing rules:   GET /api/parks/:id/pricing-rules
//   - Load GST rates:       already in Settings (operational-settings.gst_rate)
// Reuse the same sec/data-table/modal patterns from the rest of the workspace.

const PLANNED_SECTIONS = [
  { icon: 'ticket', title: 'Ticket Types',    desc: 'Define age categories (Adult, Child, Senior) with base prices.' },
  { icon: 'money',  title: 'Pricing Rules',   desc: 'Peak / off-peak pricing, seasonal rates, group discounts.' },
  { icon: 'chart',  title: 'GST & Taxes',     desc: 'GST rate and registration are configured in Settings.' },
  { icon: 'file',   title: 'Price History',   desc: 'Audit log of price changes with effective dates.' },
];

export default function ParkWorkspacePricing() {
  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">Pricing</div>
        <span className="tag amber">Coming Soon</span>
      </div>
      <div className="sec-body">
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '14px 16px', marginBottom: 24,
        }}>
          <Icon name="warning" size={16} color="#D89614" style={{ flexShrink: 0, marginTop: 1 }}/>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            Ticket pricing is currently managed via the <strong>ZTech POS</strong> application.
            This tab will activate once the pricing engine is deployed in the admin portal.
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-5)', marginBottom: 12 }}>
          Planned features
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {PLANNED_SECTIONS.map(s => (
            <div key={s.title} style={{
              display: 'flex', gap: 12, padding: '12px 14px',
              border: '1px dashed var(--border)', borderRadius: 8,
              opacity: 0.6,
            }}>
              <Icon name={s.icon} size={18} color="var(--ink-5)" style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
