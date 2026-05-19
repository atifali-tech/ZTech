'use client';
import { useState, useEffect, useRef } from 'react';

export default function CityDropdown({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const label = selected.length === 0
    ? 'All Cities'
    : selected.length === 1
      ? selected[0]
      : `${selected[0]} +${selected.length - 1}`;

  const toggle = (city) => {
    const next = selected.includes(city) ? selected.filter(c => c !== city) : [...selected, city];
    onChange(next.length === options.length ? [] : next);
  };

  const stop = e => e.stopPropagation();

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button
        className="filter-select"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          minWidth: '100%', width: 'max-content',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 8px 20px rgba(0,0,0,.08)',
          zIndex: 50, padding: 4, maxHeight: 220, overflowY: 'auto',
        }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
            borderRadius: 4, cursor: 'pointer', fontSize: 12.5,
            color: selected.length === 0 ? 'var(--teal)' : 'var(--ink-2)',
            fontWeight: selected.length === 0 ? 600 : 400,
          }}>
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
              onClick={stop}
              style={{ accentColor: 'var(--teal)', width: 13, height: 13, cursor: 'pointer' }}
            />
            All Cities
          </label>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px' }}/>
          {options.map(city => (
            <label key={city} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              borderRadius: 4, cursor: 'pointer', fontSize: 12.5, color: 'var(--ink-2)',
            }}>
              <input
                type="checkbox"
                checked={selected.length === 0 || selected.includes(city)}
                onChange={() => toggle(city)}
                onClick={stop}
                style={{ accentColor: 'var(--teal)', width: 13, height: 13, cursor: 'pointer' }}
              />
              {city}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
