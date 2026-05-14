'use client';
import { Section, Donut } from './Primitives';
import { inr } from '../lib/format';

// Canonical colors for Analytics — applied regardless of what the API returns
const DEMO_COLORS   = ['#1D9E75', '#F06292', '#FF8C42', '#5C6BC0'];
const SOURCE_COLORS = { Counter: '#1D9E75', Web: '#378ADD', App: '#7F77DD', WhatsApp: '#7F77DD' };

function normDemo(d, i) {
  const name = d.name === 'Senior' ? 'Senior Citizen' : d.name;
  return { ...d, name, color: DEMO_COLORS[i] ?? d.color };
}

export default function RevenueSplits({ data }) {
  if (!data) return null;

  const byDemo    = data.byDemographic.map(normDemo);
  const byCat     = data.byCategory.filter(d => d.name !== 'Events' && d.value > 0);
  const bySrc     = data.bySource.map(d => ({ ...d, color: SOURCE_COLORS[d.name] ?? d.color }));
  const byPay     = data.byPayment;

  const totalDemo = byDemo.reduce((s, d) => s + d.value, 0);
  const totalCat  = byCat.reduce((s, d) => s + d.value, 0);
  const totalSrc  = bySrc.reduce((s, d) => s + d.value, 0);
  const totalPay  = byPay.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid-12">
      <div className="col-3">
        <Section title="Revenue · Demographic" sub={inr(totalDemo)} actions={<span className="tag teal">Adult-led</span>}>
          <Donut data={byDemo} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Category" sub={inr(totalCat)}>
          <Donut data={byCat} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Ticket Source" sub={inr(totalSrc)}>
          <Donut data={bySrc} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Payment Mode" sub={inr(totalPay)} actions={<span className="tag teal">UPI 57%</span>}>
          <Donut data={byPay} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
    </div>
  );
}
