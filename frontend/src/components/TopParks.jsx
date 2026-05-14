'use client';
import { useState } from 'react';
import { Section } from './Primitives';
import { Delta } from './Primitives';
import { inr, num } from '../lib/format';

const METRICS    = ['Revenue', 'Tickets', 'Footfall', 'Activities', 'F&B'];
const TREND_DELTAS = [4.8, -1.2, 6.4, 2.1, -3.6];

function TopParksPanel({ topParks, initialTab = 'Revenue', headerExtra = null }) {
  const [tab, setTab] = useState(initialTab);
  const list = topParks[tab] || [];
  const max  = Math.max(...list.map(x => x.value));
  const fmt  = ['Revenue','Activities','F&B'].includes(tab) ? inr : num;

  return (
    <Section
      title="Top Performing Parks"
      sub={`top 5 by ${tab.toLowerCase()}`}
      actions={
        <>
          <div className="tabs">
            {METRICS.map(m => (
              <button key={m} className={tab === m ? 'on' : ''} onClick={() => setTab(m)}>{m}</button>
            ))}
          </div>
          {headerExtra}
        </>
      }
    >
      <div>
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
            <Delta value={TREND_DELTAS[i]}/>
            <div className="park-val">{fmt(row.value)}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export default function TopParksRow({ topParks, initialTab = 'Revenue', headerExtra = null }) {
  if (!topParks) return null;
  return <TopParksPanel topParks={topParks} initialTab={initialTab} headerExtra={headerExtra}/>;
}
