'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';
import { num } from '../lib/format';

export default function Topbar({ initialLiveCount = 1284, current = 'Dashboard', icon = 'grid' }) {
  const [liveCount, setLiveCount] = useState(initialLiveCount);

  useEffect(() => {
    const t = setInterval(() => {
      setLiveCount(c => Math.max(0, c + Math.round((Math.random() - 0.45) * 8)));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="topbar">
      <div className="crumbs">
        <Icon name={icon} size={13} color="var(--ink-3)"/>
        <span>Operations</span>
        <Icon name="chevronR" size={11} color="var(--ink-5)"/>
        <strong>{current}</strong>
      </div>
      <span className="tag">FY 2025–26 · Q1</span>

      <div className="topbar-right">
        <div className="live-pill">
          <span className="live-dot"/>
          <span>
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{num(liveCount)}</span>
            {' '}in-park now
          </span>
        </div>
        <button className="icon-btn" title="Refresh"><Icon name="refresh" size={14}/></button>
        <button className="icon-btn" title="Notifications"><Icon name="bell" size={14}/></button>
        <button className="icon-btn" title="Settings"><Icon name="cog" size={14}/></button>
      </div>
    </div>
  );
}
