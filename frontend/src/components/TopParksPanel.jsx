'use client';
import { useState } from 'react';
import { Section } from './Primitives';
import { inr, num } from '../lib/format';

const METRICS = ['Revenue', 'Tickets', 'Footfall', 'Activities', 'F&B'];

export default function TopParksPanel({ topParks, initialTab = 'Revenue', headerExtra = null }) {
  const [tab, setTab] = useState(initialTab);
  const list = topParks[tab] || [];
  const max  = Math.max(...list.map(x => x.value));
  const fmt  = ['Revenue','Activities','F&B'].includes(tab) ? inr : num;
  const allEmpty = METRICS.every(m => (topParks[m] || []).length === 0);

  return (
    <Section
      title="Top Performing Parks"
      sub={allEmpty ? null : `top 5 by ${tab.toLowerCase()}`}
      actions={allEmpty ? headerExtra : (
        <>
          <div className="tabs">
            {METRICS.map(m => (
              <button key={m} className={tab === m ? 'on' : ''} onClick={() => setTab(m)}>{m}</button>
            ))}
          </div>
          {headerExtra}
        </>
      )}
    >
      <div>
        {list.length === 0 && (
          <div style={{ color: 'var(--ink-4)', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
            No data for this period
          </div>
        )}
        {list.map((row, i) => (
          <div key={row.parkId} className={'park-row' + (i === 0 ? ' top1' : '')}>
            <div className="park-rank">{i + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div className="park-name">{row.name}</div>
              <div className="park-loc">{row.city} · {row.state}</div>
              <div className="park-bar">
                <div style={{ width: (row.value / max * 100) + '%', background: row.color }}/>
              </div>
            </div>
            <div className="park-val">{fmt(row.value)}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
