'use client';
import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import BottomNav from '../../components/BottomNav';

const TABS = ['Footfall', 'Revenue', 'Demographics', 'Trends'];

export default function AnalyticsPage() {
  const [tab, setTab] = useState('Footfall');

  return (
    <div className="app">
      <Sidebar active="analytics"/>
      <div className="main">
        <Topbar initialLiveCount={1284}/>
        <div className="canvas">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Analytics</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>Deep-dive analysis across all 7 parks</div>
          </div>

          <div className="tabs" style={{ alignSelf: 'flex-start' }}>
            {TABS.map(t => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          <div className="sec" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                {tab} Analytics
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 8 }}>
                Coming Soon
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
                Detailed {tab.toLowerCase()} analytics are under development and will be available here shortly.
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav active="analytics"/>
    </div>
  );
}
