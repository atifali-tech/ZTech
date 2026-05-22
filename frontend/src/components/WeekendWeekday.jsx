'use client';
import { Section } from './Primitives';
import { inr, num } from '../lib/format';
import ClusteredBars from './ClusteredBars';

export default function WeekendWeekday({ data, view = 'both', headerExtra = null }) {
  if (!data) return null;

  const revenueSection = (
    <Section
      title="Revenue · Weekend vs Weekday"
      sub="by park · last 30 days"
      actions={
        <>
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
            <span><span className="dot" style={{ background: '#0E7C66' }}/>Weekend</span>
            <span><span className="dot" style={{ background: '#A0CFC2' }}/>Weekday</span>
          </span>
          {headerExtra}
        </>
      }
    >
      <ClusteredBars data={data.revenue} valueKey1="weekend" valueKey2="weekday" color1="#0E7C66" color2="#A0CFC2" formatter={inr}/>
    </Section>
  );

  const footfallSection = (
    <Section
      title="Footfall · Weekend vs Weekday"
      sub="by park · last 30 days"
      actions={
        <>
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
            <span><span className="dot" style={{ background: '#5A6BCF' }}/>Weekend</span>
            <span><span className="dot" style={{ background: '#BAC2EC' }}/>Weekday</span>
          </span>
          {headerExtra}
        </>
      }
    >
      <ClusteredBars data={data.footfall} valueKey1="weekend" valueKey2="weekday" color1="#5A6BCF" color2="#BAC2EC" formatter={num}/>
    </Section>
  );

  if (view === 'revenue')  return revenueSection;
  if (view === 'footfall') return footfallSection;

  return (
    <div className="grid-12">
      <div className="col-6">{revenueSection}</div>
      <div className="col-6">{footfallSection}</div>
    </div>
  );
}
