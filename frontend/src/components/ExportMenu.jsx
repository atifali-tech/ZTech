'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';

export default function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.export-menu-wrap')) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <div className="export-menu-wrap menu-wrap">
      <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        <Icon name="download" size={12}/> Export
        <Icon name="chevron" size={10} color="var(--ink-4)"/>
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          <button onClick={() => onExport('CSV')}>Download as CSV <span className="kbd">⌘E</span></button>
          <button onClick={() => onExport('Excel')}>Download as Excel</button>
          <div className="menu-sep"/>
          <button onClick={() => onExport('DSR')}><Icon name="file" size={13}/> DSR Report (Daily)</button>
          <button onClick={() => onExport('FY-DSR')}><Icon name="file" size={13}/> FY DSR Report</button>
        </div>
      )}
    </div>
  );
}
