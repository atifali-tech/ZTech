'use client';
import { useEffect, useState } from 'react';
import ParkWorkspaceZonesGates      from './ParkWorkspaceZonesGates';
import ParkWorkspaceCountersDevices from './ParkWorkspaceCountersDevices';
import ParkWorkspaceShifts          from './ParkWorkspaceShifts';
import ParkWorkspaceOps             from './ParkWorkspaceOps';

const SECTIONS = [
  { id: 'zones',     label: 'Zones & Gates'       },
  { id: 'counters',  label: 'Counters & Devices'  },
  { id: 'shifts',    label: 'Shifts'              },
  { id: 'alerts',    label: 'Alerts & Incidents'  },
];

export default function ParkWorkspaceOperations({ parkId, scrollToSection }) {
  const [active, setActive] = useState('zones');

  // Map legacy section ids to merged tab ids
  const TAB_MAP = { gates: 'zones', devices: 'counters', incidents: 'alerts' };

  useEffect(() => {
    if (scrollToSection) setActive(TAB_MAP[scrollToSection] ?? scrollToSection);
  }, [scrollToSection]);

  return (
    <>
      {/* Section tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            style={{
              padding: '8px 16px', fontSize: 13, background: 'none', border: 'none',
              borderBottom: active === s.id ? '2px solid var(--teal)' : '2px solid transparent',
              color: active === s.id ? 'var(--teal)' : 'var(--ink-3)',
              fontWeight: active === s.id ? 600 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Render only the active section */}
      {active === 'zones'    && <ParkWorkspaceZonesGates      parkId={parkId}/>}
      {active === 'counters' && <ParkWorkspaceCountersDevices parkId={parkId}/>}
      {active === 'shifts'   && <ParkWorkspaceShifts          parkId={parkId}/>}
      {active === 'alerts'   && <ParkWorkspaceOps             parkId={parkId}/>}
    </>
  );
}
