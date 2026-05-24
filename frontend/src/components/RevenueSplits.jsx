'use client';
import { Section, Donut } from './Primitives';
import { inr } from '../lib/format';

// Analytics owns: Revenue by Demographic and Revenue by Category.
// Revenue by Source and Revenue by Payment are owned by the Dashboard
// (RevenueBarCard) — removed here to avoid duplication.

const DEMO_COLORS = ['#1D9E75', '#F06292', '#FF8C42', '#5C6BC0'];

function normDemo(d, i) {
  const name = d.name === 'Senior' ? 'Senior Citizen' : d.name;
  return { ...d, name, color: DEMO_COLORS[i] ?? d.color };
}

export default function RevenueSplits({ data }) {
  if (!data) return null;

  const byDemo = data.byDemographic.map(normDemo);
  const byCat  = data.byCategory.filter(d => d.name !== 'Events' && d.value > 0);

  const totalDemo = byDemo.reduce((s, d) => s + d.value, 0);
  const totalCat  = byCat.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid-12">
      <div className="col-6">
        <Section title="Revenue · Demographic Breakdown" sub={inr(totalDemo)} actions={<span className="tag teal">Adult-led</span>}>
          <Donut data={byDemo} totalLabel="Total" currency size={140}/>
        </Section>
      </div>
      <div className="col-6">
        <Section title="Revenue · Ticket Category" sub={inr(totalCat)}>
          <Donut data={byCat} totalLabel="Total" currency size={140}/>
        </Section>
      </div>
    </div>
  );
}
