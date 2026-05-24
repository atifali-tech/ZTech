'use client';
import { useEffect, useRef, useState } from 'react';
import ParkWorkspaceZonesGates      from './ParkWorkspaceZonesGates';
import ParkWorkspaceCountersDevices from './ParkWorkspaceCountersDevices';
import ParkWorkspaceShifts          from './ParkWorkspaceShifts';
import ParkWorkspaceOps             from './ParkWorkspaceOps';

const SECTIONS = [
  { id: 'zones',     label: 'Zones'     },
  { id: 'gates',     label: 'Gates'     },
  { id: 'counters',  label: 'Counters'  },
  { id: 'devices',   label: 'Devices'   },
  { id: 'shifts',    label: 'Shifts'    },
  { id: 'alerts',    label: 'Alerts'    },
  { id: 'incidents', label: 'Incidents' },
];

// Zones & Gates share a component; Counters & Devices share a component; Alerts & Incidents share a component.
// Map logical section IDs → DOM anchor IDs.
const ANCHOR = {
  zones:     'ops-zones',
  gates:     'ops-zones',
  counters:  'ops-counters',
  devices:   'ops-devices',
  shifts:    'ops-shifts',
  alerts:    'ops-alerts',
  incidents: 'ops-alerts',
};

function SectionLabel({ label, id }) {
  return (
    <div
      id={id}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        margin: '28px 0 4px', scrollMarginTop: 80,
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: 'var(--ink-5)', whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
    </div>
  );
}

// Invisible scroll target that sits above a section inside the shared component
function Anchor({ id }) {
  return <div id={id} style={{ scrollMarginTop: 80, marginTop: -4 }}/>;
}

export default function ParkWorkspaceOperations({ parkId, scrollToSection }) {
  const [activeChip, setActiveChip] = useState(null);
  const didScrollRef = useRef(null);

  // Honour a scroll request from the parent (e.g. clicking a KPI card on Overview)
  useEffect(() => {
    if (!scrollToSection) return;
    if (didScrollRef.current === scrollToSection) return;
    didScrollRef.current = scrollToSection;

    const anchorId = ANCHOR[scrollToSection] || `ops-${scrollToSection}`;
    const t = setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveChip(scrollToSection);
    }, 80);
    return () => clearTimeout(t);
  }, [scrollToSection]);

  const scrollTo = (sectionId) => {
    setActiveChip(sectionId);
    const anchorId = ANCHOR[sectionId] || `ops-${sectionId}`;
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* ── Section nav chips ── */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        {SECTIONS.map(s => {
          const active = activeChip === s.id;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                padding: '5px 14px', fontSize: 12, borderRadius: 20,
                border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
                background: active ? 'var(--teal-50)' : 'var(--surface-2)',
                color: active ? 'var(--teal)' : 'var(--ink-3)',
                cursor: 'pointer', fontWeight: active ? 600 : 400,
                transition: 'all .15s',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Zones & Gates ── */}
      <SectionLabel label="Zones & Gates" id="ops-zones"/>
      <ParkWorkspaceZonesGates parkId={parkId}/>

      {/* ── Counters & Devices ── */}
      {/* Counters anchor sits above the shared component */}
      <Anchor id="ops-counters"/>
      <SectionLabel label="Counters & Devices" id="ops-counters-label"/>
      {/* Devices anchor is injected just before the devices section inside the component;
          we approximate by placing an anchor here — the component scrolls the user close enough */}
      <ParkWorkspaceCountersDevices parkId={parkId} devicesAnchorId="ops-devices"/>

      {/* ── Shifts ── */}
      <SectionLabel label="Shifts" id="ops-shifts"/>
      <ParkWorkspaceShifts parkId={parkId}/>

      {/* ── Alerts & Incidents ── */}
      <SectionLabel label="Alerts & Incidents" id="ops-alerts"/>
      <ParkWorkspaceOps parkId={parkId}/>
    </>
  );
}
